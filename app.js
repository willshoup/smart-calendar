/**
 * app.js - Smart Calendar main entry point
 * Handles routing, auth, calendar, events, todos, screenshot upload, realtime, offline.
 */

import {
  initSupabase, signIn, signUp, signOut, getSession, onAuthStateChange,
  fetchEvents, createEvent, updateEvent, deleteEvent,
  fetchTodos, createTodo, updateTodo, deleteTodo,
  subscribeToEvents, subscribeToTodos, unsubscribeAll,
} from './supabase-client.js';
import { extractEvent } from './gemini.js';

// â”€â”€ Application state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let state = {
  user: null, events: [], todos: [],
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0-indexed
  selectedDate: null,                  // 'YYYY-MM-DD' | null
};
let editingEventId = null;
let screenshotBase64 = null;
let screenshotMime   = null;

// â”€â”€ View management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showView(name) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(name + '-view');
  if (el) el.classList.add('active');
}

function checkSetup() {
  return !!(localStorage.getItem('sc_supabase_url') &&
            localStorage.getItem('sc_supabase_anon_key') &&
            localStorage.getItem('sc_gemini_key'));
}

// â”€â”€ Initialisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function init() {
  if (!checkSetup()) { showView('setup'); return; }
  initSupabase();
  registerAuthStateChange();
  const session = await getSession();
  if (!session) showView('auth');
  else await startApp(session.user);
}
document.addEventListener('DOMContentLoaded', init);

// â”€â”€ Setup form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById('setup-form').addEventListener('submit', e => {
  e.preventDefault();
  const errEl = document.getElementById('setup-error');
  const url = document.getElementById('setup-supabase-url').value.trim();
  const key = document.getElementById('setup-supabase-key').value.trim();
  const gem = document.getElementById('setup-gemini-key').value.trim();
  if (!url || !key || !gem) { errEl.textContent = 'Please fill in all three fields.'; return; }
  errEl.textContent = '';
  localStorage.setItem('sc_supabase_url', url);
  localStorage.setItem('sc_supabase_anon_key', key);
  localStorage.setItem('sc_gemini_key', gem);
  initSupabase();
  registerAuthStateChange();
  showView('auth');
});

// â”€â”€ Auth handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mapAuthError(msg) {
  if (!msg) return 'An unknown error occurred.';
  if (msg.includes('Invalid login credentials')) return 'Email or password is incorrect.';
  if (msg.includes('Email not confirmed')) return 'Please verify your email before signing in.';
  if (msg.includes('User already registered')) return 'An account with this email already exists.';
  if (msg.includes('Password should be')) return 'Password must be at least 6 characters.';
  return msg;
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  if (!email || !password) { errEl.textContent = 'Please enter both email and password.'; return; }
  errEl.textContent = '';
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  const { error } = await signIn(email, password);
  btn.disabled = false;
  if (error) errEl.textContent = mapAuthError(error.message);
});

document.getElementById('btn-signup').addEventListener('click', async () => {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  if (!email || !password) { errEl.textContent = 'Please enter both email and password.'; return; }
  errEl.textContent = '';
  const btn = document.getElementById('btn-signup');
  btn.disabled = true;
  const { error } = await signUp(email, password);
  btn.disabled = false;
  if (error) { errEl.textContent = mapAuthError(error.message); }
  else { errEl.style.color = '#16a34a'; errEl.textContent = 'Account created! Check your email to confirm.'; }
});

document.getElementById('btn-signout').addEventListener('click', async () => {
  await signOut();
  unsubscribeAll();
});

let authChangeRegistered = false;
function registerAuthStateChange() {
  if (authChangeRegistered) return;
  authChangeRegistered = true;
  onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      const errEl = document.getElementById('auth-error');
      if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }
      await startApp(session.user);
    } else if (event === 'SIGNED_OUT') {
      state = { user: null, events: [], todos: [], currentYear: new Date().getFullYear(), currentMonth: new Date().getMonth(), selectedDate: null };
      unsubscribeAll();
      showView('auth');
    } else if (event === 'TOKEN_REFRESHED' && !session) {
      unsubscribeAll();
      showView('auth');
    }
  });
}

