import { h, clear, fmtClock, confirmDialog } from '../dom.js';
import { app, factFluencyMs } from '../../app.js';
import { saveSession, saveAnswer, getFactStats, newId, touchPreset } from '../../data/store.js';
import { Round } from '../../engine/round.js';
import { formatGiven } from '../../engine/answer.js';
import { createRng } from '../../lib/rng.js';
import { renderProblem } from '../problem-view.js';
import { createAnswerInput } from '../keypad.js';
import { playCorrect, playWrong, playFinish } from '../sound.js';
import { lengthLabel } from '../describe.js';
import { navigate } from '../../router.js';

const CORRECT_PAUSE = 650;
const CORRECT_PAUSE_TIMED = 350;
const WRONG_AUTO = 3500;
const WRONG_AUTO_TIMED = 1600;

export async function renderPlay(main) {
  const pending = app.pendingRound;
  if (!pending) {
    navigate('/', { replace: true });
    return;
  }
  app.pendingRound = null;
  document.body.classList.add('playing');

  const { config, presetId, presetName } = pending;
  const factStats = config.mode === 'mastery' ? await getFactStats() : {};
  const round = new Round(config, { rng: createRng(), factStats, factFluencyMs: factFluencyMs() });
  const timed = round.config.mode === 'timed';
  const showTimer = app.settings.showTimer;

  const session = {
    id: newId(),
    startedAt: Date.now(),
    endedAt: null,
    status: 'in-progress',
    mode: round.config.mode,
    presetId,
    presetName,
    config: round.config,
    total: 0,
    correct: 0,
    elapsedMs: 0,
    avgMs: 0,
  };
  await saveSession(session);
  if (presetId && !presetId.startsWith('bi-')) touchPreset(presetId);

  // ---- layout
  const progressBar = h('span', { style: { width: '0%' } });
  const counter = h('span');
  const timer = h('span.timer', { 'aria-hidden': 'true' });
  const quitBtn = h('button.btn', { type: 'button', onclick: quit }, '✕ Quit');
  const problemBox = h('div');
  const answerBox = h('div');
  const feedback = h('div.feedback', { 'aria-live': 'polite' });
  const area = h('div.problem-area', problemBox, answerBox, feedback);
  const keypadBox = h('div');
  const overlay = h('div.paused-overlay', { hidden: true },
    h('div.card.center',
      h('h2', 'Paused'),
      h('p.secondary', 'The clock is stopped.'),
      h('button.btn.primary.big', { type: 'button', onclick: () => resume() }, 'Keep going ▶'),
    ),
  );

  main.append(
    h('div.play',
      h('div.play-top', quitBtn, h('div.progress', { role: 'progressbar', 'aria-label': 'Progress' }, progressBar)),
      h('div.play-status', counter, h('span', lengthLabel(round.config)), timer),
      area,
      keypadBox,
    ),
    overlay,
  );

  let input = null;
  let state = 'question'; // 'question' | 'feedback' | 'done'
  let feedbackTimer = null;
  let saving = Promise.resolve();
  let answerIndex = 0;
  let feedbackAt = 0;

  function updateStatus() {
    const answered = round.scored.length;
    if (timed) {
      const left = round.remainingMs();
      counter.textContent = `${round.summary().correct} correct`;
      timer.textContent = fmtClock(left);
      timer.classList.toggle('low', left <= 10000);
      progressBar.style.width = `${100 - (left / (round.config.seconds * 1000)) * 100}%`;
    } else {
      const total = round.config.count;
      const retry = round.inRetryPhase ? ' · try again' : '';
      counter.textContent = `${Math.min(answered + (state === 'question' && !round.inRetryPhase ? 1 : 0), total)} of ${total}${retry}`;
      timer.textContent = showTimer ? fmtClock(round.elapsedMs()) : '';
      progressBar.style.width = `${(answered / total) * 100}%`;
    }
  }

  function show(problem) {
    state = 'question';
    if (input) input.destroy();
    clear(problemBox).append(renderProblem(problem));
    feedback.className = 'feedback';
    clear(feedback);
    area.classList.remove('flash-good', 'flash-bad');
    input = createAnswerInput(problem, { onSubmit: submit });
    clear(answerBox).append(input.el);
    clear(keypadBox);
    if (input.keypad) keypadBox.append(input.keypad);
    updateStatus();
  }

  function submit(given) {
    if (state !== 'question' || round.paused) return;
    if (!round.canSubmit(given)) {
      feedback.className = 'feedback';
      feedback.textContent = 'Fill in your answer first.';
      return;
    }
    if (round.timeUp()) return finish();
    const res = round.submit(given);
    input.lock();
    state = 'feedback';
    feedbackAt = performance.now();
    persist(res);
    area.classList.remove('flash-good', 'flash-bad');
    void area.offsetWidth; // restart the animation
    if (res.correct) {
      area.classList.add('flash-good');
      feedback.className = 'feedback good';
      feedback.textContent = res.problem._repeat || res.retry ? '✓ Got it this time!' : pickPraise();
      playCorrect();
      feedbackTimer = setTimeout(next, timed ? CORRECT_PAUSE_TIMED : CORRECT_PAUSE);
    } else {
      area.classList.add('flash-bad');
      feedback.className = 'feedback bad';
      clear(feedback).append(
        ...[
          `✗ The answer is ${res.expected}`,
          res.note ? h('span.note', res.note) : null,
          timed ? null : h('span.note', 'Tap anywhere or press Enter to continue'),
        ].filter(Boolean),
      );
      playWrong();
      feedbackTimer = setTimeout(next, timed ? WRONG_AUTO_TIMED : WRONG_AUTO);
    }
    updateStatus();
  }

  function next() {
    clearTimeout(feedbackTimer);
    if (state !== 'feedback') return;
    const p = round.advance();
    if (!p) return finish();
    show(p);
  }

  function persist(res) {
    const p = res.problem;
    const record = {
      id: `${session.id}:${answerIndex++}`,
      sessionId: session.id,
      ts: res.ts,
      skillId: p.skillId,
      factKey: p.factKey,
      text: p.text,
      prompt: p.prompt || null,
      display: p.display,
      answerType: p.answerType,
      answer: p.answer,
      slots: p.slots,
      form: p.form || null,
      choices: p.choices || null,
      expected: res.expected,
      given: res.given,
      givenText: formatGiven(p, res.given),
      correct: res.correct,
      note: res.note,
      ms: Math.round(res.ms),
      retry: res.retry,
      repeat: res.repeat,
    };
    saving = saving.then(() => saveAnswer(record)).catch((e) => console.error('Could not save answer', e));
  }

  async function finish(status = 'complete') {
    if (state === 'done') return;
    state = 'done';
    clearTimeout(feedbackTimer);
    round.finish();
    const s = round.summary();
    Object.assign(session, {
      endedAt: Date.now(),
      status: s.total ? status : 'abandoned',
      total: s.total,
      correct: s.correct,
      elapsedMs: Math.round(s.elapsedMs),
      avgMs: Math.round(s.avgMs),
    });
    await saving;
    await saveSession(session);
    if (status === 'complete' && s.total) {
      playFinish();
      navigate(`/results/${session.id}?fresh=1`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }

  async function quit() {
    if (state === 'done') return;
    round.pause();
    const answered = round.answers.length;
    const ok = await confirmDialog(
      'Stop this round?',
      answered ? 'The answers so far are saved in your stats.' : 'Nothing has been answered yet.',
      'Stop',
      { danger: true },
    );
    if (!ok) {
      round.resume();
      return;
    }
    if (!answered) {
      session.status = 'abandoned';
      await saveSession(session);
      state = 'done';
      navigate('/', { replace: true });
      return;
    }
    finish('abandoned');
  }

  function pause() {
    if (state === 'done' || round.paused) return;
    round.pause();
    overlay.hidden = false;
  }

  function resume() {
    overlay.hidden = true;
    round.resume();
    updateStatus();
  }

  function onVisibility() {
    if (document.hidden) pause();
  }

  function onKeyDown(e) {
    if (state === 'feedback' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      next();
    } else if (!overlay.hidden && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      resume();
    }
  }

  function onTap(e) {
    // Ignore the click that submitted the answer itself.
    if (performance.now() - feedbackAt < 400) return;
    if (state === 'feedback' && !e.target.closest('.play-top') && feedback.classList.contains('bad')) next();
  }

  // Tick for clocks and time running out.
  const tick = setInterval(() => {
    if (state === 'done' || round.paused) return;
    if (timed && round.timeUp()) {
      finish();
      return;
    }
    updateStatus();
  }, 200);

  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onKeyDown, true);
  main.addEventListener('click', onTap);

  show(round.start());

  return () => {
    clearInterval(tick);
    clearTimeout(feedbackTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.classList.remove('playing');
    if (input) input.destroy();
    overlay.remove();
    if (state !== 'done') {
      // Left the screen some other way (e.g. browser back): keep what was answered.
      state = 'done';
      round.finish();
      const s = round.summary();
      Object.assign(session, {
        endedAt: Date.now(),
        status: 'abandoned',
        total: s.total,
        correct: s.correct,
        elapsedMs: Math.round(s.elapsedMs),
        avgMs: Math.round(s.avgMs),
      });
      saving.then(() => saveSession(session));
    }
  };
}

const PRAISE = ['✓ Correct!', '✓ Nice!', '✓ Great job!', '✓ You got it!', '✓ Awesome!', '✓ Yes!'];
function pickPraise() {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}
