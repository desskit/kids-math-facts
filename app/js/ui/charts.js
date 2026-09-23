// Small hand-rolled SVG charts: one series each, one y-axis, hover/tap
// tooltips, and sized to their container so text stays readable.

import { h, svg, clear } from './dom.js';

const M = { top: 12, right: 44, bottom: 24, left: 40 };
const HEIGHT = 180;

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function dayNum(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function shortDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * points: [{ day: 'YYYY-MM-DD', y: number, tip: string }]
 * opts: { kind: 'line' | 'bar', yMax, format(y), label }
 */
export function chart(points, opts) {
  const root = h('div.chart');
  if (!points.length) {
    root.append(h('div.chart-empty', 'No practice in this time range yet.'));
    return root;
  }
  const tooltip = h('div.tooltip', { hidden: true });
  let width = 0;

  const draw = () => {
    const w = Math.max(260, Math.round(root.clientWidth || 320));
    if (w === width) return;
    width = w;
    clear(root);
    root.append(build(points, opts, w, tooltip), tooltip);
  };

  const ro = new ResizeObserver(draw);
  ro.observe(root);
  requestAnimationFrame(draw);
  return root;
}

function build(points, opts, W, tooltip) {
  const innerW = W - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const yMax = opts.yMax ?? niceMax(Math.max(...points.map((p) => p.y)));
  const x0 = dayNum(points[0].day);
  const x1 = dayNum(points[points.length - 1].day);
  const span = Math.max(1, x1 - x0);
  const isBar = opts.kind === 'bar';
  const barW = isBar ? Math.max(3, Math.min(24, (innerW / (span + 1)) - 2)) : 0;
  const pad = isBar ? barW / 2 + 1 : 0;
  const xOf = (day) => (points.length === 1 ? innerW / 2 : pad + ((dayNum(day) - x0) / span) * (innerW - pad * 2));
  const yOf = (v) => innerH - (Math.min(v, yMax) / yMax) * innerH;

  const g = svg('g', { transform: `translate(${M.left},${M.top})` });

  // Gridlines and y ticks (0, half, max)
  for (const t of [0, yMax / 2, yMax]) {
    const y = yOf(t);
    g.append(
      svg('line', { class: 'gridline', x1: 0, x2: innerW, y1: y, y2: y }),
      svg('text', { class: 'axis-text', x: -8, y: y + 4, 'text-anchor': 'end' }, opts.format(t, true)),
    );
  }
  // x labels: first and last day
  const xLabels = points.length === 1 ? [points[0]] : [points[0], points[points.length - 1]];
  xLabels.forEach((p, i) => {
    g.append(svg('text', {
      class: 'axis-text',
      x: xOf(p.day),
      y: innerH + 18,
      'text-anchor': points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end',
    }, shortDate(p.day)));
  });

  if (isBar) {
    for (const p of points) {
      const x = xOf(p.day) - barW / 2;
      const y = yOf(p.y);
      const hgt = innerH - y;
      const r = Math.min(4, barW / 2, hgt);
      // Rounded data-end, square at the baseline.
      g.append(svg('path', {
        class: 'bar',
        d: `M${x},${innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${innerH} Z`,
      }));
    }
  } else {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.day)},${yOf(p.y)}`).join(' ');
    if (points.length > 1) {
      g.append(
        svg('path', { class: 'area', d: `${d} L${xOf(points[points.length - 1].day)},${innerH} L${xOf(points[0].day)},${innerH} Z` }),
        svg('path', { class: 'line', d }),
      );
    }
    const last = points[points.length - 1];
    g.append(
      svg('circle', { class: 'dot', cx: xOf(last.day), cy: yOf(last.y), r: 4.5 }),
      svg('text', { class: 'end-label', x: xOf(last.day) + 8, y: yOf(last.y) + 4 }, opts.format(last.y)),
    );
  }

  // Hover layer
  const cross = svg('line', { class: 'crosshair', y1: 0, y2: innerH, visibility: 'hidden' });
  const hoverDot = svg('circle', { class: 'dot', r: 5, visibility: 'hidden' });
  const hit = svg('rect', { class: 'hit', x: -8, y: -M.top, width: innerW + 16, height: innerH + M.top + 8 });
  g.append(...[cross, isBar ? null : hoverDot, hit].filter(Boolean));

  const show = (evt) => {
    const rect = hit.getBoundingClientRect();
    const mx = evt.clientX - rect.left - 8;
    let best = points[0];
    let bestD = Infinity;
    for (const p of points) {
      const dd = Math.abs(xOf(p.day) - mx);
      if (dd < bestD) {
        bestD = dd;
        best = p;
      }
    }
    const cx = xOf(best.day);
    const cy = yOf(best.y);
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('visibility', 'visible');
    if (!isBar) {
      hoverDot.setAttribute('cx', cx);
      hoverDot.setAttribute('cy', cy);
      hoverDot.setAttribute('visibility', 'visible');
    }
    clear(tooltip).append(h('strong', shortDate(best.day)), best.tip || opts.format(best.y));
    tooltip.hidden = false;
    tooltip.style.left = `${Math.min(Math.max(M.left + cx, 70), W - 70)}px`;
    tooltip.style.top = `${M.top + cy}px`;
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    hoverDot.setAttribute('visibility', 'hidden');
    tooltip.hidden = true;
  };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', hide);

  return svg('svg', {
    viewBox: `0 0 ${W} ${HEIGHT}`,
    width: W,
    height: HEIGHT,
    role: 'img',
    'aria-label': opts.label,
  }, g);
}
