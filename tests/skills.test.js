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
    else if (f.type === 'range') {
      const a = rng.int(f.min, f.max);
      const b = rng.int(f.min, f.max);
      o[f.key] = [Math.min(a, b), Math.max(a, b)];
    }
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
  // Put the answer in the blank (wherever it is) and check both sides agree.
  assert.equal(t.filter((x) => x.t === 'blank').length, 1, p.text);
  const value = (tok) => (tok.t === 'blank' ? answerValue(p) : tokenValue(tok));
  const side = (tokens) => {
    let v = value(tokens[0]);
    for (let i = 1; i < tokens.length; i += 2) v = OPS[tokens[i].v](v, value(tokens[i + 1]));
    return reduce(v);
  };
  assert.ok(equals(side(left), side(right)), `${p.text} expected ${formatAnswer(p)}`);
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

const inRange = (v, [lo, hi]) => v >= lo && v <= hi;

function checkFactBlank(o, p) {
  const tokens = p.display.tokens;
  const atEnd = tokens[tokens.length - 1].t === 'blank';
  if (o.blank === 'end') assert.ok(atEnd, p.text);
  // "Missing" puts the blank on an operand, except "0 × 0" where that has no single answer.
  if (o.blank === 'missing' && p.factKey !== 'mul:0x0') assert.ok(!atEnd, p.text);
}

function checkConstraints(id, o, p) {
  if (getSkill(id).grid) {
    // Facts: check the fact itself (from its key), since the blank may be anywhere.
    const [r, c] = getSkill(id).grid.parse(p.factKey);
    if (id === 'add-facts') assert.ok(inRange(r, o.first) && inRange(c, o.second), p.factKey);
    if (id === 'sub-facts') assert.ok(inRange(r, o.taken) && inRange(c, o.answer), p.factKey);
    if (id === 'mul-facts') {
      assert.ok((o.tables.includes(r) && inRange(c, o.by)) || (o.tables.includes(c) && inRange(r, o.by)), p.factKey);
    }
    if (id === 'div-facts') assert.ok(r > 0 && o.divisors.includes(r) && inRange(c, o.answer), p.factKey);
    checkFactBlank(o, p);
    return;
  }
  const [a, b] = nums(p);
  switch (id) {
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

test('fact ranges limit which facts are asked', () => {
  const keys = (id, o) => getSkill(id).keys(o);
  // Times tables 7 only, multiplied by 2–9 (both orders; 7 × 7 once).
  assert.equal(keys('mul-facts', { tables: [7], by: [2, 9] }).length, 15);
  // Tables beyond 12.
  assert.ok(keys('mul-facts', { tables: [15], by: [0, 20] }).includes('mul:15x20'));
  // Adding a range to a single number: 10–20 plus 9.
  assert.deepEqual(keys('add-facts', { first: [10, 20], second: [9, 9] }).length, 11);
  assert.ok(keys('add-facts', { first: [0, 100], second: [0, 100] }).includes('add:100+100'));
  // Subtraction: take away 5–6, answers 0–3.
  assert.deepEqual(
    keys('sub-facts', { taken: [5, 6], answer: [0, 3] }).sort(),
    ['sub:5-5', 'sub:6-5', 'sub:7-5', 'sub:8-5', 'sub:6-6', 'sub:7-6', 'sub:8-6', 'sub:9-6'].sort(),
  );
  assert.equal(keys('div-facts', { divisors: [13], answer: [1, 20] }).length, 20);
});

test('settings saved before ranges existed still work', () => {
  const keys = (id, o) => getSkill(id).keys(o);
  assert.equal(keys('add-facts', { max: 5 }).length, 36);
  assert.equal(keys('sub-facts', { max: 5 }).length, 36);
  assert.equal(keys('mul-facts', { tables: [7], max: 10 }).length, 21);
  assert.equal(keys('div-facts', { divisors: [3], max: 10 }).length, 11);
});

test('range options are cleaned up', async () => {
  const { cleanRange } = await import('../app/js/skills/common.js');
  const f = { min: 0, max: 20, default: [0, 12] };
  assert.deepEqual(cleanRange([9, 2], f), [2, 9], 'swapped into order');
  assert.deepEqual(cleanRange([-5, 99], f), [0, 20], 'clamped');
  assert.deepEqual(cleanRange(['3', '4'], f), [3, 4], 'strings from inputs');
  assert.deepEqual(cleanRange('junk', f), [0, 12]);
  assert.deepEqual(cleanRange([1, NaN], f), [0, 12]);
});

test('missing-number facts put the blank on an operand', () => {
  const rng = createRng(31);
  const seen = new Set();
  for (const id of ['add-facts', 'sub-facts', 'mul-facts', 'div-facts']) {
    for (let i = 0; i < 300; i++) {
      const p = makeProblem(id, { blank: 'missing' }, rng);
      if (p.factKey === 'mul:0x0') continue;
      assert.ok(p.text.includes('?') && !p.text.endsWith('= ?'), p.text);
      seen.add(p.text.indexOf('?') === 0 ? 'first' : 'second');
      assert.ok(checkAnswer(p, { v: String(p.answer) }).correct, p.text);
    }
  }
  assert.ok(seen.has('first') && seen.has('second'), 'both blank positions appear');
  // "Both" mixes the usual form with missing numbers.
  const forms = new Set();
  for (let i = 0; i < 100; i++) forms.add(makeProblem('mul-facts', { blank: 'mix' }, rng).text.endsWith('= ?'));
  assert.equal(forms.size, 2);
});
