// Human-readable descriptions of round configurations.

import { getSkill } from '../skills/index.js';

export const MODE_LABELS = {
  count: 'Question set',
  timed: 'Timed sprint',
  mastery: 'Mastery',
};

export function lengthLabel(config) {
  if (config.fixed) return `${config.fixed.length} questions`;
  if (config.mode === 'timed') {
    const m = config.seconds / 60;
    return m >= 1 && Number.isInteger(m) ? `${m}-minute sprint` : `${config.seconds}-second sprint`;
  }
  if (config.mode === 'mastery') return `Mastery · ${config.count} questions`;
  return `${config.count} questions`;
}

export function skillsLabel(config) {
  if (config.fixed) return 'Missed problems';
  const names = [...new Set((config.skills || []).map((s) => getSkill(s.id)?.label).filter(Boolean))];
  if (names.length <= 2) return names.join(' & ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

export function describeConfig(config) {
  return { title: skillsLabel(config), detail: lengthLabel(config) };
}
