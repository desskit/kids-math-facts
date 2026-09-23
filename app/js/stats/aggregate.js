// Pure stats functions over stored sessions and answers.

const DAY_MS = 86400000;

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(ts) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayIndex(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Current and best streak of consecutive practice days. */
export function streaks(timestamps, now = Date.now()) {
  const days = [...new Set(timestamps.map(dayKey))].map(dayIndex).sort((a, b) => a - b);
  if (!days.length) return { current: 0, best: 0 };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = dayIndex(dayKey(now));
  const last = days[days.length - 1];
  // A streak is still alive if there was practice today or yesterday.
  const current = last === today || last === today - 1 ? run : 0;
  return { current, best };
}

export function totals(answers) {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const ms = answers.reduce((s, a) => s + a.ms, 0);
  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    avgMs: total ? ms / total : 0,
    days: new Set(answers.map((a) => dayKey(a.ts))).size,
  };
}

/** One row per day with activity, oldest first. */
export function dailySeries(answers) {
  const map = new Map();
  for (const a of answers) {
    const k = dayKey(a.ts);
    const row = map.get(k) || { day: k, total: 0, correct: 0, ms: 0 };
    row.total++;
    row.correct += a.correct ? 1 : 0;
    row.ms += a.ms;
    map.set(k, row);
  }
  return [...map.values()]
    .sort((a, b) => (a.day < b.day ? -1 : 1))
    .map((r) => ({ day: r.day, total: r.total, correct: r.correct, accuracy: r.correct / r.total, avgMs: r.ms / r.total }));
}

function groupBy(answers, keyFn) {
  const map = new Map();
  for (const a of answers) {
    const k = keyFn(a);
    const row = map.get(k) || { key: k, total: 0, correct: 0, ms: 0, lastTs: 0 };
    row.total++;
    row.correct += a.correct ? 1 : 0;
    row.ms += a.ms;
    row.lastTs = Math.max(row.lastTs, a.ts);
    map.set(k, row);
  }
  return [...map.values()].map((r) => ({
    ...r,
    missed: r.total - r.correct,
    accuracy: r.correct / r.total,
    avgMs: r.ms / r.total,
  }));
}

export function bySkill(answers) {
  return groupBy(answers, (a) => a.skillId).sort((a, b) => b.lastTs - a.lastTs);
}

export function byFact(answers) {
  return groupBy(answers, (a) => a.factKey);
}

/** Facts and problem types missed most often (and most recently struggling). */
export function troubleSpots(answers, limit = 10) {
  return byFact(answers)
    .filter((r) => r.missed > 0)
    .sort((a, b) => b.missed - a.missed || a.accuracy - b.accuracy || b.lastTs - a.lastTs)
    .slice(0, limit);
}

/** Stable identity for "the same kind of round", used for personal bests. */
export function roundKey(session) {
  const c = session.config || {};
  const length = c.mode === 'timed' ? `${c.seconds}s` : `${c.count}q`;
  const base = session.presetId || JSON.stringify(c.skills || []);
  return `${c.mode}|${length}|${base}`;
}

/** Is `a` a better result than `b` for the same kind of round? */
export function better(a, b) {
  if (!b) return true;
  if (a.config.mode === 'timed') return a.correct > b.correct;
  const accA = a.total ? a.correct / a.total : 0;
  const accB = b.total ? b.correct / b.total : 0;
  if (accA !== accB) return accA > accB;
  return a.elapsedMs < b.elapsedMs;
}

/** Best completed session per kind of round. */
export function personalBests(sessions) {
  const best = new Map();
  for (const s of sessions) {
    if (s.status !== 'complete' || !s.total) continue;
    const k = roundKey(s);
    if (better(s, best.get(k))) best.set(k, s);
  }
  return best;
}

/** Whether a just-finished session beats every earlier one of its kind. */
export function isPersonalBest(session, earlier) {
  if (session.status !== 'complete' || !session.total) return false;
  const k = roundKey(session);
  const prior = earlier.filter((s) => s.id !== session.id && s.status === 'complete' && roundKey(s) === k);
  if (!prior.length) return false; // first try isn't a "record" yet
  return prior.every((p) => better(session, p));
}

/** Filter answers or sessions to a time range. `days` = null means all time. */
export function sinceDays(items, days, now = Date.now(), field = 'ts') {
  if (!days) return items;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime() - (days - 1) * DAY_MS;
  return items.filter((x) => x[field] >= from);
}
