// Skill registry. Every skill has:
//   id, label, category, grade, fluencyMs, options (schema for the setup UI)
//   keys(options)                -> factKeys this configuration can produce
//   generate(options, rng, key?) -> a problem (optionally for a given key)
//   keyLabel(factKey)            -> readable name for stats
//   finite / grid                -> set on basic facts (for heatmaps)

import facts from './facts.js';
import multidigit from './multidigit.js';
import fractions from './fractions.js';
import decimals from './decimals.js';
import { displayText } from './common.js';

export const CATEGORIES = [
  { id: 'facts', label: 'Math facts' },
  { id: 'multidigit', label: 'Multi-digit' },
  { id: 'fractions', label: 'Fractions' },
  { id: 'decimals', label: 'Decimals' },
];

export const SKILLS = [...facts, ...multidigit, ...fractions, ...decimals];

const byId = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id) {
  return byId.get(id);
}

/** Generate a problem and tag it with the skill id and a plain-text form. */
export function makeProblem(skillId, options, rng, key) {
  const skill = getSkill(skillId);
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);
  const p = skill.generate(options || {}, rng, key);
  return { skillId, ...p, text: displayText(p.display, p.prompt) };
}

export function skillForKey(factKey) {
  const prefix = factKey.split(':')[0];
  const direct = byId.get(prefix);
  if (direct) return direct;
  return { add: byId.get('add-facts'), sub: byId.get('sub-facts'), mul: byId.get('mul-facts'), div: byId.get('div-facts') }[
    prefix
  ];
}

export function labelForKey(factKey) {
  const skill = skillForKey(factKey);
  if (!skill) return factKey;
  return skill.keyLabel ? skill.keyLabel(factKey) : factKey;
}
