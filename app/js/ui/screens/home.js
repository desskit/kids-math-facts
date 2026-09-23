import { h, fmtPct, fmtDuration, confirmDialog, toast } from '../dom.js';
import { app, startRound, factFluencyMs } from '../../app.js';
import { listPresets, listSessions, deletePreset, getFactStats } from '../../data/store.js';
import { BUILT_IN_PRESETS } from '../../engine/presets.js';
import { personalBests, roundKey, streaks } from '../../stats/aggregate.js';
import { summarize, STATUS_LABELS } from '../../engine/mastery.js';
import { describeConfig } from '../describe.js';
import { getSkill } from '../../skills/index.js';
import { navigate } from '../../router.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Fact families shown as mastery meters on the home screen once practiced.
const FAMILIES = [
  { id: 'mul-facts', label: 'Times tables 0–12', options: { tables: range(0, 12), max: 12 } },
  { id: 'div-facts', label: 'Division facts', options: { divisors: range(1, 12), max: 12 } },
  { id: 'add-facts', label: 'Addition facts to 20', options: { max: 10 } },
  { id: 'sub-facts', label: 'Subtraction facts to 20', options: { max: 10 } },
];

export async function renderHome(main) {
  const [presets, sessions, factStats] = await Promise.all([listPresets(), listSessions(), getFactStats()]);
  const bests = personalBests(sessions);
  const complete = sessions.filter((s) => s.status === 'complete');
  const { current } = streaks(sessions.map((s) => s.startedAt));
  const name = app.settings.playerName;

  main.append(
    h('div.hello',
      h('div',
        h('h1', name ? `Hi, ${name}!` : 'Ready to practice?'),
        h('p.secondary', { style: { margin: 0 } }, pickGreeting(complete.length)),
      ),
      current > 0 ? h('div.streak', { title: 'Days in a row' }, '🔥', h('strong', current), current === 1 ? 'day in a row' : 'days in a row') : null,
    ),
  );

  const reminder = backupReminder(sessions.length);
  if (reminder) main.append(reminder);

  // Mastery meters for fact families that have been practiced.
  const meters = FAMILIES.map((f) => {
    const skill = getSkill(f.id);
    const keys = skill.keys(f.options);
    if (!keys.some((k) => factStats[k])) return null;
    return { ...f, counts: summarize(keys, factStats, factFluencyMs()), total: keys.length };
  }).filter(Boolean);
  if (meters.length) {
    main.append(
      h('section.card',
        h('h2', 'Fact mastery'),
        h('div.stack', meters.map(meterRow)),
        h('div.legend',
          ['mastered', 'learning', 'struggling', 'new'].map((s) => h('span', h(`i.st-${s}`), STATUS_LABELS[s])),
        ),
      ),
    );
  }

  if (presets.length) {
    main.append(h('h2', 'My practice'), presetGrid(presets, bests, true), h('div', { style: { height: '20px' } }));
  }

  main.append(
    h('div.row.between', { style: { marginBottom: '10px' } },
      h('h2', { style: { margin: 0 } }, presets.length ? 'More practice' : 'Pick a practice'),
      h('a.btn', { href: '#/setup' }, '＋ Build your own'),
    ),
    presetGrid(BUILT_IN_PRESETS, bests, false),
  );
}

function pickGreeting(n) {
  if (n === 0) return 'Pick a practice below to get started.';
  if (n < 5) return 'Nice work so far. Keep it up!';
  return `You've finished ${n} practice rounds. Awesome!`;
}

function meterRow(m) {
  const pct = (k) => `${(m.counts[k] / m.total) * 100}%`;
  return h('div.mastery-meter',
    h('div.row.between', h('strong', m.label), h('span.secondary.small', `${m.counts.mastered} of ${m.total} mastered`)),
    h('div.meter', { role: 'img', 'aria-label': `${m.counts.mastered} mastered, ${m.counts.learning} learning, ${m.counts.struggling} need work, ${m.counts.new} not tried` },
      m.counts.mastered ? h('span.st-mastered', { style: { width: pct('mastered') } }) : null,
      m.counts.learning ? h('span.st-learning', { style: { width: pct('learning') } }) : null,
      m.counts.struggling ? h('span.st-struggling', { style: { width: pct('struggling') } }) : null,
    ),
  );
}

function presetGrid(list, bests, editable) {
  return h('div.preset-grid',
    list.map((p) => {
      const { title, detail } = describeConfig(p.config);
      const best = bests.get(roundKey({ presetId: p.id, config: p.config }));
      return h('div', { style: { position: 'relative' } },
        h('button.preset', {
          type: 'button',
          onclick: () => startRound(p.config, { presetId: p.id, presetName: p.name }),
        },
          h('span.name', p.name),
          h('span.meta', detail),
          h('span.meta', title),
          p.grade ? h('span.pill', `Grade ${p.grade}`) : null,
          best ? h('span.best', bestText(best)) : null,
        ),
        h('div.preset-actions',
          h('button.btn.ghost', {
            type: 'button',
            title: editable ? 'Edit' : 'Customize a copy',
            'aria-label': `${editable ? 'Edit' : 'Customize'} ${p.name}`,
            onclick: () => navigate(`/setup?preset=${encodeURIComponent(p.id)}`),
          }, '✏️'),
          editable
            ? h('button.btn.ghost', {
                type: 'button',
                title: 'Delete',
                'aria-label': `Delete ${p.name}`,
                onclick: async () => {
                  if (await confirmDialog('Delete this practice?', `"${p.name}" will be removed. Its history stays in your stats.`, 'Delete', { danger: true })) {
                    await deletePreset(p.id);
                    toast('Deleted');
                    navigate('/', { replace: true });
                  }
                },
              }, '🗑️')
            : null,
        ),
      );
    }),
  );
}

export function bestText(s) {
  if (s.config.mode === 'timed') return `🏆 Best: ${s.correct} correct`;
  return `🏆 Best: ${fmtPct(s.correct / s.total)} in ${fmtDuration(s.elapsedMs)}`;
}

function backupReminder(sessionCount) {
  if (sessionCount < 5) return null;
  const last = app.settings.lastBackupAt;
  const days = last ? (Date.now() - last) / 86400000 : Infinity;
  if (days < 30) return null;
  return h('div.card.row.between',
    h('span', last ? `It's been ${Math.floor(days)} days since the last backup of your stats.` : 'Your stats are only saved on this device. Save a backup file to keep them safe.'),
    h('a.btn', { href: '#/settings' }, 'Back up'),
  );
}

