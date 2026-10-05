// The Top 10's rules: what counts as a name, and what counts as a believable score.
// Pure functions with no AWS code, so they are easy to unit test.
import { BLOCK_ANYWHERE, BLOCK_WHOLE } from './words.mjs';

export const FINAL_LEVEL = 20;
export const NAME_MAX = 12;
export const BOARDS = ['normal', 'easy'];

// Same values as the game's FRUIT_PTS: the prize that appears twice on each level.
const FRUIT_PTS = [100, 200, 300, 400, 500, 700, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000];
const END_BONUS = 5000; // per life left when the tale is finished
const EXTRA_LIFE_EVERY = 10000;

// The game trims names the same way, so a name looks identical in both places.
export const cleanName = raw => String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

// Letters (any alphabet), digits, spaces and a little punctuation.
const NAME_CHARS = /^[\p{L}\p{M}\p{N} .'_!&-]+$/u;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'i' };
// Lower case, accents off, look-alike digits turned back into letters.
const plain = s => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[0-9@$!|]/g, c => LEET[c] || c);
const squeeze = s => s.replace(/(.)\1+/g, '$1'); // "fuuuun" -> "fun"

function hasBlockedWord(name) {
  const p = plain(name);
  const joined = p.replace(/[^a-z]/g, '');
  const forms = [joined, squeeze(joined)];
  if (BLOCK_ANYWHERE.some(w => forms.some(f => f.includes(w)))) return true;
  // Short words that hide inside ordinary names ("Cassandra") only count on their own.
  const words = p.split(/[^a-z]+/).filter(Boolean);
  const candidates = new Set([...words, ...words.map(squeeze), ...forms]);
  return BLOCK_WHOLE.some(w => candidates.has(w));
}

// Returns null for a good name, or why it can't be used.
export function nameProblem(raw) {
  const name = cleanName(raw);
  if (!name) return 'empty';
  if ([...name].length > NAME_MAX) return 'long';
  if (!NAME_CHARS.test(name) || !HAS_LETTER_OR_DIGIT.test(name)) return 'chars';
  if (hasBlockedWord(name)) return 'words';
  return null;
}

// The most points one level can give, rounded up generously: every pearl at double value, all four
// slippers with every mouse caught and the Prince's waltz, both prizes, the beads and the garden gate.
export function maxLevelPoints(level) {
  return 250 * 20 + 4 * 50 + 4 * (200 + 400 + 800 + 1600) + 4 * 3000 + 2 * FRUIT_PTS[level - 1] + (500 + level * 100) + 500 + 2000;
}

export function maxScore(level, done) {
  let total = 0;
  for (let l = 1; l <= level; l++) total += maxLevelPoints(l);
  if (done) total += (5 + Math.ceil(total / EXTRA_LIFE_EVERY)) * END_BONUS;
  return total;
}

// The quickest anyone could reach a level: each cleared level takes well over 15 seconds of play.
export const SECONDS_PER_LEVEL = 15;
export const minSeconds = (level, done) => SECONDS_PER_LEVEL * (level - 1 + (done ? 1 : 0));
export const MAX_POINTS_PER_SECOND = 2500;
export const MAX_GAME_HOURS = 12;

// Checks a submitted score against the server's own record of when the game started.
// Returns null when it is believable, or the reason it isn't.
export function scoreProblem({ score, level, done, elapsedSeconds }) {
  if (!Number.isInteger(level) || level < 1 || level > FINAL_LEVEL) return 'level';
  if (!Number.isInteger(score) || score < 0) return 'score';
  if (typeof done !== 'boolean' || (done && level !== FINAL_LEVEL)) return 'done';
  if (score > maxScore(level, done)) return 'too-high';
  if (elapsedSeconds < minSeconds(level, done)) return 'too-fast';
  if (score > 5000 + elapsedSeconds * MAX_POINTS_PER_SECOND) return 'too-fast';
  if (elapsedSeconds > MAX_GAME_HOURS * 3600) return 'too-old';
  return null;
}
