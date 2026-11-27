(() => {
  const API_BASE =
    window.location.protocol === 'file:'
      ? 'http://localhost:5000/api'
      : '/api';

  const LOCAL_STORAGE_KEY = 'student_smart_task_preview_v1';
  const THEME_STORAGE_KEY = 'student_smart_task_theme';

  const PRIORITY_WEIGHTS = { low: 15, medium: 35, high: 60, urgent: 90 };

  const state = {
    tasks: [],
    summary: null,
    useLocalFallback: false,
    filters: {
      status: 'all',
      subject: 'all',
      priority: 'all',
      search: '',
      sort: 'smart',
    },
    timer: {
      mode: 'focus',
      totalSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      intervalId: null,
      activeTaskTitle: '',
    },
  };

  // DOM Elements
  const els = {
    connectionBadge: document.getElementById('connectionBadge'),
    connectionText: document.getElementById('connectionText'),
    previewBanner: document.getElementById('previewBanner'),
    retryBackendBtn: document.getElementById('retryBackendBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    sunIcon: document.getElementById('sunIcon'),
    moonIcon: document.getElementById('moonIcon'),
    openAddModalBtn: document.getElementById('openAddModalBtn'),
    statPending: document.getElementById('statPending'),
    statOverdue: document.getElementById('statOverdue'),
    statDueToday: document.getElementById('statDueToday'),
    statStudyTime: document.getElementById('statStudyTime'),
    statCompleted: document.getElementById('statCompleted'),
    statCompletionRate: document.getElementById('statCompletionRate'),
    smartFocusCard: document.getElementById('smartFocusCard'),
    smartFocusScore: document.getElementById('smartFocusScore'),
    smartFocusTitle: document.getElementById('smartFocusTitle'),
    smartFocusMeta: document.getElementById('smartFocusMeta'),
    smartFocusBtn: document.getElementById('smartFocusBtn'),
    searchInput: document.getElementById('searchInput'),
    subjectFilter: document.getElementById('subjectFilter'),
    priorityFilter: document.getElementById('priorityFilter'),
    sortSelect: document.getElementById('sortSelect'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),
    taskList: document.getElementById('taskList'),
    subjectProgressList: document.getElementById('subjectProgressList'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerTaskLabel: document.getElementById('timerTaskLabel'),
    timerStartBtn: document.getElementById('timerStartBtn'),
    timerResetBtn: document.getElementById('timerResetBtn'),
    modeButtons: document.querySelectorAll('.mode-btn'),
    taskModal: document.getElementById('taskModal'),
    modalTitle: document.getElementById('modalTitle'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    taskForm: document.getElementById('taskForm'),
    taskIdInput: document.getElementById('taskIdInput'),
    titleInput: document.getElementById('titleInput'),
    subjectInput: document.getElementById('subjectInput'),
    categoryInput: document.getElementById('categoryInput'),
    priorityInput: document.getElementById('priorityInput'),
    statusInput: document.getElementById('statusInput'),
    dueDateInput: document.getElementById('dueDateInput'),
    estimatedMinutesInput: document.getElementById('estimatedMinutesInput'),
    notesInput: document.getElementById('notesInput'),
    formError: document.getElementById('formError'),
    toastContainer: document.getElementById('toastContainer'),
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function formatDuration(minutes) {
    const mins = Number(minutes) || 0;
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hours}h ${rem}m` : `${hours}h`;
  }

  function formatDueInfo(dueDateStr, status) {
    const due = new Date(dueDateStr);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const formatted = due.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    if (status === 'completed') {
      return { text: formatted, urgencyClass: '' };
    }
    if (diffMs < 0) {
      const daysLate = Math.max(1, Math.ceil(Math.abs(diffHours) / 24));
      return {
        text: `Overdue (${daysLate}d) • ${formatted}`,
        urgencyClass: 'badge-overdue',
      };
    }
    if (diffHours <= 24) {
      return {
        text: `Due soon (${Math.max(1, diffHours)}h) • ${formatted}`,
        urgencyClass: 'badge-due-soon',
      };
    }
    return { text: formatted, urgencyClass: '' };
  }

  function computeLocalSmartScore(task) {
    if (task.status === 'completed') return 0;
    const hoursUntilDue = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    let urgencyScore = 10;
    if (hoursUntilDue <= 0) urgencyScore = 100 + Math.min(40, Math.abs(hoursUntilDue) * 0.5);
    else if (hoursUntilDue <= 24) urgencyScore = 80;
    else if (hoursUntilDue <= 72) urgencyScore = 55;
    else if (hoursUntilDue <= 168) urgencyScore = 30;

    const priorityScore = PRIORITY_WEIGHTS[task.priority] || 35;
    const inProgressBoost = task.status === 'in-progress' ? 12 : 0;
    const effortBoost = task.estimatedMinutes <= 30 ? 8 : task.estimatedMinutes >= 120 ? 10 : 4;
    return Math.round(urgencyScore + priorityScore + inProgressBoost + effortBoost);
  }

  function getSeedTasks() {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    return [
      {
        id: 'sample-1',
        title: 'Finish Linear Algebra Eigenvalues Problem Set',
        subject: 'Mathematics',
        category: 'Assignment',
        priority: 'urgent',
        status: 'in-progress',
        dueDate: new Date(now + 10 * hour).toISOString(),
        estimatedMinutes: 60,
        notes: 'Focus on questions 4-8 and verify orthogonality proofs.',
        createdAt: new Date(now - 24 * hour).toISOString(),
      },
      {
        id: 'sample-2',
        title: 'Review Data Structures: Graph Traversal & Dijkstra',
        subject: 'Computer Science',
        category: 'Exam',
        priority: 'high',
        status: 'todo',
        dueDate: new Date(now + 36 * hour).toISOString(),
        estimatedMinutes: 90,
        notes: 'Implement BFS/DFS dry runs and practice time complexity questions.',
        createdAt: new Date(now - 20 * hour).toISOString(),
      },
      {
        id: 'sample-3',
        title: 'Write Optics Lab Report Conclusion',
        subject: 'Physics',
        category: 'Lab',
        priority: 'medium',
        status: 'todo',
        dueDate: new Date(now + 78 * hour).toISOString(),
        estimatedMinutes: 45,
        notes: 'Include error percentage table from Tuesday lab session.',
        createdAt: new Date(now - 12 * hour).toISOString(),
      },
      {
        id: 'sample-4',
        title: 'Read Chapter 5: Modern Macroeconomics',
        subject: 'Economics',
        category: 'Reading',
        priority: 'low',
        status: 'completed',
        dueDate: new Date(now - 6 * hour).toISOString(),
        estimatedMinutes: 30,
        notes: 'Summarized key fiscal policy graphs.',
        createdAt: new Date(now - 48 * hour).toISOString(),
      },
    ];
  }

  function loadLocalTasks() {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const seed = getSeedTasks();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return getSeedTasks();
    }
  }

  function saveLocalTasks(tasks) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  }

  function buildLocalResponse() {
    const allTasks = loadLocalTasks().map((t) => ({
      ...t,
      smartScore: computeLocalSmartScore(t),
    }));

    const { status, subject, priority, search, sort } = state.filters;
    const query = search.trim().toLowerCase();

    const filtered = allTasks.filter((t) => {
      if (status !== 'all' && t.status !== status) return false;
      if (subject !== 'all' && t.subject !== subject) return false;
      if (priority !== 'all' && t.priority !== priority) return false;
      if (
        query &&
        !t.title.toLowerCase().includes(query) &&
        !t.subject.toLowerCase().includes(query) &&
        !(t.notes || '').toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === 'dueDate') return new Date(a.dueDate) - new Date(b.dueDate);
      if (sort === 'priority') {
        return (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0);
      }
      if (sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86400000 - 1);

    let completed = 0;
    let pending = 0;
    let dueToday = 0;
    let overdue = 0;
    let remainingMinutes = 0;
    const subjectMap = {};

    for (const task of allTasks) {
      const subj = task.subject || 'General';
      if (!subjectMap[subj]) subjectMap[subj] = { subject: subj, total: 0, completed: 0 };
      subjectMap[subj].total += 1;

      if (task.status === 'completed') {
        completed += 1;
        subjectMap[subj].completed += 1;
      } else {
        pending += 1;
        remainingMinutes += Number(task.estimatedMinutes) || 0;
        const due = new Date(task.dueDate);
        if (due < now) overdue += 1;
        else if (due >= startOfToday && due <= endOfToday) dueToday += 1;
      }
    }

    return {
      tasks: filtered,
      summary: {
        total: allTasks.length,
        completed,
        pending,
        dueToday,
        overdue,
        remainingMinutes,
        subjects: Object.values(subjectMap).sort((a, b) => b.total - a.total),
      },
    };
  }

  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  function setConnectionStatus(online, text) {
    els.connectionBadge.classList.remove('status-checking', 'status-online', 'status-offline');
    els.connectionBadge.classList.add(online ? 'status-online' : 'status-offline');
    els.connectionText.textContent = text;
    els.previewBanner.classList.toggle('hidden', online);
    state.useLocalFallback = !online;
  }

  async function checkBackendHealth() {
    try {
      const health = await apiRequest('/health');
      const dbConnected = health.database === 'connected';
      setConnectionStatus(
        true,
        dbConnected ? 'MongoDB Connected' : 'API Connected (DB Connecting)'
      );
      return true;
    } catch {
      setConnectionStatus(false, 'Local Preview Mode');
      return false;
    }
  }

  async function loadTasks() {
    if (!state.useLocalFallback) {
      try {
        const params = new URLSearchParams();
        Object.entries(state.filters).forEach(([key, val]) => {
          if (val && val !== 'all') params.set(key, val);
        });
        const data = await apiRequest(`/tasks?${params.toString()}`);
        state.tasks = data.tasks;
        state.summary = data.summary;
        renderAll();
        return;
      } catch {
        setConnectionStatus(false, 'Local Preview Mode');
      }
    }

    const localData = buildLocalResponse();
    state.tasks = localData.tasks;
    state.summary = localData.summary;
    renderAll();
  }

  async function createTask(payload) {
    if (!state.useLocalFallback) {
      await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } else {
      const all = loadLocalTasks();
      all.push({
        ...payload,
        id: `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      saveLocalTasks(all);
    }
    showToast('Task added');
    await loadTasks();
  }

  async function updateTask(id, updates) {
    if (!state.useLocalFallback) {
      await apiRequest(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } else {
      const all = loadLocalTasks().map((t) =>
        t.id === id ? { ...t, ...updates } : t
      );
      saveLocalTasks(all);
    }
    await loadTasks();
  }

  async function deleteTask(id) {
    if (!state.useLocalFallback) {
      await apiRequest(`/tasks/${id}`, { method: 'DELETE' });
    } else {
      const all = loadLocalTasks().filter((t) => t.id !== id);
      saveLocalTasks(all);
    }
    showToast('Task deleted');
    await loadTasks();
  }

  async function clearCompletedTasks() {
    if (!state.useLocalFallback) {
      await apiRequest('/tasks/completed/clear', { method: 'DELETE' });
    } else {
      const all = loadLocalTasks().filter((t) => t.status !== 'completed');
      saveLocalTasks(all);
    }
    showToast('Cleared completed tasks');
    await loadTasks();
  }

  function renderSummary() {
    const s = state.summary || {
      total: 0,
      completed: 0,
      pending: 0,
      dueToday: 0,
      overdue: 0,
      remainingMinutes: 0,
      subjects: [],
    };

    els.statPending.textContent = s.pending;
    els.statOverdue.textContent = `${s.overdue} overdue`;
    els.statDueToday.textContent = s.dueToday;
    els.statStudyTime.textContent = formatDuration(s.remainingMinutes);
    els.statCompleted.textContent = s.completed;
    const rate = s.total ? Math.round((s.completed / s.total) * 100) : 0;
    els.statCompletionRate.textContent = `${rate}% done`;

    els.clearCompletedBtn.classList.toggle('hidden', s.completed === 0);

    // Update subject filter options preserving current selection
    const currentSubject = state.filters.subject;
    els.subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
    s.subjects.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.subject;
      opt.textContent = item.subject;
      if (item.subject === currentSubject) opt.selected = true;
      els.subjectFilter.appendChild(opt);
    });

    // Render subject progress bars
    if (!s.subjects.length) {
      els.subjectProgressList.innerHTML =
        '<p class="muted-empty">Add tasks to see subject progress.</p>';
      return;
    }

    els.subjectProgressList.innerHTML = s.subjects
      .map((item) => {
        const pct = item.total ? Math.round((item.completed / item.total) * 100) : 0;
        return `
          <div class="subject-item">
            <div class="subject-item-head">
              <span>${escapeHtml(item.subject)}</span>
              <span class="subject-item-count">${item.completed}/${item.total}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderSmartRecommendation() {
    const activeTasks = state.tasks
      .filter((t) => t.status !== 'completed')
      .sort((a, b) => (b.smartScore || 0) - (a.smartScore || 0));

    const top = activeTasks[0];
    if (!top) {
      els.smartFocusCard.classList.add('hidden');
      return;
    }

    els.smartFocusCard.classList.remove('hidden');
    els.smartFocusScore.textContent = `Smart Score: ${top.smartScore}`;
    els.smartFocusTitle.textContent = top.title;
    const dueInfo = formatDueInfo(top.dueDate, top.status);
    els.smartFocusMeta.textContent = `${top.subject} • ${top.category} • ${formatDuration(
      top.estimatedMinutes
    )} • ${dueInfo.text}`;
    els.smartFocusBtn.onclick = () => startFocusOnTask(top.title);
  }

  function renderTasks() {
    if (!state.tasks.length) {
      els.taskList.innerHTML = `
        <div class="empty-state">
          <h3>No matching tasks</h3>
          <p>Click <strong>+ New Task</strong> to plan an assignment, exam, or study session.</p>
        </div>
      `;
      return;
    }

    els.taskList.innerHTML = state.tasks
      .map((task) => {
        const isDone = task.status === 'completed';
        const dueInfo = formatDueInfo(task.dueDate, task.status);
        const notesHtml = task.notes
          ? `<p class="task-notes">${escapeHtml(task.notes)}</p>`
          : '';

        return `
          <article class="task-card ${isDone ? 'is-completed' : ''}" data-id="${escapeHtml(task.id)}">
            <div class="task-top">
              <div class="task-main">
                <input
                  class="task-checkbox"
                  type="checkbox"
                  ${isDone ? 'checked' : ''}
                  aria-label="Mark ${escapeHtml(task.title)} as completed"
                />
                <div>
                  <h3 class="task-title">${escapeHtml(task.title)}</h3>
                  <div class="task-badges">
                    <span class="badge badge-subject">${escapeHtml(task.subject)}</span>
                    <span class="badge badge-category">${escapeHtml(task.category)}</span>
                    <span class="badge badge-priority-${escapeHtml(task.priority)}">${escapeHtml(
                      task.priority.toUpperCase()
                    )}</span>
                    ${
                      dueInfo.urgencyClass
                        ? `<span class="badge ${dueInfo.urgencyClass}">${escapeHtml(dueInfo.text)}</span>`
                        : ''
                    }
                  </div>
                  ${notesHtml}
                </div>
              </div>
              <select class="status-select" aria-label="Change task status">
                <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
                <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
              </select>
            </div>

            <div class="task-footer">
              <div class="task-meta-group">
                <span>Due: ${escapeHtml(dueInfo.text)}</span>
                <span>Est: ${escapeHtml(formatDuration(task.estimatedMinutes))}</span>
                ${!isDone ? `<span>Smart Score: ${escapeHtml(task.smartScore ?? 0)}</span>` : ''}
              </div>
              <div class="task-actions">
                <button class="btn btn-sm btn-secondary focus-task-btn" type="button">Focus</button>
                <button class="btn btn-sm btn-secondary edit-task-btn" type="button">Edit</button>
                <button class="btn btn-sm btn-text delete-task-btn" type="button">Delete</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderAll() {
    renderSummary();
    renderSmartRecommendation();
    renderTasks();
  }

  // Modal helpers
  function toLocalDateTimeValue(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  function openModal(task = null) {
    els.formError.classList.add('hidden');
    els.formError.textContent = '';

    if (task) {
      els.modalTitle.textContent = 'Edit Student Task';
      els.taskIdInput.value = task.id;
      els.titleInput.value = task.title;
      els.subjectInput.value = task.subject;
      els.categoryInput.value = task.category;
      els.priorityInput.value = task.priority;
      els.statusInput.value = task.status;
      els.dueDateInput.value = toLocalDateTimeValue(task.dueDate);
      els.estimatedMinutesInput.value = task.estimatedMinutes || 45;
      els.notesInput.value = task.notes || '';
    } else {
      els.modalTitle.textContent = 'Add Student Task';
      els.taskForm.reset();
      els.taskIdInput.value = '';
      els.priorityInput.value = 'medium';
      els.statusInput.value = 'todo';
      els.estimatedMinutesInput.value = 45;
      els.dueDateInput.value = toLocalDateTimeValue();
    }

    els.taskModal.classList.remove('hidden');
    els.titleInput.focus();
  }

  function closeModal() {
    els.taskModal.classList.add('hidden');
  }

  // Pomodoro Timer
  function renderTimer() {
    const mins = Math.floor(state.timer.remainingSeconds / 60);
    const secs = state.timer.remainingSeconds % 60;
    els.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(
      2,
      '0'
    )}`;
    els.timerStartBtn.textContent = state.timer.intervalId ? 'Pause' : 'Start';
    els.timerTaskLabel.textContent = state.timer.activeTaskTitle
      ? `Focusing on: ${state.timer.activeTaskTitle}`
      : 'Select a task to focus on';
  }

  function stopTimer() {
    if (state.timer.intervalId) {
      clearInterval(state.timer.intervalId);
      state.timer.intervalId = null;
    }
    renderTimer();
  }

  function toggleTimer() {
    if (state.timer.intervalId) {
      stopTimer();
      return;
    }

    state.timer.intervalId = setInterval(() => {
      if (state.timer.remainingSeconds <= 1) {
        stopTimer();
        state.timer.remainingSeconds = state.timer.totalSeconds;
        renderTimer();
        showToast(
          state.timer.mode === 'focus'
            ? 'Focus session complete! Take a 5-minute break.'
            : 'Break finished! Ready for the next study block.'
        );
        return;
      }
      state.timer.remainingSeconds -= 1;
      renderTimer();
    }, 1000);
    renderTimer();
  }

  function resetTimer(minutes = null, mode = null) {
    stopTimer();
    if (minutes !== null) {
      state.timer.totalSeconds = minutes * 60;
      state.timer.mode = mode || state.timer.mode;
    }
    state.timer.remainingSeconds = state.timer.totalSeconds;
    renderTimer();
  }

  function startFocusOnTask(title) {
    state.timer.activeTaskTitle = title;
    els.modeButtons.forEach((btn) =>
      btn.classList.toggle('active', btn.dataset.mode === 'focus')
    );
    resetTimer(25, 'focus');
    toggleTimer();
    showToast(`Started 25m focus on "${title}"`);
  }

  // Theme
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    els.sunIcon.classList.toggle('hidden', theme === 'light');
    els.moonIcon.classList.toggle('hidden', theme === 'dark');
  }

  // Event Listeners
  function bindEvents() {
    els.themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    const retryHandler = async () => {
      els.connectionText.textContent = 'Checking MongoDB...';
      await checkBackendHealth();
      await loadTasks();
    };

    els.connectionBadge.addEventListener('click', retryHandler);
    els.retryBackendBtn.addEventListener('click', retryHandler);

    els.openAddModalBtn.addEventListener('click', () => openModal());
    els.closeModalBtn.addEventListener('click', closeModal);
    els.cancelModalBtn.addEventListener('click', closeModal);
    els.taskModal.addEventListener('click', (e) => {
      if (e.target === els.taskModal) closeModal();
    });

    els.taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      els.formError.classList.add('hidden');

      const id = els.taskIdInput.value;
      const payload = {
        title: els.titleInput.value.trim(),
        subject: els.subjectInput.value.trim() || 'General',
        category: els.categoryInput.value,
        priority: els.priorityInput.value,
        status: els.statusInput.value,
        dueDate: new Date(els.dueDateInput.value).toISOString(),
        estimatedMinutes: Number(els.estimatedMinutesInput.value) || 45,
        notes: els.notesInput.value.trim(),
      };

      if (!payload.title || !els.dueDateInput.value) {
        els.formError.textContent = 'Please provide a title and due date.';
        els.formError.classList.remove('hidden');
        return;
      }

      try {
        if (id) {
          await updateTask(id, payload);
          showToast('Task updated');
        } else {
          await createTask(payload);
        }
        closeModal();
      } catch (err) {
        els.formError.textContent = err.message;
        els.formError.classList.remove('hidden');
      }
    });

    els.searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      loadTasks();
    });

    els.subjectFilter.addEventListener('change', (e) => {
      state.filters.subject = e.target.value;
      loadTasks();
    });

    els.priorityFilter.addEventListener('change', (e) => {
      state.filters.priority = e.target.value;
      loadTasks();
    });

    els.sortSelect.addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      loadTasks();
    });

    els.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        els.tabButtons.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        state.filters.status = btn.dataset.status;
        loadTasks();
      });
    });

    els.clearCompletedBtn.addEventListener('click', clearCompletedTasks);

    els.taskList.addEventListener('click', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      const task = state.tasks.find((t) => t.id === card.dataset.id);
      if (!task) return;

      if (e.target.closest('.delete-task-btn')) {
        deleteTask(task.id);
      } else if (e.target.closest('.edit-task-btn')) {
        openModal(task);
      } else if (e.target.closest('.focus-task-btn')) {
        startFocusOnTask(task.title);
      }
    });

    els.taskList.addEventListener('change', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      const id = card.dataset.id;

      if (e.target.classList.contains('task-checkbox')) {
        const nextStatus = e.target.checked ? 'completed' : 'todo';
        updateTask(id, { status: nextStatus });
      } else if (e.target.classList.contains('status-select')) {
        updateTask(id, { status: e.target.value });
      }
    });

    els.timerStartBtn.addEventListener('click', toggleTimer);
    els.timerResetBtn.addEventListener('click', () => resetTimer());

    els.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        els.modeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        resetTimer(Number(btn.dataset.minutes), btn.dataset.mode);
      });
    });
  }

  async function init() {
    applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'light');
    renderTimer();
    bindEvents();
    await checkBackendHealth();
    await loadTasks();
  }

  init();
})();
