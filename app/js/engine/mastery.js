// Fact mastery: a status for each factKey from its recent attempts, and
// weighted selection that favors what still needs practice.
//
// A fact stat looks like { attempts, correct, recent: [{ c: 0|1, ms }] }
// where `recent` holds the latest attempts, oldest first.

export const STATUSES = ['new', 'struggling', 'learning', 'mastered'];

export const STATUS_LABELS = {
  new: 'Not tried yet',
  struggling: 'Needs work',
  learning: 'Learning',
  mastered: 'Mastered',
};

const WEIGHTS = { new: 3, struggling: 6, learning: 4, mastered: 0.5 };

export const RECENT_LIMIT = 10;

export function factStatus(stat, fluencyMs) {
  if (!stat || !stat.attempts || !stat.recent || !stat.recent.length) return 'new';
  const last5 = stat.recent.slice(-5);
  const acc = last5.reduce((s, r) => s + r.c, 0) / last5.length;
  if (acc < 0.6) return 'struggling';
  const last3 = stat.recent.slice(-3);
  if (last3.length === 3 && last3.every((r) => r.c && r.ms <= fluencyMs)) return 'mastered';
  return 'learning';
}

export function median(values) {
  if (!values.length) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function factWeight(stat, fluencyMs) {
  const status = factStatus(stat, fluencyMs);
  let w = WEIGHTS[status];
  if (status === 'learning') {
    // Correct but slow facts get a little extra practice.
    const times = stat.recent.slice(-3).filter((r) => r.c).map((r) => r.ms);
    if (times.length && median(times) > fluencyMs) w += 1;
  }
  return w;
}

/** Return a new stat with one attempt added. */
export function addAttempt(stat, correct, ms, ts = Date.now()) {
  const base = stat || { attempts: 0, correct: 0, totalMs: 0, recent: [] };
  const recent = base.recent.concat([{ c: correct ? 1 : 0, ms: Math.round(ms) }]).slice(-RECENT_LIMIT);
  return {
    ...base,
    attempts: base.attempts + 1,
    correct: base.correct + (correct ? 1 : 0),
    totalMs: (base.totalMs || 0) + Math.round(ms),
    lastTs: ts,
    recent,
  };
}

/**
 * Choose one candidate { key, fluencyMs, ... } weighted by need.
 * `avoid` holds keys used very recently so the same fact doesn't repeat back to back.
 */
export function pickCandidate(rng, candidates, stats, avoid = []) {
  let pool = candidates.filter((c) => !avoid.includes(c.key));
  if (!pool.length) pool = candidates;
  const weights = pool.map((c) => factWeight(stats[c.key], c.fluencyMs));
  return rng.weighted(pool, weights);
}

/** Count statuses across a set of keys. */
export function summarize(keys, stats, fluencyMs) {
  const out = { new: 0, struggling: 0, learning: 0, mastered: 0 };
  for (const k of keys) out[factStatus(stats[k], fluencyMs)]++;
  return out;
}
