import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Round } from '../app/js/engine/round.js';
import { factStatus, factWeight, addAttempt, summarize } from '../app/js/engine/mastery.js';
import { createRng } from '../app/js/lib/rng.js';
import { streaks, dailySeries, totals, troubleSpots, isPersonalBest, personalBests, dayKey, sinceDays } from '../app/js/stats/aggregate.js';

function fakeClock(start = 1_000_000) {
  let t = start;
  const now = () => t;
  now.tick = (ms) => (t += ms);
  return now;
}

const right = (p) => {
  switch (p.answerType) {
    case 'remainder':
      return { q: String(p.answer.q), r: String(p.answer.r) };
    case 'fraction': {
      const { n, d } = p.answer;
      if (p.form === 'mixed' && n > d) {
        const w = Math.floor(n / d);
        return n % d ? { w: String(w), n: String(n % d), d: String(d) } : { w: String(w) };
      }
      return { n: String(n), d: String(d) };
    }
    default:
      return { v: String(p.answer) };
  }
};
const wrong = () => ({ v: '99999' });

const timesConfig = (mode, extra = {}) => ({
  mode,
  count: 10,
  seconds: 60,
  skills: [{ id: 'mul-facts', options: { tables: [7], max: 12 } }],
  ...extra,
});

test('count round: ends after N answers and times each question', () => {
  const now = fakeClock();
  const r = new Round(timesConfig('count'), { rng: createRng(1), now });
  let p = r.start();
  let n = 0;
  while (p) {
    now.tick(2000);
    const res = r.submit(right(p));
    assert.ok(res.correct);
    assert.equal(res.ms, 2000);
    n++;
    p = r.advance();
  }
  assert.equal(n, 10);
  const s = r.summary();
  assert.equal(s.total, 10);
  assert.equal(s.correct, 10);
  assert.equal(s.avgMs, 2000);
  assert.equal(s.elapsedMs, 20000);
});

test('count round with retryMissed asks missed problems again, unscored', () => {
  const now = fakeClock();
  const r = new Round(timesConfig('count', { count: 5, retryMissed: true }), { rng: createRng(2), now });
  let p = r.start();
  const missedTexts = [];
  let i = 0;
  while (p) {
    now.tick(1000);
    if (i < 2) {
      missedTexts.push(p.text);
      r.submit(wrong());
    } else {
      r.submit(right(p));
    }
    i++;
    p = r.advance();
  }
  assert.equal(r.answers.length, 7);
  assert.deepEqual(r.answers.slice(5).map((a) => a.problem.text), missedTexts);
  assert.ok(r.answers.slice(5).every((a) => a.retry));
  assert.equal(r.summary().total, 5);
  assert.equal(r.summary().correct, 3);
});

test('timed round ends when time runs out; pauses do not count', () => {
  const now = fakeClock();
  const r = new Round(timesConfig('timed', { seconds: 10 }), { rng: createRng(3), now });
  let p = r.start();
  now.tick(3000);
  r.submit(right(p));
  p = r.advance();
  r.pause();
  now.tick(60000);
  r.resume();
  assert.equal(r.remainingMs(), 7000);
  now.tick(4000);
  const res = r.submit(right(p));
  assert.equal(res.ms, 4000);
  p = r.advance();
  assert.ok(p);
  now.tick(3000);
  assert.ok(r.timeUp());
  assert.equal(r.advance(), null);
  assert.ok(r.finished);
  assert.equal(r.summary().total, 2);
});

test('mastery round repeats a missed problem a few questions later until correct', () => {
  const now = fakeClock();
  const r = new Round(timesConfig('mastery', { count: 8 }), { rng: createRng(4), now });
  let p = r.start();
  const missed = p.text;
  r.submit(wrong());
  let seenAgain = 0;
  let steps = 0;
  p = r.advance();
  while (p) {
    now.tick(1000);
    if (p.text === missed) seenAgain++;
    r.submit(right(p));
    steps++;
    p = r.advance();
  }
  assert.equal(seenAgain, 1);
  assert.equal(r.summary().total, 8);
  assert.equal(r.answers.length, 9);
  assert.ok(r.answers.find((a) => a.problem.text === missed && a.repeat && a.correct));
});

test('mastery selection favors struggling facts over mastered ones', () => {
  const now = fakeClock();
  const stats = {};
  const skill = { id: 'mul-facts', options: { tables: [3], max: 3 } };
  // Master every fact except 3x3.
  for (const k of ['mul:3x0', 'mul:0x3', 'mul:3x1', 'mul:1x3', 'mul:3x2', 'mul:2x3']) {
    let s;
    for (let i = 0; i < 3; i++) s = addAttempt(s, true, 1000);
    stats[k] = s;
  }
  stats['mul:3x3'] = addAttempt(addAttempt(undefined, false, 5000), false, 5000);
  const counts = {};
  for (let seed = 0; seed < 200; seed++) {
    const r = new Round({ mode: 'mastery', count: 1, skills: [skill] }, { rng: createRng(seed), now, factStats: stats });
    const p = r.start();
    counts[p.factKey] = (counts[p.factKey] || 0) + 1;
  }
  assert.ok(counts['mul:3x3'] > 100, JSON.stringify(counts));
});

