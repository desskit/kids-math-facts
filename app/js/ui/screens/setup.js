import { h, clear, dialog, toast } from '../dom.js';
import { startRound } from '../../app.js';
import { listPresets, savePreset, newId } from '../../data/store.js';
import { BUILT_IN_PRESETS } from '../../engine/presets.js';
import { SKILLS, CATEGORIES } from '../../skills/index.js';
import { withDefaults } from '../../skills/common.js';
import { navigate } from '../../router.js';

const COUNTS = [5, 10, 15, 20, 25, 30, 40, 50];
const SECONDS = [30, 60, 120, 180, 300];

export async function renderSetup(main, _params, query) {
  const presets = await listPresets();
  const fromPreset = query.preset
    ? presets.find((p) => p.id === query.preset) || BUILT_IN_PRESETS.find((p) => p.id === query.preset)
    : null;
  const editing = fromPreset && !fromPreset.id.startsWith('bi-') ? fromPreset : null;

  // Editable state
  const base = fromPreset?.config || { mode: 'count', count: 20, seconds: 120, retryMissed: true, skills: [{ id: 'mul-facts', options: {} }] };
  const state = {
    mode: base.mode,
    count: base.count || 20,
    seconds: base.seconds || 120,
    retryMissed: base.retryMissed ?? true,
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, { on: false, options: withDefaults(s.options, {}) }])),
  };
  for (const s of base.skills || []) {
    if (state.skills[s.id]) state.skills[s.id] = { on: true, options: withDefaults(SKILLS.find((x) => x.id === s.id).options, s.options) };
  }

  function config() {
    return {
      mode: state.mode,
      count: state.count,
      seconds: state.seconds,
      retryMissed: state.mode === 'count' ? state.retryMissed : false,
      skills: Object.entries(state.skills)
        .filter(([, v]) => v.on)
        .map(([id, v]) => ({ id, options: structuredClone(v.options) })),
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

  // ---- mode
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
        },
      }),
      h('strong', label),
      h('span', desc),
    );

  const lengthBox = h('div');
  function renderLength() {
    clear(lengthBox);
    if (state.mode === 'timed') {
      lengthBox.append(
        h('div.field', h('span.label', 'How long?'),
          h('div.chips', SECONDS.map((s) => radioChip('seconds', s, s < 60 ? `${s} sec` : `${s / 60} min`, state.seconds === s, () => (state.seconds = s)))),
        ),
      );
    } else {
      lengthBox.append(
        h('div.field', h('span.label', 'How many questions?'),
          h('div.chips', COUNTS.map((n) => radioChip('count', n, String(n), state.count === n, () => (state.count = n)))),
        ),
      );
    }
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
  renderLength();

  // ---- skills
  const skillSections = CATEGORIES.map((cat) =>
    h('section.skill-group',
      h('h3', cat.label),
      h('div.skill-list', SKILLS.filter((s) => s.category === cat.id).map(skillItem)),
    ),
  );

  function skillItem(skill) {
    const st = state.skills[skill.id];
    const optsBox = h('div.skill-options', { hidden: !st.on }, skill.options.map((f) => optionField(skill, f)));
    const item = h(`div.skill-item${st.on ? '.on' : ''}`,
      h('label.skill-head',
        h('input', {
          type: 'checkbox',
          checked: st.on,
          onchange: (e) => {
            st.on = e.target.checked;
            optsBox.hidden = !st.on;
            item.classList.toggle('on', st.on);
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
    h('section.card', h('h2', 'Problems'), h('p.small.secondary', 'Choose one or more. Tap a kind of problem to change its settings.'), skillSections),
    h('div.sticky-actions',
      h('button.btn', { type: 'button', onclick: save }, editing ? '💾 Save changes' : '💾 Save for later'),
      h('button.btn.primary.big', { type: 'button', onclick: start }, 'Start ▶'),
    ),
  );
}

function radioChip(name, value, label, checked, onPick) {
  return h('label.chip',
    h('input', { type: 'radio', name, value: String(value), checked, onchange: onPick }),
    label,
  );
}
