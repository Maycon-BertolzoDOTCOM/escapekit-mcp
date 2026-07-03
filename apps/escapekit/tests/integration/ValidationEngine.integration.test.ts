import { ValidationEngine } from '../../src/validate/ValidationEngine.js';
import { FallbackGenerator } from '../../src/validate/auto-fix/FallbackGenerator.js';
import { join } from 'node:path';
import { cp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const engine = new ValidationEngine();
const FIXTURES_DIR = join(import.meta.dirname, '../fixtures');

async function copyFixture(fixtureName: string): Promise<string> {
  const srcPath = join(FIXTURES_DIR, fixtureName);
  const destPath = join(tmpdir(), randomUUID());
  await cp(srcPath, destPath, { recursive: true });
  return destPath;
}