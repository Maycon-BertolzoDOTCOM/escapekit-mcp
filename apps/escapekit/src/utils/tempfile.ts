/**
 * Temp File Path Generator
 *
 * Generates temporary file paths with optional content hash for stability.
 * Inspired by Claude Code's utils/tempfile.ts.
 */

import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Generate a temp file path
 *
 * @param prefix - Filename prefix
 * @param content - Optional content for hash-based stable path
 */
export function generateTempFilePath(prefix = 'ekit', content?: string): string {
  const dir = tmpdir();

  if (content) {
    const { createHash } = require('node:crypto') as typeof import('node:crypto');
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    return join(dir, `${prefix}-${hash}`);
  }

  const random = randomBytes(8).toString('hex');
  return join(dir, `${prefix}-${random}`);
}

/**
 * Generate a unique suffix for disambiguation
 */
export function uniqueSuffix(): string {
  return `${Date.now()}-${randomBytes(4).toString('hex')}`;
}
