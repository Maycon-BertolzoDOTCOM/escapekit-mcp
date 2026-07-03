/**
 * Semver Comparison
 *
 * Version comparison utilities.
 * Inspired by Claude Code's utils/semver.ts.
 *
 * Usage:
 *   import { gt, gte, lt, satisfies } from './utils/semver.js'
 *
 *   gt('2.0.0', '1.0.0')  // true
 *   satisfies('1.2.3', '>=1.0.0 <2.0.0')  // true
 */

/**
 * Parse a semver string into [major, minor, patch]
 */
function parseSemver(version: string): [number, number, number] {
  const cleaned = version.replace(/^v/, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Invalid semver: ${version}`);
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * Compare two versions. Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compare(a: string, b: string): number {
  const [aMaj, aMin, aPat] = parseSemver(a);
  const [bMaj, bMin, bPat] = parseSemver(b);
  return (aMaj - bMaj) * 1000000 + (aMin - bMin) * 1000 + (aPat - bPat);
}

export function gt(a: string, b: string): boolean { return compare(a, b) > 0; }
export function gte(a: string, b: string): boolean { return compare(a, b) >= 0; }
export function lt(a: string, b: string): boolean { return compare(a, b) < 0; }
export function lte(a: string, b: string): boolean { return compare(a, b) <= 0; }
export function eq(a: string, b: string): boolean { return compare(a, b) === 0; }

/**
 * Check if a version satisfies a simple range (e.g., ">=1.0.0 <2.0.0")
 */
export function satisfies(version: string, range: string): boolean {
  const conditions = range.split(/\s+/).filter(Boolean);

  for (const cond of conditions) {
    if (cond.startsWith('>=')) {
      if (!gte(version, cond.slice(2))) return false;
    } else if (cond.startsWith('>')) {
      if (!gt(version, cond.slice(1))) return false;
    } else if (cond.startsWith('<=')) {
      if (!lte(version, cond.slice(2))) return false;
    } else if (cond.startsWith('<')) {
      if (!lt(version, cond.slice(1))) return false;
    } else if (cond.startsWith('=')) {
      if (!eq(version, cond.slice(1))) return false;
    } else {
      if (!eq(version, cond)) return false;
    }
  }

  return true;
}

/**
 * Get the maximum of two versions
 */
export function max(a: string, b: string): string {
  return gt(a, b) ? a : b;
}

/**
 * Get the minimum of two versions
 */
export function min(a: string, b: string): string {
  return lt(a, b) ? a : b;
}

/**
 * Order an array of versions (ascending)
 */
export function order(versions: string[]): string[] {
  return [...versions].sort(compare);
}
