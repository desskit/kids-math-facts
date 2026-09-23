// Exact rational numbers. Values are plain objects { n, d } with d > 0.

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a, b) {
  return (Math.abs(a) / gcd(a, b)) * Math.abs(b);
}

/** Build a fraction (not reduced). */
export function frac(n, d = 1) {
  if (d === 0) throw new Error('Zero denominator');
  if (d < 0) return { n: -n, d: -d };
  return { n, d };
}

export function reduce({ n, d }) {
  const g = gcd(n, d) || 1;
  return frac(n / g, d / g);
}

export function add(a, b) {
  return reduce(frac(a.n * b.d + b.n * a.d, a.d * b.d));
}

export function sub(a, b) {
  return reduce(frac(a.n * b.d - b.n * a.d, a.d * b.d));
}

export function mul(a, b) {
  return reduce(frac(a.n * b.n, a.d * b.d));
}

export function div(a, b) {
  return reduce(frac(a.n * b.d, a.d * b.n));
}

export function compare(a, b) {
  const diff = a.n * b.d - b.n * a.d;
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

export function equals(a, b) {
  return compare(a, b) === 0;
}

export function isSimplest({ n, d }) {
  return gcd(n, d) === 1;
}

/** Split an improper fraction into { whole, n, d } (n < d). */
export function toMixed(f) {
  const r = f;
  const whole = Math.trunc(r.n / r.d);
  const n = Math.abs(r.n - whole * r.d);
  return { whole, n, d: r.d };
}

export function fromMixed(whole, n, d) {
  const sign = whole < 0 ? -1 : 1;
  return frac(whole * d + sign * n, d);
}

/** Plain text form, e.g. "3/4", "1 1/2", "5". */
export function format(f, { mixed = false } = {}) {
  if (f.d === 1) return String(f.n);
  if (mixed && Math.abs(f.n) > f.d) {
    const m = toMixed(f);
    return m.n === 0 ? String(m.whole) : `${m.whole} ${m.n}/${m.d}`;
  }
  return `${f.n}/${f.d}`;
}
