// Basic facts: + − × ÷. These have a finite set of facts, so they support
// fact-by-fact mastery tracking and heatmaps.

import { num, op, blank, row, range, TIMES, DIVIDE, MINUS, withDefaults, chooseKey } from './common.js';

const TABLES = range(0, 12).map((v) => ({ value: v, label: String(v) }));
const DIVISORS = range(1, 12).map((v) => ({ value: v, label: String(v) }));

const cache = new Map();
function memo(id, opts, build) {
  const k = id + JSON.stringify(opts);
  if (!cache.has(k)) cache.set(k, build());
  return cache.get(k);
}

function intProblem(key, tokens, answer) {
  return { factKey: key, display: row(...tokens), answerType: 'int', answer, slots: ['v'] };
}

const addOptions = [
  {
    key: 'max',
    label: 'Largest number to add',
    type: 'select',
    options: [5, 10, 12, 20].map((v) => ({ value: v, label: `0–${v}` })),
    default: 10,
  },
];

export const addFacts = {
  id: 'add-facts',
  label: 'Addition facts',
  category: 'facts',
  grade: 'K–2',
  finite: true,
  fluencyMs: 3000,
  options: addOptions,
  keys(o) {
    const { max } = withDefaults(addOptions, o);
    return memo(this.id, { max }, () =>
      range(0, max).flatMap((a) => range(0, max).map((b) => `add:${a}+${b}`)),
    );
  },
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    const [a, b] = k.slice(4).split('+').map(Number);
    return intProblem(k, [num(a), op('+'), num(b), op('='), blank()], a + b);
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

export const subFacts = {
  id: 'sub-facts',
  label: 'Subtraction facts',
  category: 'facts',
  grade: 'K–2',
  finite: true,
  fluencyMs: 3000,
  options: addOptions,
  keys(o) {
    const { max } = withDefaults(addOptions, o);
    // Inverse of the addition facts: (a + b) − b = a
    return memo(this.id, { max }, () =>
      range(0, max).flatMap((a) => range(0, max).map((b) => `sub:${a + b}-${b}`)),
    );
  },
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    const [m, s] = k.slice(4).split('-').map(Number);
    return intProblem(k, [num(m), op(MINUS), num(s), op('='), blank()], m - s);
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

const mulOptions = [
  {
    key: 'tables',
    label: 'Times tables',
    type: 'multi',
    options: TABLES,
    default: range(2, 12),
  },
  {
    key: 'max',
    label: 'Multiply by up to',
    type: 'select',
    options: [10, 12].map((v) => ({ value: v, label: String(v) })),
    default: 12,
  },
];

export const mulFacts = {
  id: 'mul-facts',
  label: 'Multiplication facts',
  category: 'facts',
  grade: '3–4',
  finite: true,
  fluencyMs: 3000,
  options: mulOptions,
  keys(o) {
    const { tables, max } = withDefaults(mulOptions, o);
    return memo(this.id, { tables, max }, () => {
      const set = new Set();
      for (const t of tables.length ? tables : [2]) {
        for (let x = 0; x <= max; x++) {
          set.add(`mul:${t}x${x}`);
          set.add(`mul:${x}x${t}`);
        }
      }
      return [...set];
    });
  },
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    const [a, b] = k.slice(4).split('x').map(Number);
    return intProblem(k, [num(a), op(TIMES), num(b), op('='), blank()], a * b);
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

const divOptions = [
  {
    key: 'divisors',
    label: 'Divide by',
    type: 'multi',
    options: DIVISORS,
    default: range(2, 12),
  },
  {
    key: 'max',
    label: 'Answers up to',
    type: 'select',
    options: [10, 12].map((v) => ({ value: v, label: String(v) })),
    default: 12,
  },
];

export const divFacts = {
  id: 'div-facts',
  label: 'Division facts',
  category: 'facts',
  grade: '3–4',
  finite: true,
  fluencyMs: 3000,
  options: divOptions,
  keys(o) {
    const { divisors, max } = withDefaults(divOptions, o);
    return memo(this.id, { divisors, max }, () =>
      (divisors.length ? divisors : [2])
        .filter((d) => d > 0)
        .flatMap((d) => range(0, max).map((q) => `div:${d * q}/${d}`)),
    );
  },
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    const [n, d] = k.slice(4).split('/').map(Number);
    return intProblem(k, [num(n), op(DIVIDE), num(d), op('='), blank()], n / d);
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
