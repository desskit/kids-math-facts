// Built-in presets, roughly by grade level. Players can save their own too.

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const BUILT_IN_PRESETS = [
  {
    id: 'bi-add-20',
    name: 'Addition to 20',
    grade: '1–2',
    config: { mode: 'count', count: 20, skills: [{ id: 'add-facts', options: { max: 10 } }], retryMissed: true },
  },
  {
    id: 'bi-sub-20',
    name: 'Subtraction to 20',
    grade: '1–2',
    config: { mode: 'count', count: 20, skills: [{ id: 'sub-facts', options: { max: 10 } }], retryMissed: true },
  },
  {
    id: 'bi-times',
    name: 'Times tables 0–12',
    grade: '3–4',
    config: {
      mode: 'count',
      count: 25,
      skills: [{ id: 'mul-facts', options: { tables: range(0, 12), max: 12 } }],
      retryMissed: true,
    },
  },
  {
    id: 'bi-div',
    name: 'Division facts',
    grade: '3–4',
    config: {
      mode: 'count',
      count: 25,
      skills: [{ id: 'div-facts', options: { divisors: range(1, 12), max: 12 } }],
      retryMissed: true,
    },
  },
  {
    id: 'bi-mastery-times',
    name: 'Master the times tables',
    grade: '3–4',
    config: {
      mode: 'mastery',
      count: 20,
      skills: [{ id: 'mul-facts', options: { tables: range(0, 12), max: 12 } }],
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
        { id: 'add-facts', options: { max: 12 } },
        { id: 'sub-facts', options: { max: 12 } },
        { id: 'mul-facts', options: { tables: range(2, 12), max: 12 } },
        { id: 'div-facts', options: { divisors: range(2, 12), max: 12 } },
      ],
    },
  },
  {
    id: 'bi-g4-multi',
    name: '4th grade multi-digit',
    grade: '4',
    config: {
      mode: 'count',
      count: 10,
      skills: [
        { id: 'add-multi', options: { digitsA: 4, digitsB: 4, regroup: 'any', layout: 'vertical' } },
        { id: 'sub-multi', options: { digitsA: 4, digitsB: 3, regroup: 'any', layout: 'vertical' } },
        { id: 'mul-multi', options: { shapes: ['3x1', '4x1', '2x2'], layout: 'vertical' } },
        { id: 'div-long', options: { dividend: [3, 4], divisor: 1, remainders: 'allow', layout: 'longdiv' } },
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
      count: 15,
      skills: [
        { id: 'frac-equiv', options: { dens: [2, 3, 4, 5, 6, 8, 10, 12] } },
        { id: 'frac-compare', options: { dens: [2, 3, 4, 5, 6, 8, 10, 12] } },
        { id: 'frac-add-sub', options: { ops: ['+', '-'], denominators: 'like', mixedNumbers: false, simplest: false } },
        { id: 'frac-mixed', options: { direction: 'both', dens: [2, 3, 4, 5, 6, 8] } },
        { id: 'frac-mul', options: { types: ['whole'], simplest: false } },
        { id: 'frac-decimal', options: { direction: 'both', hundredths: true } },
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
      count: 15,
      skills: [
        { id: 'frac-simplify', options: {} },
        { id: 'frac-add-sub', options: { ops: ['+', '-'], denominators: 'unlike', mixedNumbers: false, simplest: true } },
        { id: 'frac-mixed', options: { direction: 'both' } },
        { id: 'frac-mul', options: { types: ['whole', 'fraction'], simplest: true } },
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
      count: 15,
      skills: [
        { id: 'dec-compare', options: { places: 3 } },
        { id: 'dec-add-sub', options: { ops: ['+', '-'], places: 2, maxWhole: 99 } },
        { id: 'dec-mul', options: { types: ['whole', 'decimal', 'pow10'] } },
        { id: 'dec-div', options: { types: ['whole', 'pow10'] } },
      ],
      retryMissed: true,
    },
  },
];
