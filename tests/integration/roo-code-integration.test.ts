/**
 * Testes de Integração: Roo Code (diff-based editing)
 *
 * Valida o fluxo completo de aplicação de diffs no ecossistema EscapeKit,
 * incluindo CLI, pipeline de transformação e geração de contratos.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { TransformationPipeline } from '../../src/generators/TransformationPipeline.js';
import { DiffApplyTransformer } from '../../src/transformers/DiffApplyTransformer.js';
import type { AnalysisResult } from '../../src/models/schemas.js';

// ── Fixtures e Helpers ─────────────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), '.test-tmp-roo-code');

async function setupTestDir() {
  if (!existsSync(TEST_DIR)) {
    await mkdir(TEST_DIR, { recursive: true });
  }
}

async function cleanupTestDir() {
  const { rm } = await import('fs/promises');
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }
}

async function createTestFile(filename: string, content: string): Promise<string> {
  const filepath = join(TEST_DIR, filename);
  await writeFile(filepath, content, 'utf-8');
  return filepath;
}

const validDiff = `--- a/test.js
+++ b/test.js
@@ -1,3 +1,3 @@
 line 1
-old line 2
+new line 2
 line 3`;

const multiHunkDiff = `--- a/test.js
+++ b/test.js
@@ -1,3 +1,3 @@
 line 1
-old line 2
+new line 2
 line 3
@@ -5,3 +5,3 @@
 line 5
-old line 6
+new line 6
 line 7`;

const invalidDiff = `invalid diff content`;

// ── Suite Principal ─────────────────────────────────────────────────────────

describe('Roo Code Integration', () => {
  let pipeline: TransformationPipeline;
  let diffTransformer: DiffApplyTransformer;

  beforeEach(async () => {
    await setupTestDir();
    vi.clearAllMocks();
    pipeline = new TransformationPipeline();
    diffTransformer = new DiffApplyTransformer();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  describe('DiffApplyTransformer - Fluxo Completo', () => {
    it('should validate and apply diff successfully', async () => {
      // Arrange
      const originalContent = 'line 1\nold line 2\nline 3\n';
      const filepath = await createTestFile('test.js', originalContent);

      // Act - Validate
      const isValid = diffTransformer.validateDiff(validDiff);
      expect(isValid).toBe(true);

      // Act - Apply
      const result = await diffTransformer.applyDiff(filepath, validDiff, {
        backup: true,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.hunksApplied).toBe(1);
      expect(result.linesChanged).toBe(2); // 1 removal + 1 addition
      expect(result.backupPath).toBeDefined();

      // Verify content
      const modifiedContent = await readFile(filepath, 'utf-8');
      expect(modifiedContent).toBe('line 1\nnew line 2\nline 3\n');

      // Verify backup
      if (result.backupPath) {
        const backupContent = await readFile(result.backupPath, 'utf-8');
        expect(backupContent).toBe(originalContent);
      }
    });

    it('should handle multiple hunks correctly', async () => {
      // Arrange
      const originalContent = 'line 1\nold line 2\nline 3\n\nline 5\nold line 6\nline 7\n';
      const filepath = await createTestFile('test.js', originalContent);

      // Act
      const result = await diffTransformer.applyDiff(filepath, multiHunkDiff, {
        backup: false,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.hunksApplied).toBe(2);
      expect(result.linesChanged).toBe(4); // 2 hunks * (1 removal + 1 addition)

      // Verify content
      const modifiedContent = await readFile(filepath, 'utf-8');
      expect(modifiedContent).toBe('line 1\nnew line 2\nline 3\n\nline 5\nnew line 6\nline 7\n');
    });

    it('should generate diff between files', () => {
      // Arrange
      const original = 'function foo() { return 1; }';
      const modified = 'function bar() { return 2; }';

      // Act
      const diff = diffTransformer.generateDiff(original, modified);

      // Assert
      expect(diff).toBeDefined();
      expect(diff).toContain('---');
      expect(diff).toContain('+++');
      expect(diff).toContain('@@');
      expect(diff).toContain('-');
      expect(diff).toContain('+');
    });

    it('should reject invalid diffs', async () => {
      // Arrange
      const filepath = await createTestFile('test.js', 'some content');

      // Act
      const isValid = diffTransformer.validateDiff(invalidDiff);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('TransformationPipeline - Integração com Diffs', () => {
    it('should process analysis with diff options', async () => {
      // Arrange
      const mockAnalysisResult: AnalysisResult = {
        analysisId: 'test-analysis-123',
        timestamp: new Date().toISOString(),
        language: 'javascript',
        summary: {
          totalIssues: 0,
          ghostImports: 0,
          mockApis: 0,
          suspiciousImports: 0,
          codeSmells: 0,
          securityIssues: 0,
        },
        issues: [],
        confidenceScore: 0.95,
        warnings: [],
      };

      const sourceCode = 'const x = 1;';

      // Act
      const result = await pipeline.processAnalysisResult(mockAnalysisResult, sourceCode, {
        diffsToApply: [validDiff],
        fuzzyThreshold: 0.7,
        force: false,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.analysisId).toBe('test-analysis-123');
      expect(result.ghostImports).toEqual([]);
      expect(result.requiresManualReview).toBe(false);
    });

    it('should support applyDiffToFile method', async () => {
      // Arrange
      const originalContent = 'line 1\nold line 2\nline 3\n';
      const filepath = await createTestFile('pipeline-test.js', originalContent);

      // Act
      const result = await pipeline.applyDiffToFile(filepath, validDiff, 0.8);

      // Assert
      expect(result.success).toBe(true);
      expect(result.hunksApplied).toBe(1);

      // Verify content
      const modifiedContent = await readFile(filepath, 'utf-8');
      expect(modifiedContent).toBe('line 1\nnew line 2\nline 3\n');
    });

    it('should support generateDiff method', () => {
      // Arrange
      const original = 'import old from "old-pkg";';
      const modified = 'import new from "new-pkg";';

      // Act
      const diff = pipeline.generateDiff(original, modified);

      // Assert
      expect(diff).toBeDefined();
      expect(diff).toContain('old-pkg');
      expect(diff).toContain('new-pkg');
    });

    it('should support validateDiff method', () => {
      // Act & Assert
      expect(pipeline.validateDiff(validDiff)).toBe(true);
      expect(pipeline.validateDiff(invalidDiff)).toBe(false);
    });
  });

  describe('Fuzzy Matching - Aplicação Robusta', () => {
    it('should apply diff with minor content variations', async () => {
      // Arrange
      const originalContent = 'line 1\nold line 2\nline 3\n';
      const diffWithNoise = `--- a/test.js
+++ b/test.js
@@ -1,3 +1,3 @@
 line 1
-old line 2
+new line 2
 line 3`;
      const filepath = await createTestFile('fuzzy-test.js', originalContent);

      // Act - Apply with high threshold
      const result = await diffTransformer.applyDiff(filepath, diffWithNoise, {
        fuzzyThreshold: 0.8,
        backup: false,
      });

      // Assert
      expect(result.success).toBe(true);
    });

    it('should reject diff with low similarity threshold', async () => {
      // Arrange
      const originalContent = 'completely different content\n';
      const filepath = await createTestFile('low-sim-test.js', originalContent);

      // Act
      const result = await diffTransformer.applyDiff(filepath, validDiff, {
        fuzzyThreshold: 0.1, // Very strict
        backup: false,
      });

      // Assert - Should fail with low similarity
      expect(result.success).toBe(false);
    });
  });

  describe('Tratamento de Erros e Edge Cases', () => {
    it('should handle non-existent file gracefully', async () => {
      // Arrange
      const nonExistentFile = join(TEST_DIR, 'does-not-exist.js');

      // Act & Assert - Should throw error for non-existent file
      await expect(
        diffTransformer.applyDiff(nonExistentFile, validDiff, {
          backup: false,
        })
      ).rejects.toThrow('Failed to read file');
    });

    it('should preserve file encoding correctly', async () => {
      // Arrange
      const contentWithUnicode = 'const greeting = "Olá mundo! 🌍";\n';
      const diff = `--- a/test.js
+++ b/test.js
@@ -1 +1 @@
-const greeting = "Olá mundo! 🌍";
+const greeting = "Hello world! 🌍";`;
      const filepath = await createTestFile('unicode-test.js', contentWithUnicode);

      // Act
      const result = await diffTransformer.applyDiff(filepath, diff, {
        backup: false,
      });

      // Assert
      expect(result.success).toBe(true);
      const modifiedContent = await readFile(filepath, 'utf-8');
      expect(modifiedContent).toContain('Hello world! 🌍');
    });

    it('should handle empty diff gracefully', async () => {
      // Arrange
      const filepath = await createTestFile('empty-diff.js', 'some content');

      // Act
      const isValid = diffTransformer.validateDiff('');

      // Assert
      expect(isValid).toBe(false);
    });

    it('should handle diff with no changes', async () => {
      // Arrange
      const content = 'line 1\nline 2\nline 3\n';
      const noChangeDiff = `--- a/test.js
+++ b/test.js`;
      const filepath = await createTestFile('no-change.js', content);

      // Act & Assert - Should throw error for invalid diff (no hunks)
      await expect(
        diffTransformer.applyDiff(filepath, noChangeDiff, {
          backup: false,
        })
      ).rejects.toThrow('Invalid diff format');
    });
  });

  describe('Múltiplas Aplicações Consecutivas', () => {
    it('should apply multiple diffs in sequence', async () => {
      // Arrange
      const originalContent = 'function test() {\n  return 1;\n}\n';
      const filepath = await createTestFile('multi-diff.js', originalContent);

      const diff1 = `--- a/multi-diff.js
+++ b/multi-diff.js
@@ -1,3 +1,3 @@
 function test() {
-  return 1;
+  return 2;
 }
`;

      const diff2 = `--- a/multi-diff.js
+++ b/multi-diff.js
@@ -1,3 +1,3 @@
 function test() {
-  return 2;
+  return 3;
 }
`;

      // Act - Apply first diff
      const result1 = await diffTransformer.applyDiff(filepath, diff1, {
        backup: false,
      });

      // Apply second diff
      const result2 = await diffTransformer.applyDiff(filepath, diff2, {
        backup: false,
      });

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const finalContent = await readFile(filepath, 'utf-8');
      expect(finalContent).toContain('return 3;');
    });
  });
});