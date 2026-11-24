import { h, clear, dialog, toast } from '../dom.js';
import { startRound } from '../../app.js';
import { listPresets, savePreset, newId } from '../../data/store.js';
import { BUILT_IN_PRESETS } from '../../engine/presets.js';
import { skillCounts, DEFAULT_SKILL_COUNT, MAX_SKILL_COUNT } from '../../engine/config.js';
import { SKILLS, CATEGORIES, skillOptions } from '../../skills/index.js';
import { cleanRange } from '../../skills/common.js';
import { navigate } from '../../router.js';

const SECONDS = [30, 60, 120, 180, 300];

export async function renderSetup(main, _params, query) {
  const presets = await listPresets();
  const fromPreset = query.preset
    ? presets.find((p) => p.id === query.preset) || BUILT_IN_PRESETS.find((p) => p.id === query.preset)
    : null;
  const editing = fromPreset && !fromPreset.id.startsWith('bi-') ? fromPreset : null;

  // Editable state
  const base = fromPreset?.config || {
    mode: 'count',
    seconds: 120,
    retryMissed: true,
    skills: [{ id: 'mul-facts', options: {}, count: 20 }],
  };
  const state = {
    mode: base.mode,
    seconds: base.seconds || 120,
    retryMissed: base.retryMissed ?? true,
    skills: Object.fromEntries(
      SKILLS.map((s) => [s.id, { on: false, options: skillOptions(s), count: DEFAULT_SKILL_COUNT }]),
    ),
  };
  const baseCounts = skillCounts(base);
  (base.skills || []).forEach((s, i) => {
    const skill = SKILLS.find((x) => x.id === s.id);
    if (skill) state.skills[s.id] = { on: true, options: skillOptions(skill, s.options), count: baseCounts[i] };
  });

  const chosen = () => Object.entries(state.skills).filter(([, v]) => v.on);
  const total = () => chosen().reduce((sum, [, v]) => sum + v.count, 0);

  function config() {
    const skills = chosen().map(([id, v]) => ({ id, options: structuredClone(v.options), count: v.count }));
    return {
      mode: state.mode,
      count: skills.reduce((sum, s) => sum + s.count, 0),
      seconds: state.seconds,
      retryMissed: state.mode === 'count' ? state.retryMissed : false,
      skills,
    };
  }

  function validate() {
    const c = config();
    if (!c.skills.length) return 'Pick at least one kind of problem.';
    for (const s of c.skills) {
      const skill = SKILLS.find((x) => x.id === s.id);
      for (const f of skill.options) {
        if (f.type === 'multi' && (!s.options[f.key] || !s.options[f.key].length)) {
          return `${skill.label}: pick at least one of “${f.label}”.`;
        }
      }
    }
    return null;
  }

  const title = editing ? `Edit “${editing.name}”` : fromPreset ? `Customize “${fromPreset.name}”` : 'Build a practice round';

  // ---- mode and length
  const modeCard = (value, label, desc) =>
    h('label.choice-card',
      h('input', {
        type: 'radio',
        name: 'mode',
        value,
        checked: state.mode === value,
        onchange: () => {
          state.mode = value;
          renderLength();
          refresh();
        },
      }),
      h('strong', label),
      h('span', desc),
    );

  const summary = h('div.round-summary', { 'aria-live': 'polite' });
  const lengthBox = h('div');
  function renderLength() {
    clear(lengthBox);
    if (state.mode === 'timed') {
      lengthBox.append(
        h('div.field', h('span.label', 'How long?'),
          h('div.chips', SECONDS.map((s) => radioChip('seconds', s, s < 60 ? `${s} sec` : `${s / 60} min`, state.seconds === s, () => (state.seconds = s)))),
        ),
      );
    }
    lengthBox.append(summary);
    if (state.mode === 'count') {
      lengthBox.append(
        h('label.switch',
          h('input', { type: 'checkbox', checked: state.retryMissed, onchange: (e) => (state.retryMissed = e.target.checked) }),
          'Try missed problems again at the end',
        ),
      );
    }
    if (state.mode === 'mastery') {
      lengthBox.append(h('p.small.secondary', 'Mastery picks the facts that need the most practice, and brings back missed problems a few questions later until they’re right.'));
    }
  }

  // ---- per-kind counts: kept in sync by refresh()
  const countWidgets = []; // { skillId, label, share }
  const startTotal = h('span.start-total');

  function refresh() {
    const list = chosen();
    const n = total();
    const timed = state.mode === 'timed';
    clear(summary);
    if (!list.length) {
      summary.append(h('p.small.secondary', 'Pick at least one kind of problem below.'));
    } else if (timed) {
      summary.append(
        h('p.small.secondary', 'Answer as many as you can. The numbers next to each kind of problem set the mix.'),
      );
    } else {
      summary.append(
        h('p.total-line', 'Total: ', h('strong', `${n} question${n === 1 ? '' : 's'}`)),
        h('p.small.secondary', list.length > 1
          ? list.map(([id, v]) => `${v.count} ${SKILLS.find((s) => s.id === id).label.toLowerCase()}`).join(' · ')
          : 'Change the number of questions under the problem below.'),
      );
    }
    for (const w of countWidgets) {
      const st = state.skills[w.skillId];
      w.label.textContent = timed ? 'Share of the sprint' : 'Number of questions';
      w.share.textContent = timed && st.on && n ? `about ${Math.round((st.count / n) * 100)}% of questions` : '';
    }
    startTotal.textContent = !list.length || timed ? '' : `${n} question${n === 1 ? '' : 's'}`;
  }

  function countField(skill) {
    const st = state.skills[skill.id];
    const label = h('span.label');
    const share = h('span.small.secondary');
    const input = h('input', {
      type: 'number',
      inputmode: 'numeric',
      min: '1',
      max: String(MAX_SKILL_COUNT),
      value: String(st.count),
      'aria-label': `Number of ${skill.label.toLowerCase()} questions`,
      oninput: (e) => {
        const v = Number(e.target.value);
        if (Number.isInteger(v) && v >= 1 && v <= MAX_SKILL_COUNT) {
          st.count = v;
          refresh();
        }
      },
      onchange: () => set(Number(input.value)),
    });
    const set = (v) => {
      st.count = Math.min(MAX_SKILL_COUNT, Math.max(1, Math.round(Number.isFinite(v) ? v : st.count)));
      input.value = String(st.count);
      refresh();
    };
    countWidgets.push({ skillId: skill.id, label, share });
    return h('div.field.count-field',
      label,
      h('div.row',
        h('div.stepper',
          h('button.btn', { type: 'button', 'aria-label': 'One fewer', onclick: () => set(st.count - 1) }, '−'),
          input,
          h('button.btn', { type: 'button', 'aria-label': 'One more', onclick: () => set(st.count + 1) }, '+'),
        ),
        share,
      ),
    );
  }

  // ---- skills
  const skillSections = CATEGORIES.map((cat) =>
    h('section.skill-group',
      h('h3', cat.label),
      h('div.skill-list', SKILLS.filter((s) => s.category === cat.id).map(skillItem)),
    ),
  );

  function skillItem(skill) {
    const st = state.skills[skill.id];
    const optsBox = h('div.skill-options', { hidden: !st.on },
      countField(skill),
      skill.options.map((f) => optionField(skill, f)),
    );
    const item = h(`div.skill-item${st.on ? '.on' : ''}`,
      h('label.skill-head',
        h('input', {
          type: 'checkbox',
          checked: st.on,
          onchange: (e) => {
            st.on = e.target.checked;
            optsBox.hidden = !st.on;
            item.classList.toggle('on', st.on);
            refresh();
          },
        }),
        h('span.title', skill.label),
        h('span.pill.grade', `Grade ${skill.grade}`),
      ),
      optsBox,
    );
    return item;
  }

  function optionField(skill, f) {
    const opts = state.skills[skill.id].options;
    const name = `${skill.id}-${f.key}`;
    if (f.type === 'toggle') {
      return h('div.field',
        h('label.switch',
          h('input', { type: 'checkbox', checked: !!opts[f.key], onchange: (e) => (opts[f.key] = e.target.checked) }),
          f.label,
        ),
      );
    }
    if (f.type === 'select') {
      return h('div.field',
        h('span.label', f.label),
        h('div.chips', f.options.map((o) => radioChip(name, o.value, o.label, opts[f.key] === o.value, () => (opts[f.key] = o.value)))),
      );
    }
    if (f.type === 'range') {
      const numberInput = (i, which) =>
        h('input', {
          type: 'number',
          inputmode: 'numeric',
          min: String(f.min),
          max: String(f.max),
          value: String(opts[f.key][i]),
          'aria-label': `${f.label} ${which}`,
          onchange: (e) => {
            const next = opts[f.key].slice();
            const v = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isFinite(v)) next[i] = v;
            // The box just edited wins: raising "from" past "to" moves "to" up with it.
            if (next[0] > next[1]) next[1 - i] = next[i];
            opts[f.key] = cleanRange(next, f);
            lo.value = String(opts[f.key][0]);
            hi.value = String(opts[f.key][1]);
          },
        });
      const lo = numberInput(0, 'from');
      const hi = numberInput(1, 'to');
      return h('div.field',
        h('span.label', f.label),
        h('div.range-inputs', h('span', 'from'), lo, h('span', 'to'), hi, h('span.small.muted', `(${f.min}–${f.max})`)),
      );
    }
    if (f.type === 'multi') {
      const all = f.options.map((o) => o.value);
      const boxes = [];
      const chips = f.options.map((o) => {
        const input = h('input', {
          type: 'checkbox',
          checked: opts[f.key].includes(o.value),
          onchange: (e) => {
            const set = new Set(opts[f.key]);
            e.target.checked ? set.add(o.value) : set.delete(o.value);
            opts[f.key] = all.filter((v) => set.has(v));
          },
        });
        boxes.push(input);
        return h('label.chip', input, o.label);
      });
      const setAll = (on) => {
        opts[f.key] = on ? all.slice() : [];
        boxes.forEach((b) => (b.checked = on));
      };
      return h('div.field',
        h('div.row.between',
          h('span.label', f.label),
          all.length > 4
            ? h('span.row',
                h('button.btn.ghost.small', { type: 'button', onclick: () => setAll(true) }, 'All'),
                h('button.btn.ghost.small', { type: 'button', onclick: () => setAll(false) }, 'None'),
              )
            : null,
        ),
        h('div.chips', chips),
      );
    }
    return null;
  }

  // ---- actions
  async function start() {
    const err = validate();
    if (err) return toast(err);
    startRound(config(), editing ? { presetId: editing.id, presetName: editing.name } : {});
  }

  async function save() {
    const err = validate();
    if (err) return toast(err);
    const input = h('input', { type: 'text', value: editing?.name || '', placeholder: 'e.g. Times tables 6–9', maxlength: '40', style: { width: '100%' } });
    const d = dialog({
      title: editing ? 'Save changes' : 'Save this practice',
      body: h('div.field', h('label', { for: 'preset-name' }, 'Name'), Object.assign(input, { id: 'preset-name' })),
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Save', value: 'save', primary: true },
      ],
    });
    setTimeout(() => input.focus(), 50);
    if ((await d) !== 'save') return;
    const name = input.value.trim() || 'My practice';
    const id = editing?.id || newId();
    await savePreset({ ...(editing || {}), id, name, config: config() });
    toast(`Saved “${name}”`);
    navigate('/');
  }

  renderLength();
  main.append(
    h('h1', title),
    h('section.card',
      h('h2', 'Kind of round'),
      h('div.mode-picker',
        modeCard('count', 'Question set', 'A set number of questions. Every answer is timed.'),
        modeCard('timed', 'Timed sprint', 'Answer as many as you can before time runs out.'),
        modeCard('mastery', 'Mastery', 'Focuses on what needs practice and repeats misses.'),
      ),
      h('div', { style: { height: '14px' } }),
      lengthBox,
    ),
    h('section.card',
      h('h2', 'Problems'),
      h('p.small.secondary', 'Choose one or more, then set how many of each and their settings.'),
      skillSections,
    ),
    h('div.sticky-actions',
      h('button.btn', { type: 'button', onclick: save }, editing ? '💾 Save changes' : '💾 Save for later'),
      h('button.btn.primary.big.start-btn', { type: 'button', onclick: start }, h('span', 'Start ▶'), startTotal),
    ),
  );
  refresh();
}

function radioChip(name, value, label, checked, onPick) {
  return h('label.chip',
    h('input', { type: 'radio', name, value: String(value), checked, onchange: onPick }),
    label,
  );
}
