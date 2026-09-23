// Multi-digit arithmetic (grades 2–5).

import {
  num, op, blank, row, vertical, longdiv, TIMES, DIVIDE, MINUS,
  randDigits, digitsOf, withDefaults, chooseKey, until,
} from './common.js';

const digitOptions = (label, def, min = 1) => ({
  key: label.key,
  label: label.text,
  type: 'select',
  options: [1, 2, 3, 4, 5, 6].filter((v) => v >= min).map((v) => ({ value: v, label: `${v}-digit` })),
  default: def,
});

const regroupOption = (label) => ({
  key: 'regroup',
  label,
  type: 'select',
  options: [
    { value: 'any', label: 'Mixed' },
    { value: 'none', label: 'Never' },
    { value: 'required', label: 'Always' },
  ],
  default: 'any',
});

const layoutOption = {
  key: 'layout',
  label: 'Layout',
  type: 'select',
  options: [
    { value: 'vertical', label: 'Stacked' },
    { value: 'horizontal', label: 'In a line' },
  ],
  default: 'vertical',
};

function hasCarry(a, b) {
  const da = digitsOf(a);
  const db = digitsOf(b);
  let carry = 0;
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const s = (da[i] || 0) + (db[i] || 0) + carry;
    carry = s >= 10 ? 1 : 0;
    if (carry) return true;
  }
  return false;
}

function hasBorrow(a, b) {
  const da = digitsOf(a);
  const db = digitsOf(b);
  for (let i = 0; i < da.length; i++) if ((da[i] || 0) < (db[i] || 0)) return true;
  return false;
}

/** Build a number digit by digit, with column digits chosen by `pick(col, isLeading)`. */
function buildDigits(len, pick) {
  let n = 0;
  for (let col = len - 1; col >= 0; col--) n = n * 10 + pick(col, col === len - 1 && len > 1);
  return n;
}

function display(layout, a, symbol, b) {
  return layout === 'vertical'
    ? vertical(symbol, a, b)
    : row(num(a), op(symbol), num(b), op('='), blank());
}

const addOptions = [
  digitOptions({ key: 'digitsA', text: 'First number' }, 3, 2),
  digitOptions({ key: 'digitsB', text: 'Second number' }, 3),
  regroupOption('Carrying (regrouping)'),
  layoutOption,
];

export const addMulti = {
  id: 'add-multi',
  label: 'Multi-digit addition',
  category: 'multidigit',
  grade: '2–4',
  fluencyMs: 20000,
  options: addOptions,
  keys(o) {
    const { digitsA, digitsB } = withDefaults(addOptions, o);
    return [`add-multi:${digitsA}+${digitsB}`];
  },
  generate(o, rng) {
    const { digitsA, digitsB, regroup, layout } = withDefaults(addOptions, o);
    let a, b;
    if (regroup === 'none') {
      const colsA = [];
      a = buildDigits(digitsA, (col, lead) => {
        const minB = col < digitsB && col === digitsB - 1 && digitsB > 1 ? 1 : 0;
        const d = rng.int(lead ? 1 : 0, col < digitsB ? 9 - minB : 9);
        colsA[col] = d;
        return d;
      });
      b = buildDigits(digitsB, (col, lead) => {
        const max = col < digitsA ? 9 - colsA[col] : 9;
        return rng.int(lead ? Math.min(1, max) : 0, max);
      });
    } else {
      [a, b] = until(
        () => [randDigits(rng, digitsA), randDigits(rng, digitsB)],
        ([x, y]) => (regroup === 'required' ? hasCarry(x, y) : true),
      );
    }
    return {
      factKey: this.keys(o)[0],
      display: display(layout, a, '+', b),
      answerType: 'int',
      answer: a + b,
      slots: ['v'],
    };
  },
  keyLabel: (k) => {
    const [a, b] = k.split(':')[1].split('+');
    return `${a}-digit + ${b}-digit`;
  },
};

const subOptions = [
  digitOptions({ key: 'digitsA', text: 'First number' }, 3, 2),
  digitOptions({ key: 'digitsB', text: 'Number taken away' }, 3),
  regroupOption('Borrowing (regrouping)'),
  layoutOption,
];

export const subMulti = {
  id: 'sub-multi',
  label: 'Multi-digit subtraction',
  category: 'multidigit',
  grade: '2–4',
  fluencyMs: 20000,
  options: subOptions,
  keys(o) {
    const { digitsA, digitsB } = withDefaults(subOptions, o);
    return [`sub-multi:${digitsA}-${Math.min(digitsA, digitsB)}`];
  },
  generate(o, rng) {
    const opts = withDefaults(subOptions, o);
    const { digitsA, regroup, layout } = opts;
    const digitsB = Math.min(opts.digitsB, digitsA);
    let a, b;
    if (regroup === 'none') {
      [a, b] = until(
        () => {
          const colsB = [];
          const y = buildDigits(digitsB, (col, lead) => {
            const d = rng.int(lead ? 1 : 0, 9);
            colsB[col] = d;
            return d;
          });
          const x = buildDigits(digitsA, (col, lead) => rng.int(Math.max(lead ? 1 : 0, colsB[col] || 0), 9));
          return [x, y];
        },
        ([x, y]) => x > y,
      );
    } else {
      [a, b] = until(
        () => {
          let x = randDigits(rng, digitsA);
          let y = randDigits(rng, digitsB);
          if (y > x) [x, y] = [y, x];
          return [x, y];
        },
        ([x, y]) =>
          String(x).length === digitsA &&
          x > y &&
          (regroup === 'required' ? hasBorrow(x, y) : true),
      );
    }
    return {
      factKey: this.keys(o)[0],
      display: display(layout, a, MINUS, b),
      answerType: 'int',
      answer: a - b,
      slots: ['v'],
    };
  },
  keyLabel: (k) => {
    const [a, b] = k.split(':')[1].split('-');
    return `${a}-digit ${MINUS} ${b}-digit`;
  },
};

