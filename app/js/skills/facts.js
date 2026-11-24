// Basic facts: + − × ÷. These have a finite set of facts, so they support
// fact-by-fact mastery tracking and heatmaps.
//
// Each fact can be asked with the blank at the end (7 × 8 = ?) or as a
// missing number (7 × ? = 56). Both forms share the fact's key, so they
// count toward the same mastery square.

import { num, op, blank, row, range, TIMES, DIVIDE, MINUS, withDefaults, chooseKey } from './common.js';

const chipsFrom = (lo, hi) => range(lo, hi).map((v) => ({ value: v, label: String(v) }));

const cache = new Map();
function memo(id, opts, build) {
  const k = id + JSON.stringify(opts);
  if (!cache.has(k)) cache.set(k, build());
  return cache.get(k);
}

const rangeField = (key, label, max, def) => ({ key, label, type: 'range', min: 0, max, default: def });

const blankField = (atEnd, missing) => ({
  key: 'blank',
  label: 'Where the blank goes',
  type: 'select',
  options: [
    { value: 'end', label: atEnd },
    { value: 'missing', label: missing },
    { value: 'mix', label: 'Both' },
  ],
  default: 'end',
});

/** Options with defaults, after upgrading settings saved by older versions. */
function readOptions(skill, o) {
  return withDefaults(skill.options, skill.upgrade(o || {}));
}

/**
 * Build the problem for a fact.
 * forms.end: tokens with the answer blank; forms.missing: a list of
 * [tokens, answer] choices with an operand blank (empty when ambiguous).
 */
function factProblem(key, blankMode, rng, end, missing) {
  const useMissing =
    missing.length > 0 && (blankMode === 'missing' || (blankMode === 'mix' && rng.bool()));
  const [tokens, answer] = useMissing ? rng.pick(missing) : end;
  return { factKey: key, display: row(...tokens), answerType: 'int', answer, slots: ['v'] };
}

const EQ = () => op('=');

// ---------------------------------------------------------------- addition

export const addFacts = {
  id: 'add-facts',
  label: 'Addition facts',
  category: 'facts',
  grade: 'K–2',
  finite: true,
  fluencyMs: 3000,
  options: [
    rangeField('first', 'First number', 100, [0, 10]),
    rangeField('second', 'Second number', 100, [0, 10]),
    blankField('3 + 5 = ?', '3 + ? = 8'),
  ],
  upgrade(o) {
    // Before ranges there was a single "largest number" setting.
    if (o.max != null && o.first == null) return { ...o, first: [0, o.max], second: [0, o.max] };
    return o;
  },
  keys(o) {
    const { first, second } = readOptions(this, o);
    return memo(this.id, { first, second }, () =>
      range(...first).flatMap((a) => range(...second).map((b) => `add:${a}+${b}`)),
    );
  },
  generate(o, rng, key) {
    const { blank: mode } = readOptions(this, o);
    const k = chooseKey(rng, this.keys(o), key);
    const [a, b] = k.slice(4).split('+').map(Number);
    const c = a + b;
    return factProblem(k, mode, rng, [[num(a), op('+'), num(b), EQ(), blank()], c], [
      [[blank(), op('+'), num(b), EQ(), num(c)], a],
      [[num(a), op('+'), blank(), EQ(), num(c)], b],
    ]);
  },
  keyLabel: (k) => k.slice(4).replace('+', ' + '),
  grid: {
    op: '+',
    rows: 'First number',
    cols: 'Second number',
    start: 0,
    parse: (k) => k.slice(4).split('+').map(Number),
    keyAt: (r, c) => `add:${r}+${c}`,
  },
};

// ---------------------------------------------------------------- subtraction

export const subFacts = {
  id: 'sub-facts',
  label: 'Subtraction facts',
  category: 'facts',
  grade: 'K–2',
  finite: true,
  fluencyMs: 3000,
  options: [
    rangeField('taken', 'Number taken away', 100, [0, 10]),
    rangeField('answer', 'Answer', 100, [0, 10]),
    blankField('8 − 3 = ?', '8 − ? = 5'),
  ],
  upgrade(o) {
    if (o.max != null && o.taken == null) return { ...o, taken: [0, o.max], answer: [0, o.max] };
    return o;
  },
  keys(o) {
    const { taken, answer } = readOptions(this, o);
    // The inverse of addition: (d + s) − s = d
    return memo(this.id, { taken, answer }, () =>
      range(...taken).flatMap((s) => range(...answer).map((d) => `sub:${d + s}-${s}`)),
    );
  },
  generate(o, rng, key) {
    const { blank: mode } = readOptions(this, o);
    const k = chooseKey(rng, this.keys(o), key);
    const [m, s] = k.slice(4).split('-').map(Number);
    const d = m - s;
    return factProblem(k, mode, rng, [[num(m), op(MINUS), num(s), EQ(), blank()], d], [
      [[num(m), op(MINUS), blank(), EQ(), num(d)], s],
      [[blank(), op(MINUS), num(s), EQ(), num(d)], m],
    ]);
  },
  keyLabel: (k) => k.slice(4).replace('-', ` ${MINUS} `),
  // Grid rows: number subtracted; columns: the answer.
  grid: {
    op: MINUS,
    rows: 'Number taken away',
    cols: 'Answer',
    start: 0,
    keyAt: (r, c) => `sub:${r + c}-${r}`,
    parse: (k) => {
      const [m, s] = k.slice(4).split('-').map(Number);
      return [s, m - s];
    },
  },
};

