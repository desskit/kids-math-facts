// Render a problem's display data as DOM.

import { h } from './dom.js';

function part(v) {
  return v === '?' ? h('span.q', '?') : v;
}

function token(tok) {
  switch (tok.t) {
    case 'num':
      return h('span.num', part(tok.v));
    case 'op':
      return h('span.op', tok.v);
    case 'blank':
      return h('span.q', '?');
    case 'frac':
      return h('span.frac',
        tok.w ? h('span.whole', tok.w) : null,
        h('span.frac-parts', h('span', part(tok.n)), h('span', part(tok.d))),
      );
    default:
      return null;
  }
}

export function renderProblem(problem) {
  const d = problem.display;
  let body;
  if (d.layout === 'vertical') {
    body = h('div.problem', { role: 'img', 'aria-label': problem.text },
      h('span.vertical',
        h('span'), h('span', d.rows[0]),
        h('span.op', d.op), h('span', d.rows[1]),
        h('span.line'),
      ),
    );
  } else if (d.layout === 'longdiv') {
    body = h('div.problem', { role: 'img', 'aria-label': problem.text },
      h('span.longdiv', h('span.divisor', d.divisor), h('span.dividend', d.dividend)),
    );
  } else {
    const long = d.tokens.reduce((n, t) => n + (t.t === 'num' ? t.v.length : t.t === 'frac' ? 2 : 1), 0) > 11;
    body = h(`div.problem${long ? '.long' : ''}`, { role: 'img', 'aria-label': problem.text }, d.tokens.map(token));
  }
  return h('div.problem-wrap', problem.prompt ? h('div.prompt.center', problem.prompt) : null, body);
}
