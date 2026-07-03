/**
 * Intl Object Cache
 *
 * Lazy-initialized Intl constructors cached for reuse.
 * Inspired by Claude Code's utils/intl.ts.
 */

let graphemeSegmenter: Intl.Segmenter | null = null;
let wordSegmenter: Intl.Segmenter | null = null;
const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
let cachedTimeZone: string | null = null;

export function getGraphemeSegmenter(): Intl.Segmenter {
  if (!graphemeSegmenter) {
    graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  }
  return graphemeSegmenter;
}

export function getWordSegmenter(): Intl.Segmenter {
  if (!wordSegmenter) {
    wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  }
  return wordSegmenter;
}

export function getRelativeTimeFormat(
  style: 'long' | 'short' | 'narrow',
  numeric: 'always' | 'auto',
): Intl.RelativeTimeFormat {
  const key = `${style}:${numeric}`;
  let rtf = rtfCache.get(key);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat('en', { style, numeric });
    rtfCache.set(key, rtf);
  }
  return rtf;
}

export function getTimeZone(): string {
  if (!cachedTimeZone) {
    cachedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return cachedTimeZone;
}

/**
 * Extract first grapheme cluster from a string
 */
export function firstGrapheme(text: string): string {
  if (!text) return '';
  const segments = getGraphemeSegmenter().segment(text);
  const first = segments[Symbol.iterator]().next().value;
  return first?.segment ?? '';
}

/**
 * Extract last grapheme cluster from a string
 */
export function lastGrapheme(text: string): string {
  if (!text) return '';
  let last = '';
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    last = segment;
  }
  return last;
}
