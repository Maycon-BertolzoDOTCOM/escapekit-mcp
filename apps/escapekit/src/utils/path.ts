/**
 * Path Utilities
 *
 * Path manipulation helpers.
 * Inspired by Claude Code's utils/path.ts.
 *
 * Usage:
 *   import { expandPath, toRelativePath, containsTraversal } from './utils/path.js'
 */

import { homedir } from 'node:os';
import { relative, normalize, isAbsolute, join } from 'node:path';

/**
 * Expand ~ to home directory and normalize slashes
 */
export function expandPath(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return join(homedir(), path.slice(2));
  }
  if (path.startsWith('~')) {
    // ~username — not supported, expand as ~/
    return join(homedir(), path.slice(1));
  }
  return normalize(path);
}

/**
 * Convert absolute path to relative (from cwd or custom base)
 */
export function toRelativePath(absolutePath: string, basePath?: string): string {
  const base = basePath ?? process.cwd();
  const rel = relative(base, absolutePath);
  return rel.startsWith('..') ? absolutePath : rel || '.';
}

/**
 * Check if a path contains directory traversal (../)
 */
export function containsTraversal(path: string): boolean {
  return path.includes('..') || path.includes('%2e%2e') || path.includes('%2E%2E');
}

/**
 * Normalize a path for use as a config key (forward slashes, no trailing)
 */
export function normalizePathForConfigKey(path: string): string {
  return normalize(path).replace(/\\/g, '/').replace(/\/$/, '');
}

/**
 * Check if a path is within a directory
 */
export function isPathWithin(childPath: string, parentPath: string): boolean {
  const rel = relative(parentPath, childPath);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Get the filename without extension
 */
export function getBasenameWithoutExt(filePath: string): string {
  const { basename, extname } = require('node:path');
  const name = basename(filePath);
  const ext = extname(name);
  return ext ? name.slice(0, -ext.length) : name;
}

/**
 * Ensure a path has a specific extension
 */
export function ensureExtension(filePath: string, ext: string): string {
  const dot = ext.startsWith('.') ? ext : `.${ext}`;
  return filePath.endsWith(dot) ? filePath : filePath + dot;
}
