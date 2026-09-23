import { h, toast, dialog, confirmDialog, fmtDateTime, fmtNum } from '../dom.js';
import { app, updateSetting, loadSettings } from '../../app.js';
import { exportAll, importAll, clearAll, listSessions, allAnswers } from '../../data/store.js';
import { VERSION } from '../../version.js';
import { checkForUpdate } from '../../pwa.js';
import { navigate } from '../../router.js';

export async function renderSettings(main) {
  const s = app.settings;
  const [sessions, answers] = await Promise.all([listSessions(), allAnswers()]);
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;

  const toggle = (key, label) =>
    h('label.switch', { style: { marginBottom: '12px' } },
      h('input', { type: 'checkbox', checked: !!s[key], onchange: (e) => updateSetting(key, e.target.checked) }),
      label,
    );

  const segmented = (key, options, label) => {
    const group = h('div.segmented', { role: 'group', 'aria-label': label },
      options.map(([value, text]) =>
        h('button', {
          type: 'button',
          'aria-pressed': String(s[key] === value),
          onclick: (e) => {
            group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            e.currentTarget.setAttribute('aria-pressed', 'true');
            updateSetting(key, value);
          },
        }, text),
      ),
    );
    return group;
  };

  const nameInput = h('input', {
    type: 'text',
    id: 'player-name',
    value: s.playerName || '',
    maxlength: '30',
    placeholder: 'Name',
    autocomplete: 'off',
    onchange: (e) => {
      updateSetting('playerName', e.target.value.trim());
      toast('Saved');
    },
  });

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: onImportFile });

  main.append(
    h('h1', 'Settings'),
    h('section.card',
      h('h2', 'Player'),
      h('div.field', h('label', { for: 'player-name' }, 'Name shown on the home screen'), nameInput),
    ),
    h('section.card',
      h('h2', 'Practice'),
      toggle('sound', 'Sounds'),
      toggle('showTimer', 'Show the clock during question sets'),
      h('div.field',
        h('span.label', 'Fluency goal for math facts'),
        segmented('factFluencySec', [[2, '2 sec'], [3, '3 sec'], [4, '4 sec'], [5, '5 sec'], [6, '6 sec']], 'Fluency goal'),
        h('span.small.secondary', 'A fact counts as mastered when the last 3 tries were right and each was answered within this time.'),
      ),
      h('div.field',
        h('span.label', 'Theme'),
        segmented('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], 'Theme'),
      ),
    ),
    h('section.card',
      h('h2', 'Your data'),
      h('p.secondary',
        `${fmtNum(sessions.length)} rounds and ${fmtNum(answers.length)} answers are saved on this device. `,
        'Nothing is sent to the internet.',
      ),
      persisted === false
        ? h('p.small.secondary', 'Tip: install this app to your home screen so the browser keeps your data safe. Save a backup now and then too.')
        : null,
      h('p.small.secondary', s.lastBackupAt ? `Last backup: ${fmtDateTime(s.lastBackupAt)}` : 'No backup saved yet.'),
      h('div.row',
        h('button.btn.primary', { type: 'button', onclick: doExport }, '⬇ Save backup file'),
        h('button.btn', { type: 'button', onclick: () => fileInput.click() }, '⬆ Restore from backup'),
        fileInput,
      ),
      h('p.small.muted', { style: { marginTop: '10px' } }, 'Use a backup file to move stats to a new device. Restoring adds the backup to what’s already here; nothing is lost.'),
    ),
    h('section.card',
      h('h2', 'Start over'),
      h('p.small.secondary', 'Delete every round, answer, saved practice and setting on this device.'),
      h('button.btn.danger', { type: 'button', onclick: doDelete }, 'Delete all data…'),
    ),
    h('section.card',
      h('h2', 'About'),
      h('p.small.secondary', `Math Practice · version ${VERSION === '__BUILD__' ? 'development' : VERSION}`),
      h('button.btn', {
        type: 'button',
        onclick: async () => {
          const r = await checkForUpdate();
          toast(r === 'none' ? 'You have the latest version.' : r === 'found' ? 'Downloading the update…' : 'Could not check for updates (offline?).');
        },
      }, 'Check for updates'),
    ),
  );

  async function doExport() {
    const data = await exportAll();
    const json = JSON.stringify(data);
    const name = `math-practice-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
    // On phones and tablets, the share sheet is the easiest way to save a file.
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Math Practice backup' });
        await markBackedUp();
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    await markBackedUp();
  }

  async function markBackedUp() {
    await updateSetting('lastBackupAt', Date.now());
    toast('Backup saved');
    navigate('/settings', { replace: true });
  }

  async function onImportFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      toast('That file could not be read.');
      return;
    }
    const n = obj?.data?.sessions?.length ?? 0;
    const ok = await confirmDialog('Restore this backup?', `It has ${fmtNum(n)} rounds from ${obj?.exportedAt ? new Date(obj.exportedAt).toLocaleDateString() : 'an unknown date'}. They’ll be added to the stats on this device.`, 'Restore');
    if (!ok) return;
    try {
      const res = await importAll(obj);
      await loadSettings();
      toast(`Restored ${fmtNum(res.sessions)} rounds`);
      navigate('/settings', { replace: true });
    } catch (err) {
      toast(err.message);
    }
  }

  async function doDelete() {
    const input = h('input', { type: 'text', placeholder: 'DELETE', autocomplete: 'off', style: { width: '100%' } });
    const answer = await dialog({
      title: 'Delete everything?',
      body: h('div',
        h('p', 'This can’t be undone. Save a backup first if you might want the stats later.'),
        h('div.field', h('label', 'Type DELETE to confirm'), input),
      ),
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Delete all', value: 'delete', danger: true },
      ],
    });
    if (answer !== 'delete') return;
    if (input.value.trim().toUpperCase() !== 'DELETE') {
      toast('Nothing was deleted.');
      return;
    }
    await clearAll();
    await loadSettings();
    toast('All data deleted');
    navigate('/', { replace: true });
  }
}