test('fact status rules', () => {
  const goal = 3000;
  assert.equal(factStatus(undefined, goal), 'new');
  let s = addAttempt(undefined, false, 2000);
  assert.equal(factStatus(s, goal), 'struggling');
  s = addAttempt(addAttempt(addAttempt(s, true, 2000), true, 2000), true, 2000);
  assert.equal(factStatus(s, goal), 'mastered');
  s = addAttempt(s, true, 9000);
  assert.equal(factStatus(s, goal), 'learning');
  assert.ok(factWeight(s, goal) > factWeight(addAttempt(addAttempt(addAttempt(s, true, 1), true, 1), true, 1), goal));
  assert.deepEqual(summarize(['a', 'b'], { a: s }, goal), { new: 1, struggling: 0, learning: 1, mastered: 0 });
  // recent history is capped
  for (let i = 0; i < 30; i++) s = addAttempt(s, true, 1000);
  assert.equal(s.recent.length, 10);
  assert.equal(s.attempts, 35);
});

test('streaks count consecutive local days', () => {
  const day = (offset, h = 12) => {
    const d = new Date(2026, 8, 20 + offset, h);
    return d.getTime();
  };
  const now = day(0);
  assert.deepEqual(streaks([], now), { current: 0, best: 0 });
  assert.deepEqual(streaks([day(0), day(-1), day(-1, 8), day(-2), day(-5), day(-6)], now), { current: 3, best: 3 });
  assert.deepEqual(streaks([day(-1), day(-2)], now), { current: 2, best: 2 });
  assert.deepEqual(streaks([day(-3), day(-4), day(-5), day(-6)], now), { current: 0, best: 4 });
  // month boundary
  assert.deepEqual(streaks([new Date(2026, 8, 30).getTime(), new Date(2026, 9, 1).getTime()], new Date(2026, 9, 1).getTime()), {
    current: 2,
    best: 2,
  });
});

test('daily series, totals, trouble spots', () => {
  const t0 = new Date(2026, 8, 1, 10).getTime();
  const answers = [
    { ts: t0, correct: true, ms: 1000, factKey: 'mul:7x8', skillId: 'mul-facts' },
    { ts: t0 + 1, correct: false, ms: 3000, factKey: 'mul:7x8', skillId: 'mul-facts' },
    { ts: t0 + 86400000, correct: false, ms: 2000, factKey: 'mul:6x7', skillId: 'mul-facts' },
    { ts: t0 + 86400000, correct: false, ms: 2000, factKey: 'mul:7x8', skillId: 'mul-facts' },
  ];
  const series = dailySeries(answers);
  assert.equal(series.length, 2);
  assert.equal(series[0].day, dayKey(t0));
  assert.equal(series[0].accuracy, 0.5);
  assert.equal(series[0].avgMs, 2000);
  const t = totals(answers);
  assert.equal(t.total, 4);
  assert.equal(t.days, 2);
  const spots = troubleSpots(answers);
  assert.equal(spots[0].key, 'mul:7x8');
  assert.equal(spots[0].missed, 2);
  assert.equal(sinceDays(answers, 1, t0 + 86400000).length, 2);
  assert.equal(sinceDays(answers, null).length, 4);
});

test('personal bests', () => {
  const cfg = { mode: 'timed', seconds: 60, skills: [{ id: 'mul-facts' }] };
  const mk = (id, correct, extra = {}) => ({ id, status: 'complete', config: cfg, presetId: 'p1', total: correct + 1, correct, elapsedMs: 60000, ...extra });
  const s1 = mk('a', 10);
  const s2 = mk('b', 12);
  assert.ok(!isPersonalBest(s1, [s1]), 'first round is not a record');
  assert.ok(isPersonalBest(s2, [s1, s2]));
  assert.ok(!isPersonalBest(mk('c', 12), [s1, s2]), 'a tie is not a new record');
  assert.ok(!isPersonalBest(mk('d', 20, { status: 'abandoned' }), [s1, s2]));
  const best = personalBests([s1, s2]);
  assert.equal([...best.values()][0].id, 'b');
});

test('fixed-problem round asks exactly those problems in order', () => {
  const now = fakeClock();
  const seed = new Round(timesConfig('count', { count: 3 }), { rng: createRng(5), now });
  const problems = [seed.start()];
  seed.submit(wrong());
  problems.push(seed.advance());
  const r = new Round({ fixed: problems, retryMissed: true }, { rng: createRng(6), now });
  const asked = [];
  let p = r.start();
  while (p) {
    asked.push(p.text);
    r.submit(right(p));
    p = r.advance();
  }
  assert.deepEqual(asked, problems.map((x) => x.text));
});

test('every built-in preset runs a full round', async () => {
  const { BUILT_IN_PRESETS } = await import('../app/js/engine/presets.js');
  for (const preset of BUILT_IN_PRESETS) {
    const now = fakeClock();
    const r = new Round(preset.config, { rng: createRng(7), now });
    let p = r.start();
    let guard = 0;
    while (p && guard++ < 500) {
      now.tick(1500);
      r.submit(right(p));
      p = r.advance();
    }
    assert.ok(r.finished, preset.name);
    assert.equal(r.summary().accuracy, 1, preset.name);
  }
});
