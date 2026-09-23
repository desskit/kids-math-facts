// Shared building blocks for problem generators.
//
// A problem's `display` is plain data (stored in history and rendered by
// ui/problem-view.js):
//   { layout: 'row', tokens: [...] }                  7 × 8 = ?
//   { layout: 'vertical', op: '+', rows: ['347','86'] } stacked, like on paper
//   { layout: 'longdiv', dividend: '847', divisor: '7' }
// Tokens: { t: 'num', v } | { t: 'op', v } | { t: 'frac', n, d, w } | { t: 'blank' }
// A '?' inside a num or frac field marks the part being asked for.

export const num = (v) => ({ t: 'num', v: String(v) });
export const op = (v) => ({ t: 'op', v });
export const fr = (n, d, w = null) => ({
  t: 'frac',
  n: String(n),
  d: String(d),
  w: w === null || w === undefined ? null : String(w),
});
export const blank = () => ({ t: 'blank' });

export const row = (...tokens) => ({ layout: 'row', tokens });
export const vertical = (opSymbol, top, bottom) => ({
  layout: 'vertical',
  op: opSymbol,
  rows: [String(top), String(bottom)],
});
export const longdiv = (dividend, divisor) => ({
  layout: 'longdiv',
  dividend: String(dividend),
  divisor: String(divisor),
});

export const TIMES = '×';
export const DIVIDE = '÷';
export const MINUS = '−';

/** Plain-text version of a display, for history lists. */
export function displayText(display, prompt) {
  let body;
  if (display.layout === 'vertical') {
    body = `${display.rows[0]} ${display.op} ${display.rows[1]} = ?`;
  } else if (display.layout === 'longdiv') {
    body = `${display.dividend} ${DIVIDE} ${display.divisor} = ?`;
  } else {
    body = display.tokens.map(tokenText).join(' ');
  }
  return prompt ? `${prompt}: ${body}` : body;
}

function tokenText(tok) {
  switch (tok.t) {
    case 'num':
    case 'op':
      return tok.v;
    case 'frac':
      return (tok.w ? `${tok.w} ` : '') + `${tok.n}/${tok.d}`;
    case 'blank':
      return '?';
    default:
      return '';
  }
}

/** Random integer with exactly `digits` digits. */
export function randDigits(rng, digits) {
  if (digits <= 1) return rng.int(0, 9);
  return rng.int(10 ** (digits - 1), 10 ** digits - 1);
}

/** Digits of n, least significant first. */
export function digitsOf(n) {
  return String(n).split('').reverse().map(Number);
}

export function range(lo, hi) {
  const out = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}

/** Retry `make` until `ok` passes (or give up and return the last attempt). */
export function until(make, ok, tries = 2000) {
  let p;
  for (let i = 0; i < tries; i++) {
    p = make();
    if (ok(p)) return p;
  }
  return p;
}

/** Read an option with a fallback to the skill's schema default. */
export function opt(options, schema, key) {
  if (options && options[key] !== undefined && options[key] !== null) return options[key];
  const field = schema.find((f) => f.key === key);
  return field ? field.default : undefined;
}

/** Fill in every missing option from the schema defaults. */
export function withDefaults(schema, options = {}) {
  const out = {};
  for (const f of schema) out[f.key] = opt(options, schema, f.key);
  return out;
}

/** Choose a key uniformly from those the skill can produce, unless one is given. */
export function chooseKey(rng, keys, key) {
  if (key && keys.includes(key)) return key;
  return rng.pick(keys);
}
