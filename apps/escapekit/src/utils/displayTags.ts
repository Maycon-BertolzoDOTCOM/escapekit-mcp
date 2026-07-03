/**
 * Display Tag Stripper
 *
 * Strips XML-like <tag>...</tag> blocks from text.
 * Inspired by Claude Code's utils/displayTags.ts.
 *
 * Usage:
 *   stripDisplayTags('[system]Hello[/system] World')  // ' World'
 */

const TAG_PATTERN = /<(\w+)[^>]*>[\s\S]*?<\/\1>/g;
const BRACKET_TAG_PATTERN = /\[(\w+)[^\]]*\][\s\S]*?\[\/\1\]/g;

/**
 * Strip all display tags from text
 */
export function stripDisplayTags(text: string): string {
  return text.replace(TAG_PATTERN, '').replace(BRACKET_TAG_PATTERN, '').trim();
}

/**
 * Extract content from a specific tag
 */
export function extractTagContent(text: string, tagName: string): string | null {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Check if text contains any display tags
 */
export function hasDisplayTags(text: string): boolean {
  return TAG_PATTERN.test(text) || BRACKET_TAG_PATTERN.test(text);
}
