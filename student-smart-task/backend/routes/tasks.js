const express = require('express');
const mongoose = require('mongoose');
const { Task, PRIORITY_WEIGHTS } = require('../models/Task');

const router = express.Router();

const ALLOWED_UPDATE_FIELDS = [
  'title',
  'subject',
  'category',
  'priority',
  'status',
  'dueDate',
  'estimatedMinutes',
  'notes',
];

function validateObjectId(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid task ID format' });
    return false;
  }
  return true;
}

function buildSummary(tasks) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

  let completed = 0;
  let pending = 0;
  let dueToday = 0;
  let overdue = 0;
  let remainingMinutes = 0;
  const subjectMap = {};

  for (const task of tasks) {
    const subj = task.subject || 'General';
    if (!subjectMap[subj]) {
      subjectMap[subj] = { subject: subj, total: 0, completed: 0 };
    }
    subjectMap[subj].total += 1;

    if (task.status === 'completed') {
      completed += 1;
      subjectMap[subj].completed += 1;
    } else {
      pending += 1;
      remainingMinutes += task.estimatedMinutes || 0;
      const due = new Date(task.dueDate);
      if (due < now) {
        overdue += 1;
      } else if (due >= startOfToday && due <= endOfToday) {
        dueToday += 1;
      }
    }
  }

  return {
    total: tasks.length,
    completed,
    pending,
    dueToday,
    overdue,
    remainingMinutes,
    subjects: Object.values(subjectMap).sort((a, b) => b.total - a.total),
  };
}

/**
 * GET /api/tasks
 * List tasks with optional filtering and sorting.
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, priority, subject, category, search, sort = 'smart' } = req.query;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (subject && subject !== 'all') filter.subject = subject;
    if (category && category !== 'all') filter.category = category;
    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: regex }, { subject: regex }, { notes: regex }];
    }

    const [filteredDocs, allDocs] = await Promise.all([
      Task.find(filter),
      Task.find({}),
    ]);

    const tasks = filteredDocs.map((doc) => doc.toJSON());

    tasks.sort((a, b) => {
      if (sort === 'dueDate') {
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      if (sort === 'priority') {
        return (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0);
      }
      if (sort === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      // Default: 'smart' sort (incomplete highest smartScore first, completed at bottom)
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    res.json({
      tasks,
      summary: buildSummary(allDocs),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/stats
 * Returns aggregated dashboard metrics.
 */
router.get('/stats', async (_req, res, next) => {
  try {
    const allDocs = await Task.find({});
    res.json(buildSummary(allDocs));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks
 * Create a new student task.
 */
router.post('/', async (req, res, next) => {
  try {
    const payload = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) {
        payload[field] = req.body[field];
      }
    }

    if (payload.status === 'completed') {
      payload.completedAt = new Date();
    }

    const task = await Task.create(payload);
    res.status(201).json(task.toJSON());
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    next(error);
  }
});

/**
 * PATCH /api/tasks/:id
 * Update task fields or status.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    if (!validateObjectId(req.params.id, res)) return;

    const updates = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.status !== undefined) {
      updates.completedAt = updates.status === 'completed' ? new Date() : null;
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task.toJSON());
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    next(error);
  }
});

/**
 * DELETE /api/tasks/completed/clear
 * Remove all completed tasks.
 */
router.delete('/completed/clear', async (_req, res, next) => {
  try {
    const result = await Task.deleteMany({ status: 'completed' });
    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a specific task.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    if (!validateObjectId(req.params.id, res)) return;

    const deleted = await Task.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted', id: req.params.id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