// ---------------------------------------------------------------- multiplication

export const mulFacts = {
  id: 'mul-facts',
  label: 'Multiplication facts',
  category: 'facts',
  grade: '3–4',
  finite: true,
  fluencyMs: 3000,
  options: [
    { key: 'tables', label: 'Times tables', type: 'multi', options: chipsFrom(0, 20), default: range(2, 12) },
    rangeField('by', 'Multiplied by', 20, [0, 12]),
    blankField('7 × 8 = ?', '7 × ? = 56'),
  ],
  upgrade(o) {
    // Before ranges: "multiply by up to" (max).
    if (o.max != null && o.by == null) return { ...o, by: [0, o.max] };
    return o;
  },
  keys(o) {
    const { tables, by } = readOptions(this, o);
    return memo(this.id, { tables, by }, () => {
      const set = new Set();
      for (const t of tables.length ? tables : [2]) {
        for (const x of range(...by)) {
          set.add(`mul:${t}x${x}`);
          set.add(`mul:${x}x${t}`);
        }
      }
      return [...set];
    });
  },
  generate(o, rng, key) {
    const { blank: mode } = readOptions(this, o);
    const k = chooseKey(rng, this.keys(o), key);
    const [a, b] = k.slice(4).split('x').map(Number);
    const p = a * b;
    // "0 × ? = 0" has no single answer, so the blank only goes where it can be worked out.
    const missing = [];
    if (a !== 0) missing.push([[num(a), op(TIMES), blank(), EQ(), num(p)], b]);
    if (b !== 0) missing.push([[blank(), op(TIMES), num(b), EQ(), num(p)], a]);
    return factProblem(k, mode, rng, [[num(a), op(TIMES), num(b), EQ(), blank()], p], missing);
  },
  keyLabel: (k) => k.slice(4).replace('x', ` ${TIMES} `),
  grid: {
    op: TIMES,
    rows: 'First number',
    cols: 'Second number',
    start: 0,
    parse: (k) => k.slice(4).split('x').map(Number),
    keyAt: (r, c) => `mul:${r}x${c}`,
  },
};

// ---------------------------------------------------------------- division

export const divFacts = {
  id: 'div-facts',
  label: 'Division facts',
  category: 'facts',
  grade: '3–4',
  finite: true,
  fluencyMs: 3000,
  options: [
    { key: 'divisors', label: 'Divide by', type: 'multi', options: chipsFrom(1, 20), default: range(2, 12) },
    rangeField('answer', 'Answer', 20, [0, 12]),
    blankField('56 ÷ 8 = ?', '56 ÷ ? = 7'),
  ],
  upgrade(o) {
    // Before ranges: "answers up to" (max).
    if (o.max != null && o.answer == null) return { ...o, answer: [0, o.max] };
    return o;
  },
  keys(o) {
    const { divisors, answer } = readOptions(this, o);
    return memo(this.id, { divisors, answer }, () =>
      (divisors.length ? divisors : [2])
        .filter((d) => d > 0)
        .flatMap((d) => range(...answer).map((q) => `div:${d * q}/${d}`)),
    );
  },
  generate(o, rng, key) {
    const { blank: mode } = readOptions(this, o);
    const k = chooseKey(rng, this.keys(o), key);
    const [n, d] = k.slice(4).split('/').map(Number);
    const q = n / d;
    // "0 ÷ ? = 0" has no single answer.
    const missing = [[[blank(), op(DIVIDE), num(d), EQ(), num(q)], n]];
    if (q !== 0) missing.push([[num(n), op(DIVIDE), blank(), EQ(), num(q)], d]);
    return factProblem(k, mode, rng, [[num(n), op(DIVIDE), num(d), EQ(), blank()], q], missing);
  },
  keyLabel: (k) => k.slice(4).replace('/', ` ${DIVIDE} `),
  // Grid rows: divisor; columns: quotient.
  grid: {
    op: DIVIDE,
    rows: 'Divided by',
    cols: 'Answer',
    start: 1,
    keyAt: (r, c) => `div:${r * c}/${r}`,
    parse: (k) => {
      const [n, d] = k.slice(4).split('/').map(Number);
      return [d, n / d];
    },
  },
};

export default [addFacts, subFacts, mulFacts, divFacts];