// â”€â”€ startApp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function startApp(user) {
  state.user = user;
  document.getElementById('user-email').textContent = user.email;
  showView('app');
  // Render empty calendar immediately so it shows before data loads
  renderCalendar(state.currentYear, state.currentMonth, []);
  const [evResult, todResult] = await Promise.all([fetchEvents(user.id), fetchTodos(user.id)]);
  if (evResult.error) showToast('Could not load events.', { type: 'error' });
  else state.events = evResult.data || [];
  if (todResult.error) showToast('Could not load tasks.', { type: 'error' });
  else state.todos = todResult.data || [];
  renderCalendar(state.currentYear, state.currentMonth, state.events);
  renderTodos(state.todos);
  initRealtime(user.id);
}

// â”€â”€ Toast notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showToast(message, options = {}) {
  const { type = 'info', persistent = false, onRetry } = options;
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', 'alert');
  if (persistent) toast.dataset.persistent = 'true';
  const body = document.createElement('div');
  body.className = 'toast-body';
  const msg = document.createElement('span');
  msg.className = 'toast-message';
  msg.textContent = message;
  body.appendChild(msg);
  if (typeof onRetry === 'function') {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'toast-retry';
    retryBtn.type = 'button';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => { toast.remove(); onRetry(); });
    body.appendChild(retryBtn);
  }
  toast.appendChild(body);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = 'Ã—';
  closeBtn.addEventListener('click', () => toast.remove());
  toast.appendChild(closeBtn);
  container.appendChild(toast);
  if (!persistent && (type === 'info' || type === 'success')) {
    setTimeout(() => toast.remove(), 5000);
  }
}

function dismissPersistentToasts() {
  document.querySelectorAll('#toast-container .toast[data-persistent="true"]').forEach(t => t.remove());
}

// â”€â”€ Calendar rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function renderCalendar(year, month, events) {
  const grid  = document.getElementById('calendar-grid');
  const title = document.getElementById('calendar-title');
  grid.innerHTML = '';
  title.textContent = MONTH_NAMES[month] + ' ' + year;

  DAY_NAMES.forEach(day => {
    const cell = document.createElement('div');
    cell.className = 'calendar-header-cell';
    cell.setAttribute('role', 'columnheader');
    cell.textContent = day;
    grid.appendChild(cell);
  });

  const today = toISODate(new Date());
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    empty.setAttribute('role', 'gridcell');
    empty.setAttribute('aria-hidden', 'true');
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = year + '-' + mm + '-' + dd;
    const dayEvents = events.filter(ev => ev.date === dateStr);

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.dataset.date = dateStr;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('tabindex', '0');

    let ariaLabel = MONTH_NAMES[month] + ' ' + d;
    if (dateStr === today)             ariaLabel += ', today';
    if (dateStr === state.selectedDate) ariaLabel += ', selected';
    if (dayEvents.length > 0) ariaLabel += ', ' + dayEvents.length + ' event' + (dayEvents.length > 1 ? 's' : '');
    cell.setAttribute('aria-label', ariaLabel);

    if (dateStr === today)             cell.classList.add('today');
    if (dateStr === state.selectedDate) cell.classList.add('selected');

    const numEl = document.createElement('span');
    numEl.className = 'day-number';
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (dayEvents.length > 0) {
      const dots = document.createElement('div');
      dots.className = 'event-dots';
      dayEvents.slice(0, 3).forEach(ev => {
        const dot = document.createElement('div');
        dot.className = 'event-dot';
        dot.title = ev.title;
        dots.appendChild(dot);
      });
      if (dayEvents.length > 3) {
        const badge = document.createElement('span');
        badge.className = 'more-badge';
        badge.textContent = '+' + (dayEvents.length - 3) + ' more';
        dots.appendChild(badge);
      }
      cell.appendChild(dots);
    }

    cell.addEventListener('click', () => selectDay(dateStr));
    cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDay(dateStr); } });
    grid.appendChild(cell);
  }
}

function selectDay(dateStr) {
  const prev = document.querySelector('#calendar-grid .day-cell.selected');
  if (prev) prev.classList.remove('selected');
  const next = document.querySelector('#calendar-grid .day-cell[data-date="' + dateStr + '"]');
  if (next) next.classList.add('selected');
  state.selectedDate = dateStr;
  renderDayDetail(dateStr, state.events);
}

