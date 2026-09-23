// Property tests: generate many problems for every skill and option combination,
// then check each answer with an independent calculation from what's displayed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, makeProblem, getSkill, labelForKey } from '../app/js/skills/index.js';
import { createRng } from '../app/js/lib/rng.js';
import { frac, add, sub, mul, div, equals, compare, reduce } from '../app/js/lib/fraction.js';
import { parseDecimal } from '../app/js/lib/decimal.js';
import { checkAnswer, formatAnswer } from '../app/js/engine/answer.js';
import { withDefaults, digitsOf } from '../app/js/skills/common.js';

const OPS = { '+': add, '−': sub, '×': mul, '÷': div };

function randomOptions(skill, rng) {
  const o = {};
  for (const f of skill.options) {
    if (f.type === 'select') o[f.key] = rng.pick(f.options).value;
    else if (f.type === 'toggle') o[f.key] = rng.bool();
    else if (f.type === 'multi') {
      const pickFrom = rng.shuffle(f.options.map((x) => x.value));
      o[f.key] = pickFrom.slice(0, rng.int(1, pickFrom.length));
    }
  }
  return o;
}

function tokenValue(tok) {
  if (tok.t === 'num') return parseDecimal(tok.v);
  if (tok.t === 'frac') {
    const w = tok.w ? Number(tok.w) : 0;
    const d = Number(tok.d);
    return frac(w * d + Number(tok.n), d);
  }
  throw new Error('not a value token: ' + JSON.stringify(tok));
}

function answerValue(p) {
  switch (p.answerType) {
    case 'int':
      return frac(p.answer);
    case 'decimal':
      return parseDecimal(p.answer);
    case 'fraction':
      return frac(p.answer.n, p.answer.d);
    default:
      throw new Error('no value for ' + p.answerType);
  }
}

/** Check a problem's answer independently from its display. */
function verify(p) {
  const d = p.display;
  if (d.layout === 'vertical') {
    const v = OPS[d.op](frac(Number(d.rows[0])), frac(Number(d.rows[1])));
    assert.ok(equals(v, answerValue(p)), p.text);
    return;
  }
  if (d.layout === 'longdiv') {
    const n = Number(d.dividend);
    const dv = Number(d.divisor);
    if (p.answerType === 'remainder') {
      assert.equal(p.answer.q * dv + p.answer.r, n, p.text);
      assert.ok(p.answer.r >= 0 && p.answer.r < dv, p.text);
    } else {
      assert.equal(p.answer * dv, n, p.text);
    }
    return;
  }
  const t = d.tokens;
  if (p.answerType === 'choice') {
    const c = compare(tokenValue(t[0]), tokenValue(t[2]));
    assert.equal(p.answer, c < 0 ? '<' : c > 0 ? '>' : '=', p.text);
    return;
  }
  const eq = t.findIndex((x) => x.t === 'op' && x.v === '=');
  const left = t.slice(0, eq);
  const right = t.slice(eq + 1);
  if (right[0].t === 'frac' && (right[0].n === '?' || right[0].d === '?')) {
    // Missing part of an equivalent fraction.
    const lv = tokenValue(left[0]);
    const filled = right[0].n === '?' ? { ...right[0], n: String(p.answer) } : { ...right[0], d: String(p.answer) };
    assert.ok(equals(lv, tokenValue(filled)), p.text);
    return;
  }
  if (p.answerType === 'remainder') {
    const n = Number(left[0].v);
    const dv = Number(left[2].v);
    assert.equal(p.answer.q * dv + p.answer.r, n, p.text);
    assert.ok(p.answer.r < dv, p.text);
    return;
  }
  let v = tokenValue(left[0]);
  for (let i = 1; i < left.length; i += 2) v = OPS[left[i].v](v, tokenValue(left[i + 1]));
  assert.ok(equals(reduce(v), answerValue(p)), `${p.text} expected ${formatAnswer(p)}`);
}

/** The expected answer typed in the most natural way must be accepted. */
function typedCorrectly(p) {
  const a = p.answer;
  switch (p.answerType) {
    case 'int':
    case 'decimal':
    case 'choice':
      return { v: String(a) };
    case 'remainder':
      return { q: String(a.q), r: String(a.r) };
    case 'fraction': {
      const r = reduce(frac(a.n, a.d));
      if (p.form === 'mixed' || (p.slots.includes('w') && p.form === 'simplest')) {
        const w = Math.floor(r.n / r.d);
        const n = r.n - w * r.d;
        if (n === 0) return { w: String(w) };
        return w ? { w: String(w), n: String(n), d: String(r.d) } : { n: String(n), d: String(r.d) };
      }
      return { n: String(r.n), d: String(r.d) };
    }
  }
}

