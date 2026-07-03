import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DiffApplyTransformer } from '../../src/transformers/DiffApplyTransformer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('DiffApplyTransformer (Expanded)', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vitest-'));
    testFile = path.join(tempDir, 'test.js');
    await fs.writeFile(testFile, 'const x = 42;');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create transformer with default config', () => {
      const transformer = new DiffApplyTransformer();
      expect(transformer).toBeDefined();
      expect(typeof transformer.applyDiff).toBe('function');
    });
  });

  describe('applyDiff', () => {
    it('should return a result object', async () => {
      const transformer = new DiffApplyTransformer();
      const diff = '--- a/test.js\n+++ b/test.js\n@@ -1 +1 @@\n-const x = 42;\n+const x = 42; // comment';
      const result = await transformer.applyDiff(testFile, diff);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.success).toBeDefined();
    });

    it('should handle simple text insertion', async () => {
      const transformer = new DiffApplyTransformer();
      const diff = '--- a/test.js\n+++ b/test.js\n@@ -1 +1 @@\n-const x = 42;\n+const x = 42; // comment';
      const result = await transformer.applyDiff(testFile, diff);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.success).toBe(true);
    });

    it('should handle text patch format', async () => {
      const transformer = new DiffApplyTransformer();
      const diff = '--- a/test.js\n+++ b/test.js\n@@ -1 +1 @@\n-const x = 42;\n+const x = 100;';
      const result = await transformer.applyDiff(testFile, diff);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.success).toBe(true);
    });

    it('should create backup when requested', async () => {
      const transformer = new DiffApplyTransformer();
      const diff = '--- a/test.js\n+++ b/test.js\n@@ -1 +1 @@\n-const x = 42;\n+const x = 42; // comment';
      const backupPath = path.join(tempDir, 'backup.js');
      const result = await transformer.applyDiff(testFile, diff, { backup: true, backupPath });
      expect(result.success).toBe(true);
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    it('should handle non-existent files gracefully', async () => {
      const transformer = new DiffApplyTransformer();
      const nonExistentFile = path.join(tempDir, 'nonexistent.js');
      const diff = '--- a/test.js\n+++ b/test.js\n@@ -1 +1 @@\n-const x = 42;\n+const x = 42; // comment';
      try {
        const result = await transformer.applyDiff(nonExistentFile, diff);
        expect(result.success).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Failed to read file');
      }
    });

    it('should validate diff format before applying', async () => {
      const transformer = new DiffApplyTransformer();
      const invalidDiff = 'INVALID FORMAT';
      try {
        const result = await transformer.applyDiff(testFile, invalidDiff);
        expect(result.success).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Invalid diff format');
      }
    });
  });

  describe('validateDiff', () => {
    it('should return true for valid INSERT diff', () => {
      const transformer = new DiffApplyTransformer();
      const diff = '--- a/test.js\n+++ b/test.js\n@@ -1 +1 @@\n-const x = 42;\n+const x = 42; // comment';
      const isValid = transformer.validateDiff(diff);
      expect(isValid).toBe(true);
    });

    it('should return true for valid DELETE diff', () => {
      const transformer = new DiffApplyTransformer();
      const diff = '--- a/test.js\n+++ b/test.js\n@@ -1 +1 @@\n-const x = 42;\n+const x = 42;';
      const isValid = transformer.validateDiff(diff);
      expect(isValid).toBe(true);
    });

    it('should return true for valid REPLACE diff', () => {
      const transformer = new DiffApplyTransformer();
      const diff = '--- a/test.js\n+++ b/test.js\n@@ -1 +1 @@\n-const x = 42;\n+const x = 100;';
      const isValid = transformer.validateDiff(diff);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid diff format', () => {
      const transformer = new DiffApplyTransformer();
      const diff = 'INVALID FORMAT';
      const isValid = transformer.validateDiff(diff);
      expect(isValid).toBe(false);
    });

    it('should return false for empty diff', () => {
      const transformer = new DiffApplyTransformer();
      const diff = '';
      const isValid = transformer.validateDiff(diff);
      expect(isValid).toBe(false);
    });

    it('should return false for diff without headers', () => {
      const transformer = new DiffApplyTransformer();
      const diff = '@@ -1 +1 @@\n-const x = 42;\n+const x = 42;';
      const isValid = transformer.validateDiff(diff);
      expect(isValid).toBe(false);
    });
  });
});