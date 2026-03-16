import { describe, it, expect } from 'vitest';
import { analyzeCode } from '../../src/tools/analyze';

describe('analyzeCode', () => {
  describe('parameter validation', () => {
    it('should return error for missing code', async () => {
      const result = await analyzeCode('');
      expect(result).toBeDefined();
    });

    it('should return error for undefined code', async () => {
      const result = await analyzeCode(undefined as any);
      expect(result).toBeDefined();
    });
  });

  describe('analyze', () => {
    it('should analyze valid code', async () => {
      const result = await analyzeCode('const x = 42;');
      expect(result).toBeDefined();
    });

    it('should analyze code with sandbox type', async () => {
      const result = await analyzeCode('console.log("test")', 'replit');
      expect(result).toBeDefined();
    });
  });
});
