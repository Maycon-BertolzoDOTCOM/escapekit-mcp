/**
 * Debug Filter — Declarative debug filtering with multi-pattern category extraction.
 *
 * Extracts categories from unstructured log messages using multiple regex patterns,
 * then filters by include/exclude rules.
 *
 * Inspired by Claude Code's utils/debugFilter.ts.
 *
 * Usage:
 *   import { DebugFilter } from './utils/debugFilter.js'
 *
 *   const filter = new DebugFilter('api,hooks')  // show only api and hooks
 *   // or: new DebugFilter('!1p,!file')          // hide 1p and file
 *
 *   filter.shouldShow('[HOOKS] PreToolUse fired')  // true
 *   filter.shouldShow('[API] Request sent')          // true
 *   filter.shouldShow('[FILE] Reading config')       // false (excluded)
 */

interface FilterRule {
  type: 'include' | 'exclude';
  pattern: string;
  regex: RegExp;
}

/**
 * Extract categories from a debug message using multiple patterns
 */
function extractCategories(message: string): string[] {
  const categories: string[] = [];

  // Pattern 1: "category: message" → ["category"]
  const colonMatch = message.match(/^(\w[\w-]*):\s/);
  if (colonMatch) categories.push(colonMatch[1].toLowerCase());

  // Pattern 2: "[CATEGORY] message" → ["category"]
  const bracketMatch = message.match(/\[([A-Z][\w-]*)\]/g);
  if (bracketMatch) {
    for (const m of bracketMatch) {
      categories.push(m.slice(1, -1).toLowerCase());
    }
  }

  // Pattern 3: "MCP server "name": message" → ["mcp", "name"]
  if (message.includes('MCP')) categories.push('mcp');

  // Pattern 4: Error/warning detection
  if (/error|fail/i.test(message)) categories.push('error');
  if (/warn/i.test(message)) categories.push('warning');

  // Pattern 5: Timing/metrics
  if (/\d+ms|\d+s\b|duration/i.test(message)) categories.push('timing');

  return [...new Set(categories)];
}

export class DebugFilter {
  private rules: FilterRule[] = [];
  private mode: 'include' | 'exclude' = 'exclude';

  /**
   * Create a filter from a comma-separated filter string.
   *
   * "api,hooks" → include only api and hooks
   * "!1p,!file" → exclude 1p and file
   * "" or undefined → show everything
   */
  constructor(filterString?: string) {
    if (!filterString) return;

    const parts = filterString.split(',').map((s) => s.trim()).filter(Boolean);

    if (parts.length === 0) return;

    // Determine mode from first rule
    this.mode = parts[0].startsWith('!') ? 'exclude' : 'include';

    for (const part of parts) {
      const isExclude = part.startsWith('!');
      const pattern = isExclude ? part.slice(1) : part;

      this.rules.push({
        type: isExclude ? 'exclude' : 'include',
        pattern: pattern.toLowerCase(),
        regex: new RegExp(pattern.replace(/\*/g, '.*'), 'i'),
      });
    }
  }

  /**
   * Check if a message should be shown
   */
  shouldShow(message: string): boolean {
    if (this.rules.length === 0) return true;

    const categories = extractCategories(message);

    if (this.mode === 'include') {
      // Show if ANY category matches ANY include rule
      return categories.some((cat) =>
        this.rules.some((r) => r.type === 'include' && r.regex.test(cat)),
      );
    } else {
      // Hide if ANY category matches ANY exclude rule
      return !categories.some((cat) =>
        this.rules.some((r) => r.type === 'exclude' && r.regex.test(cat)),
      );
    }
  }

  /**
   * Get extracted categories for a message (for debugging)
   */
  getCategories(message: string): string[] {
    return extractCategories(message);
  }
}
