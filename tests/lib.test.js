import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frac, add, sub, mul, div, reduce, compare, equals, isSimplest, toMixed, format, gcd, lcm } from '../app/js/lib/fraction.js';
import { parseDecimal, formatDecimal, scaled, isTerminating } from '../app/js/lib/decimal.js';
import { createRng } from '../app/js/lib/rng.js';

test('fraction arithmetic is exact and reduced', () => {
  assert.deepEqual(add(frac(1, 3), frac(1, 6)), frac(1, 2));
  assert.deepEqual(sub(frac(3, 4), frac(1, 4)), frac(1, 2));
  assert.deepEqual(mul(frac(2, 3), frac(3, 4)), frac(1, 2));
  assert.deepEqual(div(frac(1, 2), frac(1, 4)), frac(2, 1));
  assert.deepEqual(reduce(frac(6, 8)), frac(3, 4));
  assert.equal(compare(frac(1, 2), frac(2, 3)), -1);
  assert.ok(equals(frac(2, 4), frac(1, 2)));
  assert.ok(isSimplest(frac(3, 4)));
  assert.ok(!isSimplest(frac(2, 4)));
  assert.equal(gcd(12, 18), 6);
  assert.equal(lcm(4, 6), 12);
});

test('mixed numbers', () => {
  assert.deepEqual(toMixed(frac(7, 4)), { whole: 1, n: 3, d: 4 });
  assert.equal(format(frac(7, 4), { mixed: true }), '1 3/4');
  assert.equal(format(frac(8, 4 * 1)), '8/4');
  assert.equal(format(frac(3, 1)), '3');
});

test('decimals parse and format exactly', () => {
  assert.ok(equals(parseDecimal('0.5'), frac(1, 2)));
  assert.ok(equals(parseDecimal('.5'), frac(1, 2)));
  assert.ok(equals(parseDecimal('0.50'), frac(1, 2)));
  assert.equal(parseDecimal('1.2.3'), null);
  assert.equal(parseDecimal('abc'), null);
  assert.equal(parseDecimal(''), null);
  assert.equal(formatDecimal(add(parseDecimal('0.1'), parseDecimal('0.2'))), '0.3');
  assert.equal(formatDecimal(scaled(125, 2)), '1.25');
  assert.equal(formatDecimal(frac(1, 8)), '0.125');
  assert.equal(formatDecimal(frac(3, 1)), '3');
  assert.equal(formatDecimal(frac(-1, 20)), '-0.05');
  assert.ok(isTerminating(frac(1, 40)));
  assert.ok(!isTerminating(frac(1, 3)));
  assert.throws(() => formatDecimal(frac(1, 3)));
});

test('seeded rng is reproducible and in range', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) {
    const v = r.int(3, 7);
    assert.ok(v >= 3 && v <= 7 && Number.isInteger(v));
  }
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 2000; i++) counts[r.weighted(['a', 'b'], [1, 9])]++;
  assert.ok(counts.b > counts.a * 4);
});
