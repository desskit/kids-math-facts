import { h, clear, fmtPct, fmtSec, fmtNum, fmtDate, fmtDuration } from '../dom.js';
import { startRound, factFluencyMs } from '../../app.js';
import { listSessions, allAnswers, getFactStats } from '../../data/store.js';
import { totals, dailySeries, bySkill, troubleSpots, streaks, sinceDays, personalBests } from '../../stats/aggregate.js';
import { SKILLS, getSkill, labelForKey } from '../../skills/index.js';
import { chart } from '../charts.js';
import { heatmap } from '../heatmap.js';
import { skillsLabel, lengthLabel } from '../describe.js';
import { bestText } from './home.js';
import { toProblem } from './results.js';
import { navigate } from '../../router.js';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: 'Year' },
  { days: null, label: 'All time' },
];

const FACT_GRIDS = ['mul-facts', 'div-facts', 'add-facts', 'sub-facts'];

// Remember filters while the app is open.
const view = { days: 30, skill: 'all', grid: null, historyShown: 25 };

export async function renderStats(main) {
  const [sessions, answers, factStats] = await Promise.all([listSessions(), allAnswers(), getFactStats()]);

  main.append(h('h1', 'Stats'));
  if (!answers.length) {
    main.append(
      h('section.card.center',
        h('p', 'No practice yet. Finish a round and your progress will show up here.'),
        h('a.btn.primary', { href: '#/' }, 'Start practicing'),
      ),
    );
    return;
  }

  const body = h('div');
  const usedSkills = SKILLS.filter((s) => answers.some((a) => a.skillId === s.id));

  const rangeButtons = h('div.segmented', { role: 'group', 'aria-label': 'Time range' },
    RANGES.map((r) =>
      h('button', {
        type: 'button',
        'aria-pressed': String(view.days === r.days),
        onclick: (e) => {
          view.days = r.days;
          view.historyShown = 25;
          rangeButtons.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          e.currentTarget.setAttribute('aria-pressed', 'true');
          draw();
        },
      }, r.label),
    ),
  );
  const skillSelect = h('select', {
    'aria-label': 'Kind of problem',
    onchange: (e) => {
      view.skill = e.target.value;
      view.historyShown = 25;
      draw();
    },
  },
    h('option', { value: 'all' }, 'All problems'),
    usedSkills.map((s) => h('option', { value: s.id }, s.label)),
  );
  skillSelect.value = usedSkills.some((s) => s.id === view.skill) ? view.skill : 'all';
  view.skill = skillSelect.value;

  main.append(h('div.filters', rangeButtons, skillSelect), body);

  function draw() {
    clear(body);
    const skillFilter = (a) => view.skill === 'all' || a.skillId === view.skill;
    const inRange = sinceDays(answers, view.days).filter(skillFilter);
    const sessInRange = sinceDays(sessions, view.days, Date.now(), 'startedAt').filter(
      (s) => s.status !== 'in-progress' && s.total > 0 && (view.skill === 'all' || (s.config.skills || []).some((k) => k.id === view.skill) || (s.config.fixed || []).some((p) => p.skillId === view.skill)),
    );

    const t = totals(inRange);
    const st = streaks(sessions.filter((s) => s.total > 0).map((s) => s.startedAt));
    body.append(
      h('div.tiles',
        tile('Questions answered', fmtNum(t.total), `${sessInRange.length} rounds`),
        tile('Accuracy', t.total ? fmtPct(t.accuracy) : '—', `${fmtNum(t.correct)} correct`),
        tile('Time per question', t.total ? fmtSec(t.avgMs) : '—', 'average'),
        tile('Days practiced', fmtNum(t.days)),
        tile('Streak', `${st.current} ${st.current === 1 ? 'day' : 'days'}`, `Best: ${st.best} ${st.best === 1 ? 'day' : 'days'}`),
      ),
    );

    // Trends
    const series = dailySeries(inRange);
    body.append(
      h('div.chart-grid',
        chartCard('Accuracy', 'Percent correct each day', chart(
          series.map((d) => ({ day: d.day, y: d.accuracy * 100, tip: `${fmtPct(d.accuracy)} · ${d.correct} of ${d.total}` })),
          { kind: 'line', yMax: 100, format: (v) => `${Math.round(v)}%`, label: 'Accuracy per day' },
        )),
        chartCard('Speed', 'Average seconds per question (lower is faster)', chart(
          series.map((d) => ({ day: d.day, y: d.avgMs / 1000, tip: `${fmtSec(d.avgMs)} per question` })),
          { kind: 'line', format: (v, axis) => (axis ? `${+v.toFixed(1)}s` : fmtSec(v * 1000)), label: 'Average seconds per question per day' },
        )),
        chartCard('Practice', 'Questions answered each day', chart(
          series.map((d) => ({ day: d.day, y: d.total, tip: `${d.total} questions` })),
          { kind: 'bar', format: (v) => fmtNum(Math.round(v)), label: 'Questions per day' },
        )),
      ),
      h('section.card', { style: { marginTop: '16px' } },
        h('details.more',
          h('summary', 'Show the numbers by day'),
          h('div.table-scroll',
            h('table.data',
              h('thead', h('tr', h('th', 'Day'), h('th.num', 'Questions'), h('th.num', 'Correct'), h('th.num', 'Accuracy'), h('th.num', 'Avg time'))),
              h('tbody', series.slice().reverse().map((d) =>
                h('tr', h('td', fmtDate(new Date(d.day + 'T12:00').getTime(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })), h('td.num', d.total), h('td.num', d.correct), h('td.num', fmtPct(d.accuracy)), h('td.num', fmtSec(d.avgMs))),
              )),
            ),
          ),
        ),
      ),
    );

    // Fact grids (mastery is all-time, so no range filter)
    const grids = FACT_GRIDS.map(getSkill).filter((s) => Object.values(factStats).some((f) => f.skillId === s.id));
    if (grids.length && (view.skill === 'all' || grids.some((g) => g.id === view.skill))) {
      if (!grids.some((g) => g.id === view.grid)) view.grid = grids[0].id;
      if (view.skill !== 'all' && grids.some((g) => g.id === view.skill)) view.grid = view.skill;
      const gridBox = h('div');
      const drawGrid = () => {
        const skill = getSkill(view.grid);
        const keys = Object.keys(factStats).filter((k) => factStats[k].skillId === skill.id);
        const size = Math.max(skill.id.startsWith('add') || skill.id.startsWith('sub') ? 10 : 12, ...keys.map((k) => Math.max(...skill.grid.parse(k))));
        clear(gridBox).append(heatmap(skill, factStats, factFluencyMs(), size));
      };
      const tabs = h('div.segmented', { role: 'group', 'aria-label': 'Fact grid' },
        grids.map((g) =>
          h('button', {
            type: 'button',
            'aria-pressed': String(g.id === view.grid),
            onclick: (e) => {
              view.grid = g.id;
              tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
              e.currentTarget.setAttribute('aria-pressed', 'true');
              drawGrid();
            },
          }, g.grid.op + ' ' + g.label.replace(' facts', '')),
        ),
      );
      drawGrid();
      body.append(
        h('section.card', { style: { marginTop: '16px' } },
          h('h2', 'Fact mastery'),
          h('p.small.secondary', `Mastered = the last 3 tries were right, each in ${fluencySec()} seconds or less. This grid covers all time.`),
          grids.length > 1 ? tabs : null,
          h('div', { style: { height: '10px' } }),
          gridBox,
        ),
      );
    }

    // Trouble spots
    const spots = troubleSpots(inRange, 12);
    if (spots.length) {
      const latestMissed = spots.map((s) => [...inRange].reverse().find((a) => a.factKey === s.key && !a.correct)).filter(Boolean);
      body.append(
        h('section.card',
          h('div.row.between',
            h('h2', { style: { margin: 0 } }, 'Trouble spots'),
            h('button.btn.primary', {
              type: 'button',
              onclick: () => startRound({ mode: 'count', fixed: latestMissed.map(toProblem), retryMissed: true }, { presetName: 'Trouble spots' }),
            }, 'Practice these'),
          ),
          h('p.small.secondary', 'The facts and problem types missed most in this time range.'),
          h('div.table-scroll',
            h('table.data',
              h('thead', h('tr', h('th', 'Problem'), h('th.num', 'Missed'), h('th.num.hide-sm', 'Tries'), h('th.num', 'Accuracy'), h('th.num', 'Avg time'))),
              h('tbody', spots.map((s) =>
                h('tr', h('td', labelForKey(s.key)), h('td.num', s.missed), h('td.num.hide-sm', s.total), h('td.num', fmtPct(s.accuracy)), h('td.num', fmtSec(s.avgMs))),
              )),
            ),
          ),
        ),
      );
    }

    // By skill
    const skills = bySkill(inRange);
    if (skills.length) {
      body.append(
        h('section.card',
          h('h2', 'By kind of problem'),
          h('div.table-scroll',
            h('table.data',
              h('thead', h('tr', h('th', 'Problem'), h('th.num', 'Tries'), h('th.num', 'Accuracy'), h('th.num', 'Avg time'), h('th.num.hide-sm', 'Last practiced'))),
              h('tbody', skills.map((s) =>
                h('tr',
                  h('td', getSkill(s.key)?.label || s.key),
                  h('td.num', fmtNum(s.total)),
                  h('td.num', h('span.acc-bar', h('span', { style: { width: fmtPct(s.accuracy) } })), fmtPct(s.accuracy)),
                  h('td.num', fmtSec(s.avgMs)),
                  h('td.num.hide-sm', fmtDate(s.lastTs)),
                ),
              )),
            ),
          ),
        ),
      );
    }

    // Personal bests (all time)
    const bests = [...personalBests(sessions).values()]
      .filter((s) => view.skill === 'all' || (s.config.skills || []).some((k) => k.id === view.skill))
      .sort((a, b) => b.startedAt - a.startedAt);
    if (bests.length) {
      body.append(
        h('section.card',
          h('h2', 'Personal bests'),
          h('ul.qlist', bests.map((s) =>
            h('li', { style: { gridTemplateColumns: '28px 1fr auto' } },
              h('span.mark', '🏆'),
              h('span.qtext', s.presetName || skillsLabel(s.config), h('span.detail', `${lengthLabel(s.config)} · ${fmtDate(s.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}`)),
              h('span.time', bestText(s).replace('🏆 Best: ', '')),
            ),
          )),
        ),
      );
    }

    // History
    const shown = sessInRange.slice(0, view.historyShown);
    body.append(
      h('section.card',
        h('h2', 'Round history'),
        sessInRange.length
          ? h('div.table-scroll',
              h('table.data',
                h('thead', h('tr', h('th', 'When'), h('th', 'Round'), h('th.num', 'Score'), h('th.num.hide-sm', 'Accuracy'), h('th.num', 'Time'))),
                h('tbody', shown.map((s) =>
                  h('tr.clickable', {
                    tabindex: '0',
                    onclick: () => navigate(`/session/${s.id}`),
                    onkeydown: (e) => e.key === 'Enter' && navigate(`/session/${s.id}`),
                  },
                    h('td', fmtDate(s.startedAt, { month: 'short', day: 'numeric' }), h('div.small.muted', new Date(s.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))),
                    h('td', s.presetName || skillsLabel(s.config), h('div.small.muted', lengthLabel(s.config) + (s.status === 'abandoned' ? ' · stopped early' : ''))),
                    h('td.num', s.mode === 'timed' ? `${s.correct}` : `${s.correct}/${s.total}`),
                    h('td.num.hide-sm', fmtPct(s.total ? s.correct / s.total : 0)),
                    h('td.num', fmtDuration(s.elapsedMs)),
                  ),
                )),
              ),
            )
          : h('p.muted', 'No rounds in this time range.'),
        sessInRange.length > shown.length
          ? h('button.btn', {
              type: 'button',
              style: { marginTop: '12px' },
              onclick: () => {
                view.historyShown += 50;
                draw();
              },
            }, `Show more (${sessInRange.length - shown.length} older)`)
          : null,
      ),
    );
  }

  draw();
}

function fluencySec() {
  return factFluencyMs() / 1000;
}

function tile(label, value, sub) {
  return h('div.tile', h('div.label', label), h('div.value', value), sub ? h('div.sub', sub) : null);
}

function chartCard(title, sub, el) {
  return h('section.card', h('div.chart-title', title), h('div.chart-sub', sub), el);
}

