// Answer types, input slots, and checking.
//
// A problem carries:
//   answerType: 'int' | 'decimal' | 'fraction' | 'remainder' | 'choice'
//   answer:     number | decimal string | {n,d} | {q,r} | '<' '=' '>'
//   slots:      input boxes the UI shows, e.g. ['v'] or ['w','n','d']
//   form:       optional extra rule for fractions: 'simplest' | 'mixed' | 'improper'
//
// The player's input ("given") is always an object of strings keyed by slot.

import { frac, equals, isSimplest, format as formatFrac, reduce } from '../lib/fraction.js';
import { parseDecimal, formatDecimal } from '../lib/decimal.js';

export const SLOTS = {
  int: ['v'],
  decimal: ['v'],
  fraction: ['n', 'd'],
  mixed: ['w', 'n', 'd'],
  remainder: ['q', 'r'],
  choice: ['v'],
};

const INT_RE = /^\d+$/;

/** True when the input has enough filled in to be checked. */
export function isComplete(problem, given) {
  const g = given || {};
  switch (problem.answerType) {
    case 'int':
    case 'decimal':
    case 'choice':
      return !!(g.v && String(g.v).trim());
    case 'remainder':
      return !!(g.q && String(g.q).trim());
    case 'fraction': {
      const hasW = !!(g.w && g.w.trim());
      const hasN = !!(g.n && g.n.trim());
      const hasD = !!(g.d && g.d.trim());
      if (hasN || hasD) return hasN && hasD;
      return hasW;
    }
    default:
      return false;
  }
}

/** Parse fraction input into { value, whole, n, d } or null if malformed. */
function parseFractionInput(g) {
  const w = (g.w || '').trim();
  const n = (g.n || '').trim();
  const d = (g.d || '').trim();
  if ((w && !INT_RE.test(w)) || (n && !INT_RE.test(n)) || (d && !INT_RE.test(d))) return null;
  if ((n && !d) || (!n && d)) return null;
  if (!w && !n) return null;
  const whole = w ? Number(w) : 0;
  if (!n) return { value: frac(whole, 1), whole: w ? whole : null, n: null, d: null };
  const nn = Number(n);
  const dd = Number(d);
  if (dd === 0) return null;
  return { value: reduce(frac(whole * dd + nn, dd)), whole: w ? whole : null, n: nn, d: dd };
}

/**
 * Check an answer. Returns { correct, note } where note explains a near miss
 * (for example, the right value but not in simplest form).
 */
export function checkAnswer(problem, given) {
  const g = given || {};
  const a = problem.answer;
  switch (problem.answerType) {
    case 'int': {
      const s = String(g.v ?? '').trim();
      return { correct: INT_RE.test(s) && Number(s) === a };
    }
    case 'decimal': {
      const v = parseDecimal(g.v ?? '');
      const target = parseDecimal(a);
      return { correct: !!v && equals(v, target) };
    }
    case 'choice':
      return { correct: String(g.v) === a };
    case 'remainder': {
      const q = String(g.q ?? '').trim();
      const r = String(g.r ?? '').trim() || '0';
      if (!INT_RE.test(q) || !INT_RE.test(r)) return { correct: false };
      return { correct: Number(q) === a.q && Number(r) === a.r };
    }
    case 'fraction': {
      const p = parseFractionInput(g);
      if (!p) return { correct: false };
      const target = frac(a.n, a.d);
      if (!equals(p.value, target)) return { correct: false };
      return checkForm(problem.form, p, target);
    }
    default:
      return { correct: false };
  }
}

function checkForm(form, p, target) {
  if (!form) return { correct: true };
  const isWholeNumber = target.d === 1 || reduce(target).d === 1;
  if (form === 'simplest') {
    if (p.n === null) return { correct: true };
    if (p.n === 0 && p.whole !== null) return { correct: true };
    if (!isSimplest({ n: p.n, d: p.d })) {
      return { correct: false, note: 'Right value, but it can be simplified.' };
    }
    if (p.whole !== null && p.n >= p.d) {
      return { correct: false, note: 'Right value, but the fraction part should be less than 1.' };
    }
    if (isWholeNumber && p.n !== 0) {
      return { correct: false, note: 'Right value, but it simplifies to a whole number.' };
    }
    return { correct: true };
  }
  if (form === 'mixed') {
    if (isWholeNumber) {
      return p.n === null || p.n === 0
        ? { correct: true }
        : { correct: false, note: 'Right value, but write it as a whole number.' };
    }
    if (p.whole === null || p.n >= p.d) {
      return { correct: false, note: 'Right value, but write it as a mixed number.' };
    }
    if (!isSimplest({ n: p.n, d: p.d })) {
      return { correct: false, note: 'Right value, but the fraction part can be simplified.' };
    }
    return { correct: true };
  }
  if (form === 'improper') {
    if (p.whole !== null && p.n !== null) {
      return { correct: false, note: 'Right value, but write it as one fraction.' };
    }
    return { correct: true };
  }
  return { correct: true };
}

/** Human-friendly text for the expected answer. */
export function formatAnswer(problem) {
  const a = problem.answer;
  switch (problem.answerType) {
    case 'int':
      return String(a);
    case 'decimal':
      return formatDecimal(parseDecimal(a));
    case 'choice':
      return a;
    case 'remainder':
      return a.r ? `${a.q} R ${a.r}` : String(a.q);
    case 'fraction':
      return formatFrac(frac(a.n, a.d), { mixed: problem.form === 'mixed' });
    default:
      return String(a);
  }
}

/** Human-friendly text for what the player typed. */
export function formatGiven(problem, given) {
  const g = given || {};
  switch (problem.answerType) {
    case 'remainder':
      return g.r && g.r !== '0' ? `${g.q} R ${g.r}` : String(g.q ?? '');
    case 'fraction': {
      const parts = [];
      if (g.w) parts.push(g.w);
      if (g.n || g.d) parts.push(`${g.n || '?'}/${g.d || '?'}`);
      return parts.join(' ');
    }
    default:
      return String(g.v ?? '');
  }
}
