// Fractions (grades 3–5).

import { num, op, fr, blank, row, TIMES, MINUS, range, withDefaults, chooseKey, until } from './common.js';
import { gcd, lcm, frac, reduce, add, sub, mul, compare } from '../lib/fraction.js';
import { formatDecimal } from '../lib/decimal.js';

const ALL_DENS = [2, 3, 4, 5, 6, 8, 10, 12];

const densOption = {
  key: 'dens',
  label: 'Denominators',
  type: 'multi',
  options: ALL_DENS.map((v) => ({ value: v, label: String(v) })),
  default: [2, 3, 4, 5, 6, 8, 10, 12],
};

const simplestOption = (def = false) => ({
  key: 'simplest',
  label: 'Answers must be in simplest form',
  type: 'toggle',
  default: def,
});

function dens(o) {
  const list = (o.dens || []).filter((d) => ALL_DENS.includes(d));
  return list.length ? list : [2, 4];
}

/** A proper fraction a/d in lowest terms. */
function properLowest(rng, d) {
  const choices = range(1, d - 1).filter((a) => gcd(a, d) === 1);
  return frac(rng.pick(choices), d);
}

/** Any proper fraction a/d (not necessarily in lowest terms). */
function proper(rng, d) {
  return frac(rng.int(1, d - 1), d);
}

const fracAnswer = (value, slots, form) => ({
  answerType: 'fraction',
  answer: { n: value.n, d: value.d },
  slots,
  form: form || null,
});

// ---------------------------------------------------------------------------

const equivOptions = [densOption];

export const fracEquiv = {
  id: 'frac-equiv',
  label: 'Equivalent fractions',
  category: 'fractions',
  grade: '3–4',
  fluencyMs: 10000,
  options: equivOptions,
  keys: () => ['frac-equiv:numerator', 'frac-equiv:denominator'],
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    const d = rng.pick(dens(withDefaults(equivOptions, o)));
    const base = properLowest(rng, d);
    const m = rng.int(2, Math.max(2, Math.min(6, Math.floor(60 / d))));
    const bigN = base.n * m;
    const bigD = base.d * m;
    const askNumerator = k.endsWith('numerator');
    return {
      factKey: k,
      display: row(
        fr(base.n, base.d),
        op('='),
        askNumerator ? fr('?', bigD) : fr(bigN, '?'),
      ),
      answerType: 'int',
      answer: askNumerator ? bigN : bigD,
      slots: ['v'],
    };
  },
  keyLabel: (k) => (k.endsWith('numerator') ? 'Missing numerator' : 'Missing denominator'),
};

const simplifyOptions = [densOption];

export const fracSimplify = {
  id: 'frac-simplify',
  label: 'Simplify fractions',
  category: 'fractions',
  grade: '4–5',
  fluencyMs: 10000,
  options: simplifyOptions,
  keys: () => ['frac-simplify'],
  generate(o, rng) {
    const d = rng.pick(dens(withDefaults(simplifyOptions, o)).filter((x) => x > 2).concat([4]));
    const base = properLowest(rng, d);
    const m = rng.int(2, Math.max(2, Math.min(6, Math.floor(60 / d))));
    return {
      factKey: 'frac-simplify',
      prompt: 'Simplify',
      display: row(fr(base.n * m, base.d * m), op('='), blank()),
      ...fracAnswer(base, ['n', 'd'], 'simplest'),
    };
  },
  keyLabel: () => 'Simplify',
};

const compareOptions = [densOption];

export const fracCompare = {
  id: 'frac-compare',
  label: 'Compare fractions',
  category: 'fractions',
  grade: '3–4',
  fluencyMs: 8000,
  options: compareOptions,
  keys: () => ['frac-compare:same-den', 'frac-compare:same-num', 'frac-compare:unlike'],
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    const ds = dens(withDefaults(compareOptions, o));
    let a, b;
    if (k.endsWith('same-den')) {
      const d = rng.pick(ds.filter((x) => x > 2).concat([4]));
      [a, b] = until(
        () => [proper(rng, d), proper(rng, d)],
        ([x, y]) => x.n !== y.n,
      );
    } else if (k.endsWith('same-num')) {
      [a, b] = until(
        () => {
          const d1 = rng.pick(ds);
          const d2 = rng.pick(ds);
          const n = rng.int(1, Math.min(d1, d2) - 1);
          return [frac(n, d1), frac(n, d2)];
        },
        ([x, y]) => x.d !== y.d,
      );
    } else {
      [a, b] = until(
        () => {
          const x = proper(rng, rng.pick(ds));
          if (rng.bool(0.2)) {
            // Sometimes make them equal: 2/3 and 4/6.
            const r = reduce(x);
            const m = rng.int(2, 4);
            return [x, frac(r.n * m, r.d * m)];
          }
          return [x, proper(rng, rng.pick(ds))];
        },
        ([x, y]) => x.d !== y.d,
      );
    }
    const c = compare(a, b);
    return {
      factKey: k,
      prompt: 'Compare',
      display: row(fr(a.n, a.d), blank(), fr(b.n, b.d)),
      answerType: 'choice',
      answer: c < 0 ? '<' : c > 0 ? '>' : '=',
      choices: ['<', '=', '>'],
      slots: ['v'],
    };
  },
  keyLabel: (k) =>
    ({ 'same-den': 'Same denominator', 'same-num': 'Same numerator', unlike: 'Different denominators' })[
      k.split(':')[1]
    ],
};