function renderDayDetail(dateStr, events) {
  const titleEl = document.getElementById('day-detail-title');
  const listEl  = document.getElementById('day-events-list');
  listEl.innerHTML = '';
  const parts = dateStr.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  titleEl.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const dayEvents = events
    .filter(ev => ev.date === dateStr)
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

  if (dayEvents.length === 0) {
    const msg = document.createElement('li');
    msg.className = 'no-events-msg';
    msg.textContent = 'No events for this day.';
    listEl.appendChild(msg);
    return;
  }

  dayEvents.forEach(ev => {
    const li = document.createElement('li');
    li.className = 'event-item';
    li.dataset.eventId = ev.id;

    const timeEl = document.createElement('div');
    timeEl.className = 'event-item-time';
    timeEl.textContent = ev.time ? (ev.end_time ? toTimeDisplay(ev.time) + ' - ' + toTimeDisplay(ev.end_time) : toTimeDisplay(ev.time)) : '';

    const titleSpan = document.createElement('div');
    titleSpan.className = 'event-item-title';
    titleSpan.textContent = ev.title;

    li.appendChild(timeEl);
    li.appendChild(titleSpan);

    const metaParts = [];
    if (ev.location) metaParts.push('ðŸ“ ' + ev.location);
    if (ev.attendee) metaParts.push('ðŸ‘¤ ' + ev.attendee);
    if (metaParts.length) {
      const meta = document.createElement('div');
      meta.className = 'event-item-meta';
      meta.textContent = metaParts.join('  Â·  ');
      li.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'event-item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-event';
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', 'Edit event: ' + ev.title);
    editBtn.addEventListener('click', () => {
      const evObj = state.events.find(e => e.id === ev.id);
      if (evObj) eventModal.open(evObj);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-event';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.setAttribute('aria-label', 'Delete event: ' + ev.title);
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete "' + ev.title + '"?')) return;
      const { error } = await deleteEvent(ev.id);
      if (error) { showToast('Could not delete event.', { type: 'error' }); return; }
      state.events = state.events.filter(e => e.id !== ev.id);
      renderCalendar(state.currentYear, state.currentMonth, state.events);
      renderDayDetail(state.selectedDate, state.events);
      showToast('Event deleted.', { type: 'success' });
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
}

document.getElementById('btn-prev-month').addEventListener('click', () => {
  state.currentMonth--;
  if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
  renderCalendar(state.currentYear, state.currentMonth, state.events);
});

document.getElementById('btn-next-month').addEventListener('click', () => {
  state.currentMonth++;
  if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
  renderCalendar(state.currentYear, state.currentMonth, state.events);
});

function toISODate(date) {
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
}

function toDisplayDate(dateStr) {
  if (!dateStr) return '';
  const p = dateStr.split('-').map(Number);
  return new Date(p[0], p[1]-1, p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':').map(Number);
  const hh = parts[0], mm = parts[1];
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h = hh % 12 || 12;
  return h + ':' + String(mm).padStart(2,'0') + ' ' + ampm;
}

// â”€â”€ Event Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const eventModal = {
  get dialog() { return document.getElementById('event-modal'); },
  open(event) {
    const titleEl = document.getElementById('event-modal-title');
    const errEl   = document.getElementById('event-form-error');
    errEl.textContent = '';
    if (event) {
      titleEl.textContent = 'Edit Event';
      editingEventId = event.id;
      document.getElementById('ef-title').value    = event.title    || '';
      document.getElementById('ef-date').value     = event.date     || '';
      document.getElementById('ef-time').value     = event.time     || '';
      document.getElementById('ef-location').value = event.location || '';
      document.getElementById('ef-attendee').value = event.attendee || '';
      document.getElementById('ef-end-time').value  = event.end_time  || '';
    } else {
      titleEl.textContent = 'New Event';
      editingEventId = null;
      document.getElementById('event-form').reset();
      if (state.selectedDate) document.getElementById('ef-date').value = state.selectedDate;
    }
    // Always ensure the submit button is enabled when opening the modal
    const submitBtn = this.dialog.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
    this.dialog.showModal();
    document.getElementById('ef-title').focus();
  },
  close() {
    document.getElementById('event-form').reset();
    document.getElementById('event-form-error').textContent = '';
    editingEventId = null;
    this.dialog.close();
  },
  prefill(result) {
    if (result.title)    document.getElementById('ef-title').value    = result.title;
    if (result.date)     document.getElementById('ef-date').value     = result.date;
    if (result.time)     document.getElementById('ef-time').value     = result.time;
    if (result.location) document.getElementById('ef-location').value = result.location;
    if (result.attendee) document.getElementById('ef-attendee').value = result.attendee;
    if (result.end_time) document.getElementById('ef-end-time').value  = result.end_time;
  },
};

document.getElementById('btn-add-event').addEventListener('click', () => eventModal.open(null));
document.getElementById('btn-event-cancel').addEventListener('click', () => eventModal.close());
document.getElementById('event-modal').addEventListener('cancel', e => { e.preventDefault(); eventModal.close(); });

document.getElementById('event-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('event-form-error');
  errEl.textContent = '';
  const title    = document.getElementById('ef-title').value.trim();
  const date     = document.getElementById('ef-date').value;
  const time     = document.getElementById('ef-time').value || null;
  const location = document.getElementById('ef-location').value.trim() || null;
  const attendee = document.getElementById('ef-attendee').value.trim() || null;
  const end_time = document.getElementById('ef-end-time').value || null;
  if (!title) { errEl.textContent = 'Title is required.'; document.getElementById('ef-title').focus(); return; }
  if (!date)  { errEl.textContent = 'Date is required.';  document.getElementById('ef-date').focus();  return; }
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const payload = { user_id: state.user.id, title, date, time, end_time, location, attendee };
    if (editingEventId) {
      const { data, error } = await updateEvent(editingEventId, payload);
      if (error) throw new Error(error.message || 'Could not save changes.');
      state.events = state.events.map(ev => ev.id === data.id ? data : ev);
      eventModal.close();
      renderCalendar(state.currentYear, state.currentMonth, state.events);
      if (state.selectedDate) renderDayDetail(state.selectedDate, state.events);
      showToast('Event updated.', { type: 'success' });
    } else {
      const { data, error } = await createEvent(payload);
      if (error) throw new Error(error.message || 'Could not create event.');
      state.events.push(data);
      eventModal.close();
      renderCalendar(state.currentYear, state.currentMonth, state.events);
      if (state.selectedDate === data.date) renderDayDetail(state.selectedDate, state.events);
      showToast('Event created.', { type: 'success' });
    }
  } catch (err) {
    console.error('Save error:', err);
    errEl.textContent = err.message || 'Could not save event.';
  } finally {
    submitBtn.disabled = false;
  }
});

// â”€â”€ To-Do list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderTodos(todos) {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';
  const sorted = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
  sorted.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' completed' : '');
    li.dataset.todoId = todo.id;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!todo.completed;
    checkbox.setAttribute('aria-label', 'Mark complete');
    const titleSpan = document.createElement('span');
    titleSpan.className = 'todo-title';
    titleSpan.textContent = todo.title;
    li.appendChild(checkbox);
    li.appendChild(titleSpan);
    if (todo.due_date) {
      const badge = document.createElement('span');
      badge.className = 'todo-due';
      badge.textContent = 'due ' + toDisplayDate(todo.due_date).replace(/,\s*\d{4}$/, '');
      li.appendChild(badge);
    }
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-todo';
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', 'Delete task');
    delBtn.textContent = '\u00d7';
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

document.getElementById('todo-form').addEventListener('submit', async e => {
  e.preventDefault();
  const titleInput = document.getElementById('todo-title');
  const dueInput   = document.getElementById('todo-due');
  const title = titleInput.value.trim();
  if (!title) { showToast('Task title is required.', { type: 'warning' }); return; }
  const payload = { user_id: state.user.id, title, due_date: dueInput.value || null };
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const { data, error } = await createTodo(payload);
  submitBtn.disabled = false;
  if (error) { showToast('Could not save task.', { type: 'error' }); return; }
  state.todos.push(data);
  titleInput.value = '';
  dueInput.value = '';
  renderTodos(state.todos);
});

document.getElementById('todo-list').addEventListener('change', async e => {
  const checkbox = e.target;
  if (checkbox.type !== 'checkbox') return;
  const li = checkbox.closest('.todo-item');
  if (!li) return;
  const id = li.dataset.todoId;
  const newCompleted = checkbox.checked;
  const prevState = [...state.todos];
  state.todos = state.todos.map(t => t.id === id ? Object.assign({}, t, { completed: newCompleted }) : t);
  renderTodos(state.todos);
  const { error } = await updateTodo(id, { completed: newCompleted });
  if (error) { state.todos = prevState; renderTodos(state.todos); showToast('Could not update task.', { type: 'error' }); }
});

document.getElementById('todo-list').addEventListener('click', async e => {
  const btn = e.target.closest('.btn-delete-todo');
  if (!btn) return;
  const li = btn.closest('.todo-item');
  if (!li) return;
  const id = li.dataset.todoId;
  const { error } = await deleteTodo(id);
  if (error) { showToast('Could not delete task.', { type: 'error' }); return; }
  state.todos = state.todos.filter(t => t.id !== id);
  renderTodos(state.todos);
});

// â”€â”€ Screenshot upload flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'];

document.getElementById('btn-upload-screenshot').addEventListener('click', () => {
  document.getElementById('screenshot-input').click();
});

document.getElementById('screenshot-input').addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    showToast('Unsupported file type. Use PNG, JPG, WEBP, or HEIC.', { type: 'warning' });
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = loadEvent => {
    const dataUrl = loadEvent.target.result;
    const comma = dataUrl.indexOf(',');
    screenshotBase64 = dataUrl.slice(comma + 1);
    const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
    screenshotMime = mimeMatch ? mimeMatch[1] : file.type;
    document.getElementById('screenshot-preview').src = dataUrl;
    document.getElementById('screenshot-status').textContent = file.name;
    document.getElementById('btn-analyse').disabled = false;
    document.getElementById('screenshot-modal').showModal();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

function closeScreenshotModal() {
  document.getElementById('screenshot-modal').close();
  document.getElementById('screenshot-preview').src = '';
  document.getElementById('screenshot-status').textContent = '';
  screenshotBase64 = null;
  screenshotMime   = null;
}

document.getElementById('btn-screenshot-cancel').addEventListener('click', closeScreenshotModal);
document.getElementById('screenshot-modal').addEventListener('cancel', closeScreenshotModal);

document.getElementById('btn-analyse').addEventListener('click', async () => {
  if (!screenshotBase64 || !screenshotMime) return;
  const statusEl   = document.getElementById('screenshot-status');
  const analyseBtn = document.getElementById('btn-analyse');
  const modal      = document.getElementById('screenshot-modal');
  statusEl.textContent = 'Analysingâ€¦';
  analyseBtn.disabled = true;
  try {
    const result = await extractEvent(screenshotBase64, screenshotMime);
    if (result === null) {
      statusEl.textContent = 'No meeting found in this image.';
      analyseBtn.disabled = false;
    } else {
      modal.close();
      screenshotBase64 = null;
      screenshotMime   = null;
      eventModal.open(null); eventModal.prefill(result);
    }
  } catch (err) {
    console.error('extractEvent error:', err);
    statusEl.textContent = 'Analysis failed. Please retry.';
    analyseBtn.disabled = false;
    showToast('Analysis failed. Please retry.', { type: 'error', onRetry: () => document.getElementById('btn-analyse').click() });
  }
});

// â”€â”€ Realtime sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initRealtime(userId) {
  subscribeToEvents(userId, {
    onInsert: event => {
      if (!state.events.find(e => e.id === event.id)) state.events.push(event);
      renderCalendar(state.currentYear, state.currentMonth, state.events);
      if (state.selectedDate === event.date) renderDayDetail(state.selectedDate, state.events);
    },
    onUpdate: event => {
      state.events = state.events.map(e => e.id === event.id ? event : e);
      renderCalendar(state.currentYear, state.currentMonth, state.events);
      if (state.selectedDate) renderDayDetail(state.selectedDate, state.events);
    },
    onDelete: event => {
      state.events = state.events.filter(e => e.id !== event.id);
      renderCalendar(state.currentYear, state.currentMonth, state.events);
      if (state.selectedDate) renderDayDetail(state.selectedDate, state.events);
    },
  });
  subscribeToTodos(userId, {
    onInsert: todo => {
      if (!state.todos.find(t => t.id === todo.id)) state.todos.push(todo);
      renderTodos(state.todos);
    },
    onUpdate: todo => {
      state.todos = state.todos.map(t => t.id === todo.id ? todo : t);
      renderTodos(state.todos);
    },
    onDelete: todo => {
      state.todos = state.todos.filter(t => t.id !== todo.id);
      renderTodos(state.todos);
    },
  });
}

// â”€â”€ Offline / online detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.addEventListener('offline', () => {
  showToast('You are offline. Changes will not save.', { type: 'warning', persistent: true });
});

window.addEventListener('online', () => {
  dismissPersistentToasts();
  refreshData();
});

async function refreshData() {
  if (!state.user) return;
  const [evResult, todResult] = await Promise.all([fetchEvents(state.user.id), fetchTodos(state.user.id)]);
  if (!evResult.error) {
    state.events = evResult.data || [];
    renderCalendar(state.currentYear, state.currentMonth, state.events);
    if (state.selectedDate) renderDayDetail(state.selectedDate, state.events);
  }
  if (!todResult.error) {
    state.todos = todResult.data || [];
    renderTodos(state.todos);
  }
  showToast('Back online. Data refreshed.', { type: 'success' });
}






