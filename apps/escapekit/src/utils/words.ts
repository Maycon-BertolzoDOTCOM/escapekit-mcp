/**
 * Random Word Slug Generator
 *
 * Generates whimsical "adjective-verb-noun" slugs for human-readable IDs.
 * Inspired by Claude Code's utils/words.ts.
 *
 * Usage:
 *   generateWordSlug()  // "gleaming-brewing-phoenix"
 */

import { randomInt } from 'node:crypto';

const ADJECTIVES = [
  'bold', 'brave', 'bright', 'calm', 'clever', 'cool', 'crisp', 'daring',
  'deep', 'eager', 'fast', 'fierce', 'gentle', 'glad', 'grand', 'happy',
  'keen', 'kind', 'light', 'loyal', 'lucid', 'merry', 'mild', 'neat',
  'noble', 'prime', 'proud', 'pure', 'quick', 'quiet', 'rapid', 'rare',
  'rich', 'safe', 'sharp', 'sleek', 'smart', 'smooth', 'soft', 'solid',
  'spry', 'stark', 'steady', 'strong', 'swift', 'tidy', 'true', 'vast',
  'warm', 'wise', 'witty', 'zesty',
];

const VERBS = [
  'acting', 'blazing', 'climbing', 'coding', 'dancing', 'diving', 'driving',
  'flying', 'forging', 'gliding', 'growing', 'guiding', 'hiking', 'hopping',
  'hunting', 'jogging', 'joining', 'jumping', 'launching', 'leading', 'leaping',
  'lifting', 'linking', 'living', 'making', 'marching', 'merging', 'moving',
  'navigating', 'opening', 'passing', 'playing', 'pushing', 'racing', 'riding',
  'rising', 'rolling', 'running', 'sailing', 'scaling', 'serving', 'shifting',
  'shining', 'shooting', 'skating', 'soaring', 'solving', 'sparking', 'sprinting',
  'stacking', 'starting', 'stepping', 'storming', 'striding', 'surfing', 'swinging',
  'taking', 'thinking', 'training', 'traveling', 'tuning', 'turning', 'typing',
  'unlocking', 'waking', 'walking', 'winning', 'working',
];

const NOUNS = [
  'arrow', 'beacon', 'bridge', 'castle', 'cloud', 'comet', 'craft', 'crown',
  'dawn', 'dragon', 'eagle', 'ember', 'falcon', 'flame', 'forge', 'glacier',
  'grove', 'harbor', 'haven', 'horizon', 'island', 'jewel', 'lantern', 'marble',
  'mountain', 'ocean', 'phoenix', 'pillar', 'pixel', 'prism', 'quartz', 'quest',
  'raven', 'river', 'rocket', 'sapphire', 'shield', 'spark', 'storm', 'stream',
  'summit', 'temple', 'thunder', 'tiger', 'titan', 'tower', 'trail', 'tribe',
  'valley', 'vertex', 'vortex', 'wave', 'wizard', 'zenith',
];

/**
 * Generate a random word slug
 */
export function generateWordSlug(): string {
  const adj = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const verb = VERBS[randomInt(VERBS.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  return `${adj}-${verb}-${noun}`;
}

/**
 * Generate a word slug with a numeric suffix
 */
export function generateWordSlugWithId(): string {
  return `${generateWordSlug()}-${randomInt(1000, 9999)}`;
}
