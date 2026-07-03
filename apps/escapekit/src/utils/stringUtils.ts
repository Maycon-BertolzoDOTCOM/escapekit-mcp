/**
 * String Utilities
 *
 * Common string manipulation functions.
 * Inspired by Claude Code's utils/stringUtils.ts.
 *
 * Usage:
 *   import { escapeRegExp, capitalize, plural, truncateToLines } from './utils/stringUtils.js'
 */

/**
 * Escape special regex characters in a string
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pluralize a word based on count
 */
export function plural(n: number, word: string, pluralWord?: string): string {
  return n === 1 ? word : (pluralWord ?? word + 's');
}

/**
 * Get the first line of a string
 */
export function firstLine(s: string): string {
  const idx = s.indexOf('\n');
  return idx === -1 ? s : s.slice(0, idx);
}

/**
 * Count occurrences of a character in a string
 */
export function countChar(str: string, char: string, start = 0): number {
  let count = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === char) count++;
  }
  return count;
}

/**
 * Normalize full-width digits to ASCII digits
 */
export function normalizeDigits(input: string): string {
  return input.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * Normalize full-width spaces to regular spaces
 */
export function normalizeSpaces(input: string): string {
  return input.replace(/\u3000/g, ' ');
}

/**
 * Truncate text to a maximum number of lines
 */
export function truncateToLines(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
}

/**
 * Safely join lines with a delimiter, respecting a max size
 */
export function safeJoinLines(lines: string[], delimiter = ',', maxSize = 100000): string {
  let result = '';
  for (let i = 0; i < lines.length; i++) {
    const prefix = result ? delimiter : '';
    const candidate = result + prefix + lines[i];
    if (candidate.length > maxSize) {
      return result + `${delimiter}... (${lines.length - i} more)`;
    }
    result = candidate;
  }
  return result;
}

/**
 * Slugify a string for use in URLs or filenames
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Indent each line of a string
 */
export function indent(str: string, spaces = 2): string {
  const prefix = ' '.repeat(spaces);
  return str.replace(/^/gm, prefix);
}

/**
 * Dedent a template literal string (remove common leading whitespace)
 */
export function dedent(str: string): string {
  const lines = str.split('\n');
  // Find minimum indent (ignoring empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const match = line.match(/^(\s*)/);
    if (match && match[1].length < minIndent) {
      minIndent = match[1].length;
    }
  }
  if (minIndent === Infinity) return str;
  return lines.map((line) => (line.trim().length === 0 ? '' : line.slice(minIndent))).join('\n');
}