for (const skill of SKILLS) {
  test(`${skill.id}: answers are correct across options`, () => {
    const rng = createRng(1234);
    const combos = [{}, ...Array.from({ length: 40 }, () => randomOptions(skill, rng))];
    for (const options of combos) {
      const keys = skill.keys(options);
      assert.ok(keys.length > 0);
      for (let i = 0; i < 60; i++) {
        const p = makeProblem(skill.id, options, rng);
        assert.ok(keys.includes(p.factKey), `${p.factKey} not in keys`);
        assert.ok(p.text && !p.text.includes('undefined') && !p.text.includes('NaN'), p.text);
        assert.ok(labelForKey(p.factKey), p.factKey);
        verify(p);
        const res = checkAnswer(p, typedCorrectly(p));
        assert.ok(res.correct, `${p.text} typed ${JSON.stringify(typedCorrectly(p))} ${res.note || ''}`);
        checkConstraints(skill.id, withDefaults(skill.options, options), p);
      }
    }
  });

  test(`${skill.id}: generating for a specific key respects it`, () => {
    const rng = createRng(99);
    for (const key of skill.keys({})) {
      const p = makeProblem(skill.id, {}, rng, key);
      assert.equal(p.factKey, key);
    }
  });
}

function nums(p) {
  if (p.display.layout === 'vertical') return p.display.rows.map(Number);
  if (p.display.layout === 'longdiv') return [Number(p.display.dividend), Number(p.display.divisor)];
  return p.display.tokens.filter((t) => t.t === 'num').map((t) => Number(t.v));
}

function checkConstraints(id, o, p) {
  const [a, b] = nums(p);
  switch (id) {
    case 'add-facts':
      assert.ok(a <= o.max && b <= o.max);
      break;
    case 'sub-facts':
      assert.ok(a - b >= 0 && b <= o.max && a - b <= o.max);
      break;
    case 'mul-facts':
      assert.ok(o.tables.includes(a) || o.tables.includes(b));
      assert.ok(a <= Math.max(12, o.max) && b <= Math.max(12, o.max));
      break;
    case 'div-facts':
      assert.ok(b > 0 && o.divisors.includes(b) && a / b <= o.max && Number.isInteger(a / b));
      break;
    case 'add-multi': {
      assert.equal(String(a).length, o.digitsA, p.text);
      assert.equal(String(b).length, o.digitsB, p.text);
      const carry = hasCarry(a, b);
      if (o.regroup === 'none') assert.ok(!carry, p.text);
      if (o.regroup === 'required') assert.ok(carry, p.text);
      break;
    }
    case 'sub-multi': {
      assert.ok(a - b > 0, p.text);
      assert.equal(String(a).length, o.digitsA, p.text);
      const borrow = digitsOf(a).some((d, i) => d < (digitsOf(b)[i] || 0));
      if (o.regroup === 'none') assert.ok(!borrow, p.text);
      if (o.regroup === 'required') assert.ok(borrow, p.text);
      break;
    }
    case 'div-long':
      assert.ok(b > 1, p.text);
      if (o.remainders === 'none') assert.equal(a % b, 0, p.text);
      break;
    case 'frac-add-sub':
    case 'frac-mul':
    case 'frac-compare':
    case 'frac-equiv':
      for (const t of p.display.tokens) {
        if (t.t === 'frac' && t.d !== '?' && t.n !== '?' && t === p.display.tokens[0]) {
          assert.ok(Number(t.n) < Number(t.d), p.text);
        }
      }
      break;
    case 'dec-div':
      assert.ok(/^\d+(\.\d+)?$/.test(p.answer), p.text);
      break;
  }
}

function hasCarry(a, b) {
  const da = digitsOf(a);
  const db = digitsOf(b);
  let carry = 0;
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    carry = (da[i] || 0) + (db[i] || 0) + carry >= 10 ? 1 : 0;
    if (carry) return true;
  }
  return false;
}

test('fact skills enumerate the expected number of facts', () => {
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  assert.equal(getSkill('mul-facts').keys({ tables: range(0, 12), max: 12 }).length, 169);
  assert.equal(getSkill('add-facts').keys({ max: 10 }).length, 121);
  assert.equal(getSkill('div-facts').keys({ divisors: range(1, 12), max: 12 }).length, 156);
  assert.equal(getSkill('mul-facts').keys({ tables: [7], max: 12 }).length, 25);
});

test('fact grids map keys to cells and back', () => {
  for (const id of ['add-facts', 'sub-facts', 'mul-facts', 'div-facts']) {
    const skill = getSkill(id);
    for (const key of skill.keys({})) {
      const [r, c] = skill.grid.parse(key);
      assert.equal(skill.grid.keyAt(r, c), key, `${id} ${key}`);
    }
  }
});
