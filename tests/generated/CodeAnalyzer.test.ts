import { describe, it, expect } from 'vitest';
import { CodeAnalyzer } from '../../src/analyzers/CodeAnalyzer';

describe('CodeAnalyzer', () => {
  describe('constructor', () => {
    it('should create analyzer with dependencies', () => {
      const analyzer = new CodeAnalyzer();
      expect(analyzer).toBeDefined();
    });
  });

  describe('analyze', () => {
    it('should analyze simple code', async () => {
      const analyzer = new CodeAnalyzer();
      const code = 'const x = 1;';
      const result = await analyzer.analyze(code);
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });
});