const mixedOptions = [
  {
    key: 'direction',
    label: 'Direction',
    type: 'select',
    options: [
      { value: 'both', label: 'Both ways' },
      { value: 'to-mixed', label: 'Improper → mixed number' },
      { value: 'to-improper', label: 'Mixed number → improper' },
    ],
    default: 'both',
  },
  densOption,
];

export const fracMixed = {
  id: 'frac-mixed',
  label: 'Mixed numbers',
  category: 'fractions',
  grade: '4–5',
  fluencyMs: 12000,
  options: mixedOptions,
  keys(o) {
    const { direction } = withDefaults(mixedOptions, o);
    if (direction === 'to-mixed') return ['frac-mixed:to-mixed'];
    if (direction === 'to-improper') return ['frac-mixed:to-improper'];
    return ['frac-mixed:to-mixed', 'frac-mixed:to-improper'];
  },
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    const d = rng.pick(dens(withDefaults(mixedOptions, o)));
    const w = rng.int(1, 5);
    const part = properLowest(rng, d);
    const value = frac(w * d + part.n, d);
    if (k.endsWith('to-mixed')) {
      return {
        factKey: k,
        prompt: 'Write as a mixed number',
        display: row(fr(value.n, value.d), op('='), blank()),
        ...fracAnswer(value, ['w', 'n', 'd'], 'mixed'),
      };
    }
    return {
      factKey: k,
      prompt: 'Write as an improper fraction',
      display: row(fr(part.n, part.d, w), op('='), blank()),
      ...fracAnswer(value, ['n', 'd'], 'improper'),
    };
  },
  keyLabel: (k) => (k.endsWith('to-mixed') ? 'Improper → mixed' : 'Mixed → improper'),
};

const addSubOptions = [
  {
    key: 'ops',
    label: 'Operations',
    type: 'multi',
    options: [
      { value: '+', label: 'Add' },
      { value: '-', label: 'Subtract' },
    ],
    default: ['+', '-'],
  },
  {
    key: 'denominators',
    label: 'Denominators',
    type: 'select',
    options: [
      { value: 'like', label: 'Same (4th grade)' },
      { value: 'unlike', label: 'Different (5th grade)' },
      { value: 'both', label: 'Both' },
    ],
    default: 'like',
  },
  { key: 'mixedNumbers', label: 'Include mixed numbers', type: 'toggle', default: false },
  simplestOption(false),
  densOption,
];

export const fracAddSub = {
  id: 'frac-add-sub',
  label: 'Add & subtract fractions',
  category: 'fractions',
  grade: '4–5',
  fluencyMs: 20000,
  options: addSubOptions,
  keys(o) {
    const { ops, denominators, mixedNumbers } = withDefaults(addSubOptions, o);
    const kinds = denominators === 'both' ? ['like', 'unlike'] : [denominators];
    const useOps = ops.filter((x) => x === '+' || x === '-');
    const suffix = mixedNumbers ? ':mixed' : '';
    return kinds.flatMap((kd) =>
      (useOps.length ? useOps : ['+']).map((x) => `frac-add-sub:${kd}${x === '+' ? '+' : '-'}${suffix}`),
    );
  },
  generate(o, rng, key) {
    const opts = withDefaults(addSubOptions, o);
    const k = chooseKey(rng, this.keys(opts), key);
    const [, kind] = k.split(':');
    const like = kind.startsWith('like');
    const isAdd = kind.includes('+');
    const mixed = k.endsWith(':mixed');
    const ds = dens(opts);

    const [a, b] = until(
      () => {
        let d1, d2;
        if (like) {
          d1 = d2 = rng.pick(ds.filter((x) => x > 2).concat([4]));
        } else {
          [d1, d2] = until(
            () => [rng.pick(ds), rng.pick(ds)],
            ([x, y]) => x !== y && lcm(x, y) <= 60,
          );
        }
        const x = proper(rng, d1);
        const y = proper(rng, d2);
        const wx = mixed ? rng.int(1, 5) : 0;
        const wy = mixed ? rng.int(1, isAdd ? 5 : wx) : 0;
        return [
          { w: wx, n: x.n, d: x.d },
          { w: wy, n: y.n, d: y.d },
        ];
      },
      ([x, y]) => isAdd || compare(value(x), value(y)) > 0,
    );
    const result = isAdd ? add(value(a), value(b)) : sub(value(a), value(b));
    const slots = mixed || isAdd ? ['w', 'n', 'd'] : ['n', 'd'];
    return {
      factKey: k,
      display: row(
        fr(a.n, a.d, a.w || null),
        op(isAdd ? '+' : MINUS),
        fr(b.n, b.d, b.w || null),
        op('='),
        blank(),
      ),
      ...fracAnswer(result, slots, opts.simplest ? 'simplest' : null),
    };
  },
  keyLabel: (k) => {
    const [, kind] = k.split(':');
    const like = kind.startsWith('like') ? 'same denominators' : 'different denominators';
    const verb = kind.includes('+') ? 'Add' : 'Subtract';
    return `${verb}, ${like}${k.endsWith(':mixed') ? ', mixed numbers' : ''}`;
  },
};

