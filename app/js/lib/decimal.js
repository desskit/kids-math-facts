// Decimals as exact fractions with a power-of-ten denominator, so that
// 0.1 + 0.2 is really 0.3. We reuse the fraction helpers for arithmetic.

import { frac, reduce } from './fraction.js';

/** Parse "12.5", ".5", "-3", "0.50" into a reduced fraction, or null. */
export function parseDecimal(text) {
  const s = String(text).trim();
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const [intPart, fracPart = ''] = body.split('.');
  const scale = 10 ** fracPart.length;
  const n = Number(intPart || '0') * scale + Number(fracPart || '0');
  return reduce(frac(neg ? -n : n, scale));
}

/** Build a decimal from an integer count of 10^-places, e.g. (125, 2) = 1.25 */
export function scaled(units, places) {
  return reduce(frac(units, 10 ** places));
}

/** True when the fraction can be written as a terminating decimal. */
export function isTerminating({ d }) {
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1;
}

/** Format a terminating fraction as a decimal string, e.g. {n:5,d:4} -> "1.25". */
export function formatDecimal(f) {
  if (!isTerminating(f)) throw new Error('Not a terminating decimal');
  const neg = f.n < 0;
  const n = Math.abs(f.n);
  let places = 0;
  while ((n * 10 ** places) % f.d !== 0) places++;
  const digits = String((n * 10 ** places) / f.d).padStart(places + 1, '0');
  const out = places ? `${digits.slice(0, -places)}.${digits.slice(-places)}` : digits;
  return (neg ? '-' : '') + out;
}
