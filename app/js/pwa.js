// Service worker registration and "new version available" prompt.

import { toast } from './ui/dom.js';

let registration = null;
let updateRequested = false;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (e) {
    console.warn('Service worker registration failed', e);
    return;
  }

  const promptUpdate = (worker) => {
    toast('A new version is ready.', {
      action: 'Update',
      duration: 0,
      onAction: () => {
        updateRequested = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      },
    });
  };

  // A worker may already be waiting from an earlier visit.
  if (registration.waiting && navigator.serviceWorker.controller) promptUpdate(registration.waiting);

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(worker);
    });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first install also takes control (clients.claim); only reload for an update the player asked for.
    if (reloading || !updateRequested) return;
    reloading = true;
    // Don't interrupt a round; reload when the player leaves the play screen.
    if (document.body.classList.contains('playing')) {
      window.addEventListener('hashchange', () => location.reload(), { once: true });
    } else {
      location.reload();
    }
  });

  // Check for updates when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && registration) registration.update().catch(() => {});
  });
}

/** Returns 'found', 'none', or 'error'. */
export async function checkForUpdate() {
  if (!registration) return 'error';
  try {
    await registration.update();
    return registration.installing || registration.waiting ? 'found' : 'none';
  } catch {
    return 'error';
  }
}

/** Ask the browser not to clear our data under storage pressure. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
}