function value({ w, n, d }) {
  return frac(w * d + n, d);
}

const mulOptions = [
  {
    key: 'types',
    label: 'Problem types',
    type: 'multi',
    options: [
      { value: 'whole', label: `Whole number ${TIMES} fraction (4th)` },
      { value: 'fraction', label: `Fraction ${TIMES} fraction (5th)` },
    ],
    default: ['whole'],
  },
  simplestOption(false),
  densOption,
];

export const fracMul = {
  id: 'frac-mul',
  label: 'Multiply fractions',
  category: 'fractions',
  grade: '4–5',
  fluencyMs: 15000,
  options: mulOptions,
  keys(o) {
    const { types } = withDefaults(mulOptions, o);
    const valid = types.filter((t) => t === 'whole' || t === 'fraction');
    return (valid.length ? valid : ['whole']).map((t) => `frac-mul:${t}`);
  },
  generate(o, rng, key) {
    const opts = withDefaults(mulOptions, o);
    const k = chooseKey(rng, this.keys(opts), key);
    const ds = dens(opts);
    const x = proper(rng, rng.pick(ds));
    let display, result;
    if (k.endsWith('whole')) {
      const w = rng.int(2, 10);
      result = mul(frac(w), x);
      display = rng.bool()
        ? row(num(w), op(TIMES), fr(x.n, x.d), op('='), blank())
        : row(fr(x.n, x.d), op(TIMES), num(w), op('='), blank());
    } else {
      const y = proper(rng, rng.pick(ds));
      result = mul(x, y);
      display = row(fr(x.n, x.d), op(TIMES), fr(y.n, y.d), op('='), blank());
    }
    return {
      factKey: k,
      display,
      ...fracAnswer(result, ['w', 'n', 'd'], opts.simplest ? 'simplest' : null),
    };
  },
  keyLabel: (k) => (k.endsWith('whole') ? `Whole ${TIMES} fraction` : `Fraction ${TIMES} fraction`),
};

const decOptions = [
  {
    key: 'direction',
    label: 'Direction',
    type: 'select',
    options: [
      { value: 'both', label: 'Both ways' },
      { value: 'to-decimal', label: 'Fraction → decimal' },
      { value: 'to-fraction', label: 'Decimal → fraction' },
    ],
    default: 'both',
  },
  {
    key: 'hundredths',
    label: 'Include hundredths',
    type: 'toggle',
    default: true,
  },
];

export const fracDecimal = {
  id: 'frac-decimal',
  label: 'Fractions ↔ decimals',
  category: 'fractions',
  grade: '4',
  fluencyMs: 10000,
  options: decOptions,
  keys(o) {
    const { direction } = withDefaults(decOptions, o);
    if (direction === 'to-decimal') return ['frac-decimal:to-decimal'];
    if (direction === 'to-fraction') return ['frac-decimal:to-fraction'];
    return ['frac-decimal:to-decimal', 'frac-decimal:to-fraction'];
  },
  generate(o, rng, key) {
    const opts = withDefaults(decOptions, o);
    const k = chooseKey(rng, this.keys(opts), key);
    const d = opts.hundredths && rng.bool() ? 100 : 10;
    const n = rng.int(1, d - 1);
    const dec = formatDecimal(frac(n, d));
    if (k.endsWith('to-decimal')) {
      return {
        factKey: k,
        prompt: 'Write as a decimal',
        display: row(fr(n, d), op('='), blank()),
        answerType: 'decimal',
        answer: dec,
        slots: ['v'],
      };
    }
    return {
      factKey: k,
      prompt: 'Write as a fraction',
      display: row(num(dec), op('='), blank()),
      ...fracAnswer(frac(n, d), ['n', 'd'], null),
    };
  },
  keyLabel: (k) => (k.endsWith('to-decimal') ? 'Fraction → decimal' : 'Decimal → fraction'),
};

export default [fracEquiv, fracSimplify, fracCompare, fracMixed, fracAddSub, fracMul, fracDecimal];
