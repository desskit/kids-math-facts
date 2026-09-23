// App-level data API on top of IndexedDB.

import { transact, get, getAll, put, del, STORES } from './db.js';
import { addAttempt } from '../engine/mastery.js';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  playerName: '',
  sound: true,
  showTimer: true,
  theme: 'auto',
  factFluencySec: 3,
  lastBackupAt: null,
  firstRunAt: null,
};

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------------------------------------------------------------- settings

export async function getSettings() {
  const rows = await transact('settings', 'readonly', async (s, p) => {
    const [keys, values] = await Promise.all([p(s.settings.getAllKeys()), p(s.settings.getAll())]);
    return keys.map((k, i) => [k, values[i]]);
  });
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows) };
}

export function setSetting(key, value) {
  return put('settings', value, key);
}

// ---------------------------------------------------------------- presets

export async function listPresets() {
  const list = await getAll('presets');
  return list.sort((a, b) => (b.lastUsedAt || b.createdAt) - (a.lastUsedAt || a.createdAt));
}

export function savePreset(preset) {
  return put('presets', { createdAt: Date.now(), ...preset });
}

export function deletePreset(id) {
  return del('presets', id);
}

export async function touchPreset(id) {
  const p = await get('presets', id);
  if (p) await put('presets', { ...p, lastUsedAt: Date.now() });
}

// ---------------------------------------------------------------- sessions & answers

export function saveSession(session) {
  return put('sessions', session);
}

export async function listSessions() {
  const list = await getAll('sessions');
  return list.sort((a, b) => b.startedAt - a.startedAt);
}

export function getSession(id) {
  return get('sessions', id);
}

export async function answersForSession(id) {
  const list = await getAll('answers', 'sessionId', IDBKeyRange.only(id));
  return list.sort((a, b) => a.ts - b.ts);
}

export function allAnswers() {
  return getAll('answers', 'ts');
}

/** Save one answer and update its fact's running stats in the same transaction. */
export function saveAnswer(answer) {
  return transact(['answers', 'factStats'], 'readwrite', async (s, p) => {
    s.answers.put(answer);
    const prev = await p(s.factStats.get(answer.factKey));
    const next = addAttempt(prev, answer.correct, answer.ms, answer.ts);
    s.factStats.put({ ...next, factKey: answer.factKey, skillId: answer.skillId });
  });
}

export async function getFactStats() {
  const rows = await getAll('factStats');
  return Object.fromEntries(rows.map((r) => [r.factKey, r]));
}

/** Recompute every fact's stats from the full answer history. */
export async function rebuildFactStats() {
  const answers = await allAnswers();
  const stats = new Map();
  for (const a of answers) {
    const next = addAttempt(stats.get(a.factKey), a.correct, a.ms, a.ts);
    stats.set(a.factKey, { ...next, factKey: a.factKey, skillId: a.skillId });
  }
  await transact('factStats', 'readwrite', (s) => {
    s.factStats.clear();
    for (const v of stats.values()) s.factStats.put(v);
  });
}

// ---------------------------------------------------------------- backup

export async function exportAll() {
  const [settings, presets, sessions, answers] = await Promise.all([
    getSettings(),
    getAll('presets'),
    getAll('sessions'),
    getAll('answers'),
  ]);
  return {
    app: 'kids-math-facts',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { settings, presets, sessions, answers },
  };
}

export function validateBackup(obj) {
  if (!obj || obj.app !== 'kids-math-facts' || !obj.data) return 'This file is not a Math Practice backup.';
  if (obj.schemaVersion > SCHEMA_VERSION) return 'This backup is from a newer version of the app. Update the app first.';
  const { sessions, answers } = obj.data;
  if (!Array.isArray(sessions) || !Array.isArray(answers)) return 'The backup file is missing its history.';
  return null;
}

/**
 * Merge a backup into the current data. Records with the same id are
 * replaced by the backup's copy, so importing the same file twice is harmless.
 */
export async function importAll(obj, { replace = false } = {}) {
  const err = validateBackup(obj);
  if (err) throw new Error(err);
  const { settings = {}, presets = [], sessions = [], answers = [] } = obj.data;
  await transact(STORES, 'readwrite', (s) => {
    if (replace) for (const name of STORES) s[name].clear();
    for (const [k, v] of Object.entries(settings)) {
      if (k in DEFAULT_SETTINGS && (replace || k !== 'lastBackupAt')) s.settings.put(v, k);
    }
    for (const p of presets) if (p && p.id) s.presets.put(p);
    for (const x of sessions) if (x && x.id) s.sessions.put(x);
    for (const a of answers) if (a && a.id && a.factKey) s.answers.put(a);
  });
  await rebuildFactStats();
  return { sessions: sessions.length, answers: answers.length };
}

export async function clearAll() {
  await transact(STORES, 'readwrite', (s) => {
    for (const name of STORES) s[name].clear();
  });
}
