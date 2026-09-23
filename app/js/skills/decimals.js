// Decimals (grades 4–6). Values are built as integers scaled by powers of ten
// so answers are exact.

import { num, op, blank, row, TIMES, DIVIDE, MINUS, withDefaults, chooseKey, until } from './common.js';
import { compare, add, sub, mul, div, frac } from '../lib/fraction.js';
import { scaled, formatDecimal } from '../lib/decimal.js';

const placesOption = {
  key: 'places',
  label: 'Decimal places',
  type: 'select',
  options: [
    { value: 1, label: 'Tenths' },
    { value: 2, label: 'Hundredths' },
    { value: 3, label: 'Thousandths' },
  ],
  default: 2,
};

/** Random decimal with up to `places` places and a whole part up to `maxWhole`. */
function randDecimal(rng, places, maxWhole) {
  const p = rng.int(1, places);
  const units = rng.int(1, (maxWhole + 1) * 10 ** p - 1);
  return scaled(units, p);
}

const decAnswer = (value) => ({
  answerType: 'decimal',
  answer: formatDecimal(value),
  slots: ['v'],
});

const compareOptions = [placesOption];

export const decCompare = {
  id: 'dec-compare',
  label: 'Compare decimals',
  category: 'decimals',
  grade: '4–5',
  fluencyMs: 8000,
  options: compareOptions,
  keys: () => ['dec-compare'],
  generate(o, rng) {
    const { places } = withDefaults(compareOptions, o);
    const whole = rng.int(0, 9);
    const pick = () => {
      const p = rng.int(1, Math.max(1, places));
      return scaled(whole * 10 ** p + rng.int(0, 10 ** p - 1), p);
    };
    let a, b, textA, textB;
    if (rng.bool(0.15)) {
      // Equal values written differently, like 0.5 and 0.50.
      a = b = scaled(whole * 10 + rng.int(1, 9), 1);
      textA = formatDecimal(a);
      textB = textA + '0';
    } else {
      [a, b] = until(
        () => [pick(), pick()],
        ([x, y]) => compare(x, y) !== 0,
      );
      textA = formatDecimal(a);
      textB = formatDecimal(b);
    }
    const c = compare(a, b);
    return {
      factKey: 'dec-compare',
      prompt: 'Compare',
      display: row(num(textA), blank(), num(textB)),
      answerType: 'choice',
      answer: c < 0 ? '<' : c > 0 ? '>' : '=',
      choices: ['<', '=', '>'],
      slots: ['v'],
    };
  },
  keyLabel: () => 'Compare decimals',
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
  placesOption,
  {
    key: 'maxWhole',
    label: 'Whole-number part up to',
    type: 'select',
    options: [9, 99, 999].map((v) => ({ value: v, label: String(v) })),
    default: 99,
  },
];

export const decAddSub = {
  id: 'dec-add-sub',
  label: 'Add & subtract decimals',
  category: 'decimals',
  grade: '5',
  fluencyMs: 20000,
  options: addSubOptions,
  keys(o) {
    const { ops } = withDefaults(addSubOptions, o);
    const valid = ops.filter((x) => x === '+' || x === '-');
    return (valid.length ? valid : ['+']).map((x) => `dec-add-sub:${x}`);
  },
  generate(o, rng, key) {
    const { places, maxWhole } = withDefaults(addSubOptions, o);
    const k = chooseKey(rng, this.keys(o), key);
    const isAdd = k.endsWith('+');
    let a = randDecimal(rng, places, maxWhole);
    let b = randDecimal(rng, places, maxWhole);
    if (!isAdd && compare(a, b) < 0) [a, b] = [b, a];
    if (!isAdd && compare(a, b) === 0) a = add(a, frac(1));
    const result = isAdd ? add(a, b) : sub(a, b);
    return {
      factKey: k,
      display: row(num(formatDecimal(a)), op(isAdd ? '+' : MINUS), num(formatDecimal(b)), op('='), blank()),
      ...decAnswer(result),
    };
  },
  keyLabel: (k) => (k.endsWith('+') ? 'Add decimals' : 'Subtract decimals'),
};

const mulOptions = [
  {
    key: 'types',
    label: 'Problem types',
    type: 'multi',
    options: [
      { value: 'whole', label: `Decimal ${TIMES} whole number` },
      { value: 'decimal', label: `Decimal ${TIMES} decimal` },
      { value: 'pow10', label: `${TIMES} 10, 100, 1000` },
    ],
    default: ['whole', 'pow10'],
  },
];

export const decMul = {
  id: 'dec-mul',
  label: 'Multiply decimals',
  category: 'decimals',
  grade: '5',
  fluencyMs: 20000,
  options: mulOptions,
  keys(o) {
    const { types } = withDefaults(mulOptions, o);
    const valid = types.filter((t) => ['whole', 'decimal', 'pow10'].includes(t));
    return (valid.length ? valid : ['whole']).map((t) => `dec-mul:${t}`);
  },
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    const type = k.split(':')[1];
    let a, b;
    if (type === 'whole') {
      a = randDecimal(rng, 2, 9);
      b = frac(rng.int(2, 9));
    } else if (type === 'decimal') {
      a = scaled(rng.int(1, 99), 1);
      b = scaled(rng.int(1, 9), 1);
    } else {
      a = randDecimal(rng, 3, 99);
      b = frac(rng.pick([10, 100, 1000]));
    }
    const result = mul(a, b);
    return {
      factKey: k,
      display: row(num(formatDecimal(a)), op(TIMES), num(formatDecimal(b)), op('='), blank()),
      ...decAnswer(result),
    };
  },
  keyLabel: (k) =>
    ({ whole: `Decimal ${TIMES} whole`, decimal: `Decimal ${TIMES} decimal`, pow10: `${TIMES} powers of 10` })[
      k.split(':')[1]
    ],
};

const divOptions = [
  {
    key: 'types',
    label: 'Problem types',
    type: 'multi',
    options: [
      { value: 'whole', label: `Decimal ${DIVIDE} whole number` },
      { value: 'pow10', label: `${DIVIDE} 10, 100, 1000` },
    ],
    default: ['whole', 'pow10'],
  },
];

export const decDiv = {
  id: 'dec-div',
  label: 'Divide decimals',
  category: 'decimals',
  grade: '5–6',
  fluencyMs: 20000,
  options: divOptions,
  keys(o) {
    const { types } = withDefaults(divOptions, o);
    const valid = types.filter((t) => ['whole', 'pow10'].includes(t));
    return (valid.length ? valid : ['whole']).map((t) => `dec-div:${t}`);
  },
  generate(o, rng, key) {
    const k = chooseKey(rng, this.keys(o), key);
    let a, b, result;
    if (k.endsWith('whole')) {
      // Build from the answer so it divides evenly: q × d ÷ d = q
      b = frac(rng.int(2, 9));
      result = scaled(rng.int(1, 999), rng.int(1, 2));
      a = mul(result, b);
    } else {
      a = randDecimal(rng, 2, 999);
      b = frac(rng.pick([10, 100, 1000]));
      result = div(a, b);
    }
    return {
      factKey: k,
      display: row(num(formatDecimal(a)), op(DIVIDE), num(formatDecimal(b)), op('='), blank()),
      ...decAnswer(result),
    };
  },
  keyLabel: (k) => (k.endsWith('whole') ? `Decimal ${DIVIDE} whole` : `${DIVIDE} powers of 10`),
};

export default [decCompare, decAddSub, decMul, decDiv];
