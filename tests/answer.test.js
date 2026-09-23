import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, isComplete, formatAnswer, formatGiven } from '../app/js/engine/answer.js';

const intP = { answerType: 'int', answer: 56 };
const decP = { answerType: 'decimal', answer: '0.5' };
const remP = { answerType: 'remainder', answer: { q: 12, r: 3 } };
const remZero = { answerType: 'remainder', answer: { q: 12, r: 0 } };
const choiceP = { answerType: 'choice', answer: '<' };
const fracP = (n, d, form = null) => ({ answerType: 'fraction', answer: { n, d }, form });

test('integers', () => {
  assert.ok(checkAnswer(intP, { v: '56' }).correct);
  assert.ok(checkAnswer(intP, { v: ' 056 ' }).correct);
  assert.ok(!checkAnswer(intP, { v: '65' }).correct);
  assert.ok(!checkAnswer(intP, { v: '56.0' }).correct);
  assert.ok(!isComplete(intP, { v: '' }));
  assert.ok(isComplete(intP, { v: '5' }));
});

test('decimals accept equivalent forms', () => {
  for (const v of ['0.5', '.5', '0.50', '0.500']) assert.ok(checkAnswer(decP, { v }).correct, v);
  for (const v of ['5', '0.05', '.', 'x']) assert.ok(!checkAnswer(decP, { v }).correct, v);
  assert.equal(formatAnswer({ answerType: 'decimal', answer: '1.50' }), '1.5');
});

test('remainders', () => {
  assert.ok(checkAnswer(remP, { q: '12', r: '3' }).correct);
  assert.ok(!checkAnswer(remP, { q: '12', r: '' }).correct);
  assert.ok(checkAnswer(remZero, { q: '12', r: '' }).correct);
  assert.ok(checkAnswer(remZero, { q: '12', r: '0' }).correct);
  assert.ok(!checkAnswer(remP, { q: '13', r: '3' }).correct);
  assert.equal(formatAnswer(remP), '12 R 3');
  assert.equal(formatAnswer(remZero), '12');
  assert.ok(!isComplete(remP, { q: '', r: '3' }));
  assert.equal(formatGiven(remP, { q: '12', r: '3' }), '12 R 3');
});

test('choices', () => {
  assert.ok(checkAnswer(choiceP, { v: '<' }).correct);
  assert.ok(!checkAnswer(choiceP, { v: '>' }).correct);
});

test('fractions accept equivalent values by default', () => {
  const p = fracP(7, 4);
  assert.ok(checkAnswer(p, { n: '7', d: '4' }).correct);
  assert.ok(checkAnswer(p, { n: '14', d: '8' }).correct);
  assert.ok(checkAnswer(p, { w: '1', n: '3', d: '4' }).correct);
  assert.ok(!checkAnswer(p, { w: '1', n: '1', d: '4' }).correct);
  assert.ok(!checkAnswer(p, { n: '7', d: '0' }).correct);
  const whole = fracP(2, 1);
  assert.ok(checkAnswer(whole, { w: '2' }).correct);
  assert.ok(checkAnswer(whole, { n: '4', d: '2' }).correct);
});

test('fraction completeness', () => {
  const p = fracP(3, 4);
  assert.ok(!isComplete(p, { n: '3', d: '' }));
  assert.ok(isComplete(p, { n: '3', d: '4' }));
  assert.ok(isComplete(p, { w: '1' }));
  assert.ok(!isComplete(p, {}));
  assert.ok(!isComplete(p, { w: '1', n: '3' }));
});

test('simplest form rule', () => {
  const p = fracP(1, 2, 'simplest');
  assert.ok(checkAnswer(p, { n: '1', d: '2' }).correct);
  const r = checkAnswer(p, { n: '2', d: '4' });
  assert.ok(!r.correct);
  assert.match(r.note, /simplified/);
  const big = fracP(3, 2, 'simplest');
  assert.ok(checkAnswer(big, { n: '3', d: '2' }).correct);
  assert.ok(checkAnswer(big, { w: '1', n: '1', d: '2' }).correct);
  assert.ok(!checkAnswer(big, { w: '1', n: '2', d: '4' }).correct);
  const whole = fracP(2, 1, 'simplest');
  assert.ok(checkAnswer(whole, { w: '2' }).correct);
  assert.ok(!checkAnswer(whole, { n: '4', d: '2' }).correct);
});

test('mixed and improper form rules', () => {
  const m = fracP(11, 4, 'mixed');
  assert.ok(checkAnswer(m, { w: '2', n: '3', d: '4' }).correct);
  assert.ok(!checkAnswer(m, { n: '11', d: '4' }).correct);
  assert.match(checkAnswer(m, { n: '11', d: '4' }).note, /mixed/);
  assert.equal(formatAnswer(m), '2 3/4');
  const i = fracP(11, 4, 'improper');
  assert.ok(checkAnswer(i, { n: '11', d: '4' }).correct);
  assert.ok(!checkAnswer(i, { w: '2', n: '3', d: '4' }).correct);
});
