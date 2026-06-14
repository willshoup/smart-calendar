/**
 * supabase-client.js
 * Supabase JS SDK wrapper â€” auth, database, realtime
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/** @type {import('@supabase/supabase-js').SupabaseClient|null} */
let supabase = null;

/** @type {Array} Realtime channel references for cleanup */
const channels = [];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Initialisation
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Reads credentials from localStorage and creates the Supabase client.
 * Must be called before any other exported function.
 */
export function initSupabase() {
  const url = localStorage.getItem('sc_supabase_url');
  const key = localStorage.getItem('sc_supabase_anon_key');
  if (!url || !key) {
    console.error('initSupabase: missing url or anon key in localStorage');
    return;
  }
  supabase = createClient(url, key);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Auth
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Sign in with email + password.
 * @returns {{ data: any, error: any }}
 */
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Create a new account with email + password.
 * @returns {{ data: any, error: any }}
 */
export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

/**
 * Sign the current user out.
 * @returns {{ error: any }}
 */
export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Get the currently active session (synchronous accessor).
 * @returns {import('@supabase/supabase-js').Session|null}
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

/**
 * Register a callback for auth state changes.
 * @param {(event: string, session: any) => void} callback
 */
export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange(callback);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Events CRUD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Fetch all events for a user, ordered by date then time.
 * @param {string} userId
 * @returns {{ data: Event[], error: any }}
 */
export async function fetchEvents(userId) {
  return supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('date')
    .order('time', { nullsFirst: false });
}

/**
 * Insert a new event.
 * @param {object} payload - { user_id, title, date, time?, location?, attendee? }
 * @returns {{ data: Event, error: any }}
 */
export async function createEvent(payload) {
  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

/**
 * Update an existing event by id.
 * @param {string} id
 * @param {object} payload
 * @returns {{ data: Event, error: any }}
 */
export async function updateEvent(id, payload) {
  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

/**
 * Delete an event by id.
 * @param {string} id
 * @returns {{ error: any }}
 */
export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  return { error };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Todos CRUD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Fetch all todos for a user.
 * Order: incomplete first, then due_date asc (nulls last), then created_at asc.
 * @param {string} userId
 * @returns {{ data: Todo[], error: any }}
 */
export async function fetchTodos(userId) {
  return supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
}

/**
 * Insert a new todo.
 * @param {object} payload - { user_id, title, due_date? }
 * @returns {{ data: Todo, error: any }}
 */
export async function createTodo(payload) {
  const { data, error } = await supabase
    .from('todos')
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

/**
 * Update a todo by id.
 * @param {string} id
 * @param {object} payload
 * @returns {{ data: Todo, error: any }}
 */
export async function updateTodo(id, payload) {
  const { data, error } = await supabase
    .from('todos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

/**
 * Delete a todo by id.
 * @param {string} id
 * @returns {{ error: any }}
 */
export async function deleteTodo(id) {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  return { error };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Realtime subscriptions
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Subscribe to INSERT/UPDATE/DELETE changes on the events table for a user.
 * Automatically retries on CHANNEL_ERROR after 3 seconds.
 *
 * @param {string} userId
 * @param {{ onInsert: Function, onUpdate: Function, onDelete: Function }} handlers
 */
export function subscribeToEvents(userId, { onInsert, onUpdate, onDelete }) {
  const ch = supabase
    .channel(`events:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events', filter: `user_id=eq.${userId}` },
      payload => onInsert(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events', filter: `user_id=eq.${userId}` },
      payload => onUpdate(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'events', filter: `user_id=eq.${userId}` },
      payload => onDelete(payload.old)
    )
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('events channel error â€” retrying in 3s');
        setTimeout(() => subscribeToEvents(userId, { onInsert, onUpdate, onDelete }), 3000);
      }
    });
  channels.push(ch);
}

/**
 * Subscribe to INSERT/UPDATE/DELETE changes on the todos table for a user.
 *
 * @param {string} userId
 * @param {{ onInsert: Function, onUpdate: Function, onDelete: Function }} handlers
 */
export function subscribeToTodos(userId, { onInsert, onUpdate, onDelete }) {
  const ch = supabase
    .channel(`todos:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
      payload => onInsert(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
      payload => onUpdate(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
      payload => onDelete(payload.old)
    )
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('todos channel error â€” retrying in 3s');
        setTimeout(() => subscribeToTodos(userId, { onInsert, onUpdate, onDelete }), 3000);
      }
    });
  channels.push(ch);
}

/**
 * Remove all active realtime channels and clear the reference array.
 */
export function unsubscribeAll() {
  channels.forEach(ch => {
    try { supabase.removeChannel(ch); } catch (_) { /* ignore */ }
  });
  channels.length = 0;
}

