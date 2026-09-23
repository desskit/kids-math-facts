// Fact grid colored by mastery status, e.g. the 13×13 times table.

import { h, fmtPct, fmtSec } from './dom.js';
import { factStatus, STATUS_LABELS } from '../engine/mastery.js';

const GLYPH = { new: '', struggling: '!', learning: '•', mastered: '✓' };

/**
 * skill: a fact skill with .grid
 * stats: factStats map; fluencyMs: goal for "mastered"
 * size: largest row/column value to show
 */
export function heatmap(skill, stats, fluencyMs, size) {
  const g = skill.grid;
  const rows = [];
  for (let r = g.start; r <= size; r++) rows.push(r);
  const cols = [];
  for (let c = 0; c <= size; c++) cols.push(c);

  const detail = h('div.cell-detail.secondary', { 'aria-live': 'polite' }, 'Tap a square to see how that fact is going.');
  const cellPx = Math.max(20, Math.min(34, Math.floor((Math.min(window.innerWidth, 900) - 72) / (cols.length + 1)) - 2));

  const grid = h('div.heatmap', {
    role: 'grid',
    'aria-label': `${skill.label} mastery grid`,
    style: { gridTemplateColumns: `repeat(${cols.length + 1}, var(--cell))`, '--cell': `${cellPx}px` },
  });
  grid.style.setProperty('--cell', `${cellPx}px`);
  grid.append(h('div.hhead', g.op));
  for (const c of cols) grid.append(h('div.hhead', String(c)));

  for (const r of rows) {
    grid.append(h('div.hhead', String(r)));
    for (const c of cols) {
      const key = g.keyAt(r, c);
      const stat = stats[key];
      const status = factStatus(stat, fluencyMs);
      const label = skill.keyLabel(key);
      const text = describe(label, stat, status, key, skill);
      grid.append(
        h(`button.hcell.st-${status}`, {
          type: 'button',
          title: text,
          'aria-label': text,
          onclick: () => (detail.textContent = text),
        }, GLYPH[status]),
      );
    }
  }

  return h('div',
    h('div.heatmap-wrap', grid),
    h('div.legend', ['mastered', 'learning', 'struggling', 'new'].map((s) => h('span', h(`i.st-${s}`, GLYPH[s]), STATUS_LABELS[s]))),
    detail,
  );
}

function describe(label, stat, status, key, skill) {
  const answer = answerFor(key, skill);
  const head = `${label} = ${answer}`;
  if (!stat || !stat.attempts) return `${head} · not tried yet`;
  return `${head} · ${STATUS_LABELS[status]} · ${stat.attempts} tries, ${fmtPct(stat.correct / stat.attempts)} right, ${fmtSec(stat.totalMs / stat.attempts)} average`;
}

function answerFor(key, skill) {
  const [r, c] = skill.grid.parse(key);
  switch (skill.id) {
    case 'add-facts':
      return r + c;
    case 'mul-facts':
      return r * c;
    default:
      return c; // subtraction and division grids use the answer as the column
  }
}
