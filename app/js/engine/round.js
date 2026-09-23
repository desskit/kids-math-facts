// The round state machine. It knows nothing about the DOM or storage, so it
// can be tested with a fake clock.
//
// config = {
//   mode: 'count' | 'timed' | 'mastery',
//   count: 20,             // questions (count and mastery modes)
//   seconds: 120,          // length of a timed sprint
//   skills: [{ id, options }],
//   retryMissed: true,     // count mode: ask missed problems again at the end
// }

import { makeProblem, getSkill } from '../skills/index.js';
import { checkAnswer, isComplete, formatAnswer } from './answer.js';
import { addAttempt, pickCandidate } from './mastery.js';

const REQUEUE_GAP = 3;

export function fluencyFor(skill, factFluencyMs) {
  return skill.finite && factFluencyMs ? factFluencyMs : skill.fluencyMs || 10000;
}

export class Round {
  constructor(config, { rng, now = () => Date.now(), factStats = {}, factFluencyMs = 3000 } = {}) {
    const hasFixed = Array.isArray(config.fixed) && config.fixed.length > 0;
    if (!hasFixed && (!config.skills || !config.skills.length)) throw new Error('A round needs at least one skill');
    this.config = { count: 20, seconds: 120, retryMissed: false, ...config };
    if (hasFixed) {
      // A fixed list of problems (e.g. "practice missed"): asked in order, once each.
      this.config.mode = 'count';
      this.config.count = config.fixed.length;
      this.config.skills = [];
    }
    this.rng = rng;
    this.now = now;
    this.stats = { ...factStats };
    this.factFluencyMs = factFluencyMs;
    this.answers = [];
    this.requeue = []; // [{ problem, dueAt }] dueAt = number of answers before it's asked
    this.retryQueue = []; // count mode retries at the end
    this.recentKeys = [];
    this.seen = new Set();
    this.current = null;
    this.finished = false;
    this.startedAt = null;
    this.pausedAt = null;
    this.pausedTotal = 0;
    this.questionStart = 0;
    this.questionPaused = 0;
    this.inRetryPhase = false;

    if (this.config.mode === 'mastery') {
      this.candidates = this.config.skills.flatMap(({ id, options }) => {
        const skill = getSkill(id);
        const fluencyMs = fluencyFor(skill, factFluencyMs);
        return skill.keys(options || {}).map((key) => ({ skillId: id, options, key, fluencyMs }));
      });
    }
  }

  start() {
    this.startedAt = this.now();
    return this.advance();
  }

  /** Time spent in the round, not counting pauses. */
  elapsedMs() {
    if (this.startedAt === null) return 0;
    const end = this.pausedAt ?? this.endedAt ?? this.now();
    return Math.max(0, end - this.startedAt - this.pausedTotal);
  }

  remainingMs() {
    if (this.config.mode !== 'timed') return null;
    return Math.max(0, this.config.seconds * 1000 - this.elapsedMs());
  }

  pause() {
    if (this.pausedAt === null && !this.finished) this.pausedAt = this.now();
  }

  resume() {
    if (this.pausedAt !== null) {
      const d = this.now() - this.pausedAt;
      this.pausedTotal += d;
      this.questionPaused += d;
      this.pausedAt = null;
    }
  }

  get paused() {
    return this.pausedAt !== null;
  }

  /** Answers that count toward the score: first tries, not retries of missed problems. */
  get scored() {
    return this.answers.filter((a) => !a.retry && !a.repeat);
  }

  timeUp() {
    return this.config.mode === 'timed' && this.remainingMs() <= 0;
  }

  /** Submit the player's input for the current problem. */
  submit(given) {
    if (!this.current || this.finished) throw new Error('No active problem');
    const problem = this.current;
    const ms = Math.max(0, this.now() - this.questionStart - this.questionPaused);
    const { correct, note } = checkAnswer(problem, given);
    const record = {
      problem,
      given,
      correct,
      note: note || null,
      ms,
      ts: this.now(),
      retry: !!problem._retry,
      repeat: !!problem._repeat,
    };
    this.answers.push(record);
    this.stats[problem.factKey] = addAttempt(this.stats[problem.factKey], correct, ms, record.ts);

    if (!correct) {
      if (this.config.mode === 'mastery') {
        this.requeue.push({
          problem: { ...problem, _repeat: true },
          dueAt: this.answers.length + REQUEUE_GAP - 1,
        });
      } else if (this.config.mode === 'count' && this.config.retryMissed) {
        this.retryQueue.push({ ...problem, _retry: true });
      }
    }
    this.current = null;
    return { ...record, expected: formatAnswer(problem) };
  }

  canSubmit(given) {
    return !!this.current && isComplete(this.current, given);
  }

  isOver() {
    if (this.finished) return true;
    const { mode, count } = this.config;
    const n = this.scored.length;
    if (mode === 'timed') return this.timeUp();
    if (mode === 'count') return n >= count && !this.retryQueue.length;
    // mastery: finish the set, then clear any missed problems (with a safety cap)
    if (n >= count && !this.requeue.length) return true;
    return this.answers.length >= count * 2;
  }

  /** Move to the next problem. Returns it, or null when the round is over. */
  advance() {
    if (this.isOver()) return this.finish();
    const problem = this.pickNext();
    this.current = problem;
    this.questionStart = this.now();
    this.questionPaused = 0;
    this.recentKeys = [problem.factKey, ...this.recentKeys].slice(0, 2);
    return problem;
  }

  pickNext() {
    const { mode, count } = this.config;
    if (mode === 'count' && this.scored.length >= count && this.retryQueue.length) {
      this.inRetryPhase = true;
      return this.retryQueue.shift();
    }
    if (this.config.fixed) {
      const { _retry, _repeat, ...p } = this.config.fixed[this.scored.length];
      return p;
    }
    if (mode === 'mastery') {
      const dueIdx = this.requeue.findIndex((r) => r.dueAt <= this.answers.length);
      if (dueIdx >= 0) return this.requeue.splice(dueIdx, 1)[0].problem;
      if (this.scored.length >= count && this.requeue.length) {
        return this.requeue.shift().problem;
      }
      const c = pickCandidate(this.rng, this.candidates, this.stats, this.recentKeys);
      return this.fresh(() => makeProblem(c.skillId, c.options, this.rng, c.key));
    }
    const { id, options } = this.rng.pick(this.config.skills);
    return this.fresh(() => makeProblem(id, options, this.rng));
  }

  /** Generate a problem, avoiding exact repeats within the round when possible. */
  fresh(make) {
    let p;
    for (let i = 0; i < 12; i++) {
      p = make();
      if (!this.seen.has(p.text) && !this.recentKeys.includes(p.factKey)) break;
      if (!this.seen.has(p.text) && i >= 6) break;
    }
    this.seen.add(p.text);
    return p;
  }

  finish() {
    if (!this.finished) {
      if (this.pausedAt !== null) this.resume();
      this.endedAt = this.now();
      this.finished = true;
      this.current = null;
    }
    return null;
  }

  summary() {
    const scored = this.scored;
    const correct = scored.filter((a) => a.correct).length;
    const totalMs = scored.reduce((s, a) => s + a.ms, 0);
    return {
      total: scored.length,
      correct,
      accuracy: scored.length ? correct / scored.length : 0,
      avgMs: scored.length ? totalMs / scored.length : 0,
      elapsedMs: this.elapsedMs(),
      score: correct,
      missed: scored.filter((a) => !a.correct),
    };
  }
}
