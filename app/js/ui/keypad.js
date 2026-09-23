// Answer entry: input boxes for the problem's slots, an on-screen keypad,
// and physical keyboard support.

import { h, clear } from './dom.js';

const MAX_LEN = 8;

const LABELS = { w: 'whole', n: 'top', d: 'bottom', q: 'answer', r: 'remainder' };

export function createAnswerInput(problem, { onSubmit, onChange } = {}) {
  const slots = problem.slots || ['v'];
  const values = Object.fromEntries(slots.map((s) => [s, '']));
  const allowDecimal = problem.answerType === 'decimal';
  const isChoice = problem.answerType === 'choice';
  let active = startSlot(problem, slots);
  let locked = false;
  const slotEls = {};

  const root = h('div.answer-input');

  function slotEl(name, small = false) {
    const el = h(`button.slot${small ? '.small' : ''}`, {
      type: 'button',
      'aria-label': `Answer box: ${LABELS[name] || 'answer'}`,
      onclick: () => setActive(name),
    });
    slotEls[name] = el;
    return el;
  }

  function buildBoxes() {
    if (problem.answerType === 'fraction') {
      const fracBox = h('span.answer-frac', slotEl('n', true), h('span.bar'), slotEl('d', true));
      return h('div.answer',
        slots.includes('w') ? h('span.slot-group', slotEl('w'), h('span.slot-label', 'whole')) : null,
        h('span.slot-group', fracBox, h('span.slot-label', 'fraction')),
      );
    }
    if (problem.answerType === 'remainder') {
      return h('div.answer',
        h('span.slot-group', slotEl('q'), h('span.slot-label', 'answer')),
        h('span.rem-sep', 'R'),
        h('span.slot-group', slotEl('r'), h('span.slot-label', 'remainder')),
      );
    }
    return h('div.answer', slotEl('v'));
  }

  function render() {
    for (const s of Object.keys(slotEls)) {
      slotEls[s].textContent = values[s];
      slotEls[s].classList.toggle('active', s === active && !locked);
    }
    if (keypad) {
      keypad.querySelector('.k-dot').disabled = !allowDecimal;
      keypad.querySelector('.k-next').disabled = slots.length < 2;
    }
    onChange && onChange(given());
  }

  function setActive(name) {
    if (locked || !slots.includes(name)) return;
    active = name;
    render();
  }

  function moveBy(step) {
    const i = slots.indexOf(active);
    active = slots[(i + step + slots.length) % slots.length];
    render();
  }

  function type(ch) {
    if (locked) return;
    const cur = values[active];
    if (ch === '.') {
      if (!allowDecimal || cur.includes('.')) return;
      values[active] = (cur || '0') + '.';
    } else {
      if (cur.length >= MAX_LEN) return;
      values[active] = cur === '0' ? ch : cur + ch;
    }
    render();
  }

  function backspace() {
    if (locked) return;
    if (!values[active] && slots.length > 1) {
      // Empty box: step back to the previous box.
      const i = slots.indexOf(active);
      if (i > 0) active = slots[i - 1];
    } else {
      values[active] = values[active].slice(0, -1);
    }
    render();
  }

  function submit() {
    if (locked) return;
    onSubmit && onSubmit(given());
  }

  function given() {
    return { ...values };
  }

  let keypad = null;
  if (isChoice) {
    const choices = problem.choices || ['<', '=', '>'];
    root.append(
      h('div.choices', choices.map((c) =>
        h('button.btn', {
          type: 'button',
          'aria-label': { '<': 'less than', '=': 'equal to', '>': 'greater than' }[c] || c,
          onclick: () => {
            if (locked) return;
            values.v = c;
            submit();
          },
        }, c),
      )),
    );
  } else {
    root.append(buildBoxes());
    const key = (label, cls, fn, aria) =>
      h(`button${cls}`, { type: 'button', 'aria-label': aria || label, onclick: fn }, label);
    const digit = (d) => key(String(d), '.k-digit', () => type(String(d)));
    keypad = h('div.keypad', { role: 'group', 'aria-label': 'Number pad' },
      digit(7), digit(8), digit(9), key('⌫', '.k-fn', backspace, 'Delete'),
      digit(4), digit(5), digit(6), key('✓', '.k-enter', submit, 'Check answer'),
      digit(1), digit(2), digit(3),
      key('.', '.k-dot.k-fn', () => type('.'), 'Decimal point'), digit(0), key('→', '.k-next.k-fn', () => moveBy(1), 'Next box'),
    );
    keypad.querySelector('.k-enter').style.gridRow = 'span 3';
  }

  function onKey(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key;
    if (isChoice) {
      const map = { '<': '<', ',': '<', ArrowLeft: '<', '>': '>', '.': '>', ArrowRight: '>', '=': '=', ArrowDown: '=' };
      if (map[k] && !locked) {
        e.preventDefault();
        values.v = map[k];
        submit();
      }
      return;
    }
    if (/^\d$/.test(k)) type(k);
    else if (k === '.' || k === ',') type('.');
    else if (k === 'Backspace') backspace();
    else if (k === 'Delete') {
      values[active] = '';
      render();
    } else if (k === 'Enter') submit();
    else if (k === 'Tab' || k === ' ' || k === 'ArrowRight' || k === 'ArrowDown') {
      if (slots.length < 2) return;
      moveBy(e.shiftKey ? -1 : 1);
    } else if (k === 'ArrowLeft' || k === 'ArrowUp') {
      if (slots.length < 2) return;
      moveBy(-1);
    } else if (k === '/' && slots.includes('d')) setActive('d');
    else if ((k === 'r' || k === 'R') && slots.includes('r')) setActive('r');
    else return;
    e.preventDefault();
  }

  document.addEventListener('keydown', onKey);
  render();

  return {
    el: root,
    keypad,
    given,
    lock() {
      locked = true;
      render();
    },
    reset() {
      for (const s of slots) values[s] = '';
      active = startSlot(problem, slots);
      locked = false;
      render();
    },
    destroy() {
      document.removeEventListener('keydown', onKey);
      if (keypad) clear(keypad);
    },
  };
}

function startSlot(problem, slots) {
  if (slots.includes('w')) {
    const mixed = problem.form === 'mixed' || (problem.factKey || '').endsWith(':mixed');
    return mixed ? 'w' : 'n';
  }
  return slots[0];
}
