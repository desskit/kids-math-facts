// Built-in presets, roughly by grade level. Players can save their own too.
// Each kind of problem has its own question count; the round's total is their sum.

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const BUILT_IN_PRESETS = [
  {
    id: 'bi-add-20',
    name: 'Addition to 20',
    grade: '1–2',
    config: {
      mode: 'count',
      skills: [{ id: 'add-facts', options: { first: [0, 10], second: [0, 10] }, count: 20 }],
      retryMissed: true,
    },
  },
  {
    id: 'bi-sub-20',
    name: 'Subtraction to 20',
    grade: '1–2',
    config: {
      mode: 'count',
      skills: [{ id: 'sub-facts', options: { taken: [0, 10], answer: [0, 10] }, count: 20 }],
      retryMissed: true,
    },
  },
  {
    id: 'bi-times',
    name: 'Times tables 0–12',
    grade: '3–4',
    config: {
      mode: 'count',
      skills: [{ id: 'mul-facts', options: { tables: range(0, 12), by: [0, 12] }, count: 25 }],
      retryMissed: true,
    },
  },
  {
    id: 'bi-div',
    name: 'Division facts',
    grade: '3–4',
    config: {
      mode: 'count',
      skills: [{ id: 'div-facts', options: { divisors: range(1, 12), answer: [0, 12] }, count: 25 }],
      retryMissed: true,
    },
  },
  {
    id: 'bi-mastery-times',
    name: 'Master the times tables',
    grade: '3–4',
    config: {
      mode: 'mastery',
      skills: [{ id: 'mul-facts', options: { tables: range(0, 12), by: [0, 12] }, count: 20 }],
    },
  },
  {
    id: 'bi-sprint',
    name: 'Mixed facts sprint',
    grade: '3–5',
    config: {
      mode: 'timed',
      seconds: 120,
      skills: [
        { id: 'add-facts', options: { first: [0, 12], second: [0, 12] }, count: 1 },
        { id: 'sub-facts', options: { taken: [0, 12], answer: [0, 12] }, count: 1 },
        { id: 'mul-facts', options: { tables: range(2, 12), by: [0, 12] }, count: 1 },
        { id: 'div-facts', options: { divisors: range(2, 12), answer: [0, 12] }, count: 1 },
      ],
    },
  },
  {
    id: 'bi-g4-multi',
    name: '4th grade multi-digit',
    grade: '4',
    config: {
      mode: 'count',
      skills: [
        { id: 'add-multi', options: { digitsA: 4, digitsB: 4, regroup: 'any', layout: 'vertical' }, count: 3 },
        { id: 'sub-multi', options: { digitsA: 4, digitsB: 3, regroup: 'any', layout: 'vertical' }, count: 3 },
        { id: 'mul-multi', options: { shapes: ['3x1', '4x1', '2x2'], layout: 'vertical' }, count: 2 },
        { id: 'div-long', options: { dividend: [3, 4], divisor: 1, remainders: 'allow', layout: 'longdiv' }, count: 2 },
      ],
      retryMissed: true,
    },
  },
  {
    id: 'bi-g4-fractions',
    name: '4th grade fractions',
    grade: '4',
    config: {
      mode: 'count',
      skills: [
        { id: 'frac-equiv', options: { dens: [2, 3, 4, 5, 6, 8, 10, 12] }, count: 3 },
        { id: 'frac-compare', options: { dens: [2, 3, 4, 5, 6, 8, 10, 12] }, count: 3 },
        { id: 'frac-add-sub', options: { ops: ['+', '-'], denominators: 'like', mixedNumbers: false, simplest: false }, count: 3 },
        { id: 'frac-mixed', options: { direction: 'both', dens: [2, 3, 4, 5, 6, 8] }, count: 2 },
        { id: 'frac-mul', options: { types: ['whole'], simplest: false }, count: 2 },
        { id: 'frac-decimal', options: { direction: 'both', hundredths: true }, count: 2 },
      ],
      retryMissed: true,
    },
  },
  {
    id: 'bi-g5-fractions',
    name: '5th grade fractions',
    grade: '5',
    config: {
      mode: 'count',
      skills: [
        { id: 'frac-simplify', options: {}, count: 3 },
        { id: 'frac-add-sub', options: { ops: ['+', '-'], denominators: 'unlike', mixedNumbers: false, simplest: true }, count: 6 },
        { id: 'frac-mixed', options: { direction: 'both' }, count: 2 },
        { id: 'frac-mul', options: { types: ['whole', 'fraction'], simplest: true }, count: 4 },
      ],
      retryMissed: true,
    },
  },
  {
    id: 'bi-g5-decimals',
    name: '5th grade decimals',
    grade: '5',
    config: {
      mode: 'count',
      skills: [
        { id: 'dec-compare', options: { places: 3 }, count: 3 },
        { id: 'dec-add-sub', options: { ops: ['+', '-'], places: 2, maxWhole: 99 }, count: 4 },
        { id: 'dec-mul', options: { types: ['whole', 'decimal', 'pow10'] }, count: 4 },
        { id: 'dec-div', options: { types: ['whole', 'pow10'] }, count: 4 },
      ],
      retryMissed: true,
    },
  },
];
