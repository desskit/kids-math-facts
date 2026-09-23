import { route, startRouter } from './router.js';
import { loadSettings, app, updateSetting } from './app.js';
import { registerServiceWorker, requestPersistence } from './pwa.js';
import { renderHome } from './ui/screens/home.js';
import { renderSetup } from './ui/screens/setup.js';
import { renderPlay } from './ui/screens/play.js';
import { renderResults } from './ui/screens/results.js';
import { renderStats } from './ui/screens/stats.js';
import { renderSettings } from './ui/screens/settings.js';

route('/', renderHome, { tab: 'home' });
route('/setup', renderSetup, { tab: 'setup' });
route('/play', renderPlay);
route('/results/:id', renderResults);
route('/session/:id', renderResults, { tab: 'stats' });
route('/stats', renderStats, { tab: 'stats' });
route('/settings', renderSettings, { tab: 'settings' });

function markTab(tab) {
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function boot() {
  const main = document.getElementById('main');
  try {
    await loadSettings();
  } catch (e) {
    main.replaceChildren();
    const p = document.createElement('p');
    p.className = 'card';
    p.textContent =
      'This browser is blocking storage, so Math Practice can’t save progress. ' +
      'If you are in a private window, open it in a normal window instead.';
    main.append(p);
    console.error(e);
    return;
  }
  if (!app.settings.firstRunAt) {
    await updateSetting('firstRunAt', Date.now());
  }
  startRouter(main, { onNav: markTab });
  registerServiceWorker();
  requestPersistence();
}

boot();
