// Shared app state across screens.

import { getSettings, setSetting } from './data/store.js';
import { setSoundEnabled } from './ui/sound.js';
import { describeConfig } from './ui/describe.js';

export const app = {
  settings: null,
  /** The round about to be played: { config, presetId, presetName } */
  pendingRound: null,
};

export async function loadSettings() {
  app.settings = await getSettings();
  applySettings();
  return app.settings;
}

export async function updateSetting(key, value) {
  app.settings[key] = value;
  await setSetting(key, value);
  applySettings();
}

export function applySettings() {
  const s = app.settings;
  setSoundEnabled(s.sound);
  const root = document.documentElement;
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme;
  else delete root.dataset.theme;
  try {
    localStorage.setItem('theme', s.theme);
  } catch (e) {
    /* storage may be unavailable */
  }
}

export function factFluencyMs() {
  return (app.settings?.factFluencySec || 3) * 1000;
}

/** Queue a round and go to the play screen. */
export function startRound(config, { presetId = null, presetName = null } = {}) {
  app.pendingRound = { config, presetId, presetName: presetName || describeConfig(config).title };
  location.hash = '#/play';
}
