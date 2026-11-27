const mongoose = require('mongoose');

const PRIORITY_WEIGHTS = {
  low: 15,
  medium: 35,
  high: 60,
  urgent: 90,
};

/**
 * Computes a Smart Priority Score (0-100+) based on due date urgency,
 * priority level, status, and estimated study duration.
 */
function computeSmartScore(task) {
  if (task.status === 'completed') return 0;

  const now = Date.now();
  const dueMs = new Date(task.dueDate).getTime();
  const hoursUntilDue = (dueMs - now) / (1000 * 60 * 60);

  let urgencyScore = 0;
  if (hoursUntilDue <= 0) {
    // Overdue tasks rise rapidly in priority
    urgencyScore = 100 + Math.min(40, Math.abs(hoursUntilDue) * 0.5);
  } else if (hoursUntilDue <= 24) {
    urgencyScore = 80;
  } else if (hoursUntilDue <= 72) {
    urgencyScore = 55;
  } else if (hoursUntilDue <= 168) {
    urgencyScore = 30;
  } else {
    urgencyScore = 10;
  }

  const priorityScore = PRIORITY_WEIGHTS[task.priority] || 35;
  const inProgressBoost = task.status === 'in-progress' ? 12 : 0;
  // Slightly boost quick wins (< 30 min) or heavy projects (>= 120 min)
  const effortBoost =
    task.estimatedMinutes <= 30 ? 8 : task.estimatedMinutes >= 120 ? 10 : 4;

  return Math.round(urgencyScore + priorityScore + inProgressBoost + effortBoost);
}

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [140, 'Title cannot exceed 140 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [60, 'Subject cannot exceed 60 characters'],
      default: 'General',
    },
    category: {
      type: String,
      enum: ['Assignment', 'Exam', 'Project', 'Reading', 'Lab', 'Other'],
      default: 'Assignment',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'completed'],
      default: 'todo',
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    estimatedMinutes: {
      type: Number,
      min: [5, 'Estimated time must be at least 5 minutes'],
      max: [1440, 'Estimated time cannot exceed 24 hours (1440 minutes)'],
      default: 45,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.smartScore = computeSmartScore(ret);
        delete ret.__v;
        return ret;
      },
    },
  }
);

taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ subject: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = { Task, computeSmartScore, PRIORITY_WEIGHTS };