const SHAPES = ['2x1', '3x1', '4x1', '2x2', '3x2'];
const mulOptions = [
  {
    key: 'shapes',
    label: 'Problem sizes',
    type: 'multi',
    options: SHAPES.map((s) => ({ value: s, label: s.replace('x', ` ${TIMES} `) + ' digits' })),
    default: ['2x1', '3x1'],
  },
  layoutOption,
];

export const mulMulti = {
  id: 'mul-multi',
  label: 'Multi-digit multiplication',
  category: 'multidigit',
  grade: '4–5',
  fluencyMs: 45000,
  options: mulOptions,
  keys(o) {
    const { shapes } = withDefaults(mulOptions, o);
    const valid = shapes.filter((s) => SHAPES.includes(s));
    return (valid.length ? valid : ['2x1']).map((s) => `mul-multi:${s}`);
  },
  generate(o, rng, key) {
    const { layout } = withDefaults(mulOptions, o);
    const k = chooseKey(rng, this.keys(o), key);
    const [da, db] = k.split(':')[1].split('x').map(Number);
    const a = until(() => randDigits(rng, da), (x) => x % 10 !== 0 || da > 2);
    const b = db === 1 ? rng.int(2, 9) : until(() => randDigits(rng, db), (x) => x % 10 !== 0);
    return {
      factKey: k,
      display: display(layout, a, TIMES, b),
      answerType: 'int',
      answer: a * b,
      slots: ['v'],
    };
  },
  keyLabel: (k) => k.split(':')[1].replace('x', `-digit ${TIMES} `) + '-digit',
};

const divOptions = [
  {
    key: 'dividend',
    label: 'Number being divided',
    type: 'multi',
    options: [2, 3, 4].map((v) => ({ value: v, label: `${v}-digit` })),
    default: [2, 3],
  },
  {
    key: 'divisor',
    label: 'Divide by',
    type: 'select',
    options: [
      { value: 1, label: '1-digit' },
      { value: 2, label: '2-digit' },
    ],
    default: 1,
  },
  {
    key: 'remainders',
    label: 'Remainders',
    type: 'select',
    options: [
      { value: 'none', label: 'None (divides evenly)' },
      { value: 'allow', label: 'Allowed' },
    ],
    default: 'none',
  },
  {
    key: 'layout',
    label: 'Layout',
    type: 'select',
    options: [
      { value: 'longdiv', label: 'Long division bracket' },
      { value: 'horizontal', label: 'In a line' },
    ],
    default: 'longdiv',
  },
];

export const divLong = {
  id: 'div-long',
  label: 'Long division',
  category: 'multidigit',
  grade: '4–5',
  fluencyMs: 45000,
  options: divOptions,
  keys(o) {
    const { dividend, divisor } = withDefaults(divOptions, o);
    const sizes = dividend.filter((d) => d >= 2 && d <= 4 && d > divisor);
    return (sizes.length ? sizes : [divisor + 1]).map((d) => `div-long:${d}/${divisor}`);
  },
  generate(o, rng, key) {
    const { divisor: divDigits, remainders, layout } = withDefaults(divOptions, o);
    const k = chooseKey(rng, this.keys(o), key);
    const dividendDigits = Number(k.split(':')[1].split('/')[0]);
    const lo = 10 ** (dividendDigits - 1);
    const hi = 10 ** dividendDigits - 1;
    let d, n;
    if (remainders === 'none') {
      [d, n] = until(
        () => {
          const dd = divDigits === 1 ? rng.int(2, 9) : rng.int(11, 99);
          const qLo = Math.max(2, Math.ceil(lo / dd));
          const qHi = Math.floor(hi / dd);
          if (qHi < qLo) return [dd, 0];
          return [dd, dd * rng.int(qLo, qHi)];
        },
        ([, x]) => x >= lo && x <= hi,
      );
    } else {
      d = divDigits === 1 ? rng.int(2, 9) : rng.int(11, 99);
      n = rng.int(Math.max(lo, d * 2), hi);
    }
    const q = Math.floor(n / d);
    const r = n % d;
    const shown =
      layout === 'longdiv' ? longdiv(n, d) : row(num(n), op(DIVIDE), num(d), op('='), blank());
    return remainders === 'none'
      ? { factKey: k, display: shown, answerType: 'int', answer: q, slots: ['v'] }
      : { factKey: k, display: shown, answerType: 'remainder', answer: { q, r }, slots: ['q', 'r'] };
  },
  keyLabel: (k) => {
    const [a, b] = k.split(':')[1].split('/');
    return `${a}-digit ${DIVIDE} ${b}-digit`;
  },
};

export default [addMulti, subMulti, mulMulti, divLong];
