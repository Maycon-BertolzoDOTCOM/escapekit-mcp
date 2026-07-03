/**
 * Unicode Sanitization
 *
 * Defense against ASCII Smuggling and Hidden Prompt Injection attacks.
 * Inspired by Claude Code's utils/sanitization.ts.
 *
 * Usage:
 *   import { sanitizeUnicode, containsSuspiciousUnicode } from './utils/sanitization.js'
 */

/**
 * Suspicious Unicode ranges used in attacks:
 * - Tag characters (U+E0000-U+E007F) — invisible in most renderers
 * - Variation selectors (U+FE00-U+FE0F)
 * - Zero-width characters (U+200B, U+200C, U+200D, U+FEFF)
 * - Bidirectional overrides (U+202A-U+202E)
 * - Private use area (U+E000-U+F8FF)
 */
const SUSPICIOUS_RANGES: [number, number][] = [
  [0xe0000, 0xe007f], // Tag characters
  [0xfe00, 0xfe0f],   // Variation selectors
  [0xe0100, 0xe01ef], // Variation selectors supplement
  [0x200b, 0x200f],   // Zero-width + directional marks
  [0x202a, 0x202e],   // Bidirectional overrides
  [0x2060, 0x2064],   // Word joiner, invisible separators
  [0x2066, 0x206f],   // Bidirectional isolates
  [0xe000, 0xf8ff],   // Private use area
];

/**
 * Check if a character code is in a suspicious range
 */
function isSuspiciousCodePoint(cp: number): boolean {
  for (const [start, end] of SUSPICIOUS_RANGES) {
    if (cp >= start && cp <= end) return true;
  }
  return false;
}

/**
 * Check if a string contains suspicious Unicode characters
 */
export function containsSuspiciousUnicode(text: string): boolean {
  for (const cp of text) {
    if (isSuspiciousCodePoint(cp.codePointAt(0) ?? 0)) return true;
  }
  return false;
}

/**
 * Remove suspicious Unicode characters from a string.
 * Replaces them with their Unicode code point in brackets: [U+XXXX]
 */
export function sanitizeUnicode(text: string): string {
  let result = '';
  for (const cp of text) {
    const codePoint = cp.codePointAt(0) ?? 0;
    if (isSuspiciousCodePoint(codePoint)) {
      result += `[U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}]`;
    } else {
      result += cp;
    }
  }
  return result;
}

/**
 * Recursively sanitize all string values in an object/array
 */
export function recursivelySanitize(obj: unknown): unknown {
  if (typeof obj === 'string') return sanitizeUnicode(obj);
  if (Array.isArray(obj)) return obj.map(recursivelySanitize);
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = recursivelySanitize(value);
    }
    return result;
  }
  return obj;
}

/**
 * Strip all non-ASCII characters from a string
 */
export function stripNonAscii(text: string): string {
  return text.replace(/[^\x20-\x7E\n\r\t]/g, '');
}
