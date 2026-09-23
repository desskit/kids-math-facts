import { h, fmtPct, fmtSec, fmtDuration, fmtDateTime, confetti } from '../dom.js';
import { startRound } from '../../app.js';
import { getSession, answersForSession, listSessions } from '../../data/store.js';
import { isPersonalBest, personalBests, roundKey } from '../../stats/aggregate.js';
import { lengthLabel, skillsLabel, MODE_LABELS } from '../describe.js';
import { bestText } from './home.js';

export async function renderResults(main, { id }, query) {
  const fresh = query.fresh === '1';
  const [session, answers, sessions] = await Promise.all([getSession(id), answersForSession(id), listSessions()]);
  if (!session) {
    main.append(h('p.card', 'That round could not be found.'), h('a.btn', { href: '#/' }, 'Home'));
    return;
  }

  const acc = session.total ? session.correct / session.total : 0;
  const record = fresh && isPersonalBest(session, sessions);
  const best = personalBests(sessions).get(roundKey(session));
  const firstTries = answers.filter((a) => !a.retry && !a.repeat);
  const missed = dedupe(firstTries.filter((a) => !a.correct));

  const stars = acc >= 0.9 ? 3 : acc >= 0.75 ? 2 : acc >= 0.5 ? 1 : 0;
  const heading = fresh ? cheer(acc) : session.presetName || skillsLabel(session.config);
  const scoreText = session.mode === 'timed' ? `${session.correct}` : `${session.correct}/${session.total}`;
  const scoreSub = session.mode === 'timed' ? `correct in ${lengthLabel(session.config).replace('-minute sprint', ' min').replace('-second sprint', ' sec')}` : 'correct';

  main.append(
    h('section.card.results-hero',
      h('h1', heading),
      fresh ? null : h('p.secondary', fmtDateTime(session.startedAt)),
      h('div.stars', { 'aria-label': `${stars} of 3 stars` }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
      h('div.big-score', scoreText),
      h('div.secondary', scoreSub),
      record ? h('div.record', '🏆 New personal best!') : null,
      session.status === 'abandoned' ? h('div.pill', 'Stopped early') : null,
    ),
    h('div.tiles',
      tile('Accuracy', fmtPct(acc)),
      tile('Time per question', fmtSec(session.avgMs), 'average'),
      tile('Total time', fmtDuration(session.elapsedMs)),
      best && best.id !== session.id ? tile('Personal best', bestText(best).replace('🏆 Best: ', '')) : null,
    ),
  );

  const again = h('div.row', { style: { marginBottom: '16px' } },
    h('button.btn.primary.big', {
      type: 'button',
      onclick: () => startRound(session.config, { presetId: session.presetId, presetName: session.presetName }),
    }, '↻ Play again'),
    missed.length
      ? h('button.btn.big', {
          type: 'button',
          onclick: () =>
            startRound({ mode: 'count', fixed: missed.map(toProblem), retryMissed: true }, { presetName: 'Practice missed problems' }),
        }, `Practice the ${missed.length} missed`)
      : null,
    h('a.btn.big', { href: fresh ? '#/' : '#/stats' }, fresh ? 'Home' : '← Stats'),
  );
  main.append(again);

  if (missed.length) {
    main.append(
      h('section.card',
        h('h2', 'To practice'),
        h('ul.qlist', missed.map((a) => questionRow(a))),
      ),
    );
  }

  main.append(
    h('section.card',
      h('details.more', { open: !fresh },
        h('summary', `All ${answers.length} answers`),
        h('ul.qlist', answers.map((a) => questionRow(a))),
      ),
      h('p.small.muted', { style: { marginTop: '10px' } },
        `${MODE_LABELS[session.mode] || ''} · ${lengthLabel(session.config)} · ${skillsLabel(session.config)}`,
      ),
    ),
  );

  if (record) setTimeout(confetti, 200);
}

function tile(label, value, sub) {
  return h('div.tile', h('div.label', label), h('div.value', value), sub ? h('div.sub', sub) : null);
}

export function questionRow(a) {
  return h('li',
    h(`span.mark.${a.correct ? 'good' : 'bad'}`, { 'aria-label': a.correct ? 'correct' : 'incorrect' }, a.correct ? '✓' : '✗'),
    h('span.qtext',
      a.text.replace(/ = \?$/, ''),
      a.retry || a.repeat ? h('span.tag', 'retry') : null,
      h('span.detail',
        a.correct
          ? `Answer: ${a.expected}`
          : `You said ${a.givenText || '—'} · answer is ${a.expected}${a.note ? ` · ${a.note}` : ''}`,
      ),
    ),
    h('span.time', fmtSec(a.ms)),
  );
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((a) => (seen.has(a.text) ? false : seen.add(a.text)));
}

/** Rebuild a playable problem from a stored answer. */
export function toProblem(a) {
  return {
    skillId: a.skillId,
    factKey: a.factKey,
    text: a.text,
    prompt: a.prompt,
    display: a.display,
    answerType: a.answerType,
    answer: a.answer,
    slots: a.slots,
    form: a.form,
    choices: a.choices,
  };
}

function cheer(acc) {
  if (acc === 1) return 'Perfect! 🎉';
  if (acc >= 0.9) return 'Excellent work!';
  if (acc >= 0.75) return 'Great job!';
  if (acc >= 0.5) return 'Good effort!';
  return 'Keep practicing!';
}
