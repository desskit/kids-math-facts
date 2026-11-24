// Round configuration helpers: how many questions of each kind.
//
// Each entry in config.skills may carry `count`: the number of questions of
// that kind in a question set or mastery round. The round's total is their
// sum. In a timed sprint the same numbers set the mix (15 × and 5 ÷ means
// three of every four questions are multiplication).
//
// Configs saved before per-kind counts existed only have a total
// (config.count); it is split evenly across the kinds.

export const DEFAULT_SKILL_COUNT = 10;
export const MAX_SKILL_COUNT = 200;

const validCount = (n) => Number.isInteger(n) && n > 0;

/** Questions (or mix weight) for each entry in config.skills, in order. */
export function skillCounts(config) {
  const skills = config.skills || [];
  if (!skills.length) return [];
  if (skills.some((s) => validCount(s.count))) {
    return skills.map((s) => Math.min(MAX_SKILL_COUNT, validCount(s.count) ? s.count : DEFAULT_SKILL_COUNT));
  }
  const total = Math.max(skills.length, config.count || 20);
  const base = Math.floor(total / skills.length);
  const extra = total - base * skills.length;
  return skills.map((_, i) => base + (i < extra ? 1 : 0));
}

/** Total questions in a question set or mastery round. */
export function totalQuestions(config) {
  if (config.fixed) return config.fixed.length;
  return skillCounts(config).reduce((a, b) => a + b, 0);
}

/** A copy of the config with every kind's count filled in and the total updated. */
export function normalizeConfig(config) {
  if (config.fixed) return { ...config };
  const counts = skillCounts(config);
  const skills = (config.skills || []).map((s, i) => ({ ...s, count: counts[i] }));
  const out = { ...config, skills };
  if (config.mode !== 'timed') out.count = counts.reduce((a, b) => a + b, 0);
  return out;
}
