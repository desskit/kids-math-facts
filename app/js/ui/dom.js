// Minimal DOM helpers.

/**
 * h('div.card#id', { onclick, class, style, ...attrs }, ...children)
 * Children may be strings, nodes, arrays, or null/false (skipped).
 */
export function h(tag, attrs, ...children) {
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// ------------------------------------------------------------ formatting

export function fmtPct(x) {
  return `${Math.round(x * 100)}%`;
}

export function fmtSec(ms) {
  if (!ms) return '0s';
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtNum(n) {
  return new Intl.NumberFormat().format(n);
}

export function fmtDate(ts, opts = { month: 'short', day: 'numeric' }) {
  return new Date(ts).toLocaleDateString(undefined, opts);
}

export function fmtDateTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

// ------------------------------------------------------------ toast & dialogs

let toastTimer = null;

export function toast(message, { action, onAction, duration = 3500 } = {}) {
  const el = document.getElementById('toast');
  clear(el);
  el.append(h('span', message));
  if (action) {
    el.append(
      h('button.btn', {
        type: 'button',
        onclick: () => {
          el.hidden = true;
          onAction && onAction();
        },
      }, action),
    );
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  if (duration) toastTimer = setTimeout(() => (el.hidden = true), duration);
}

/** Show a modal dialog; resolves with the value of the button pressed. */
export function dialog({ title, body, buttons }) {
  return new Promise((resolve) => {
    const d = h('dialog',
      h('h2', title),
      body ? (typeof body === 'string' ? h('p', body) : body) : null,
      h('form.row.end', { method: 'dialog' },
        buttons.map((b) => h(`button.btn${b.primary ? '.primary' : ''}${b.danger ? '.danger' : ''}`, { value: b.value, type: 'submit' }, b.label)),
      ),
    );
    d.addEventListener('close', () => {
      resolve(d.returnValue || null);
      d.remove();
    });
    document.body.append(d);
    d.showModal();
  });
}

export function confirmDialog(title, body, okLabel = 'OK', { danger = false } = {}) {
  return dialog({
    title,
    body,
    buttons: [
      { label: 'Cancel', value: 'cancel' },
      { label: okLabel, value: 'ok', primary: !danger, danger },
    ],
  }).then((v) => v === 'ok');
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];
  const wrap = h('div.confetti', { 'aria-hidden': 'true' });
  for (let i = 0; i < 80; i++) {
    wrap.append(
      h('i', {
        style: {
          left: `${Math.random() * 100}%`,
          background: colors[i % colors.length],
          animationDuration: `${1.8 + Math.random() * 1.8}s`,
          animationDelay: `${Math.random() * 0.6}s`,
        },
      }),
    );
  }
  document.body.append(wrap);
  setTimeout(() => wrap.remove(), 4500);
}
