import { describe, it, expect } from 'vitest';
import { JavaScriptAnalyzer } from '../../src/analyzers/JavaScriptAnalyzer';

describe('JavaScriptAnalyzer', () => {
  describe('constructor', () => {
    it('should create analyzer with detectors', () => {
      const analyzer = new JavaScriptAnalyzer();
      expect(analyzer).toBeDefined();
    });
  });

  describe('languageName', () => {
    it('should return correct language name', () => {
      const analyzer = new JavaScriptAnalyzer();
      expect(analyzer.languageName()).toBe('JavaScript/TypeScript');
    });
  });

  describe('parse', () => {
    it('should parse simple JavaScript code', () => {
      const analyzer = new JavaScriptAnalyzer();
      const code = 'const x = 1;';
      const result = analyzer.parse(code);
      expect(result).toBeDefined();
      expect(result.imports).toEqual([]);
      expect(result.mockApis).toEqual([]);
      expect(result.webglUsages).toEqual([]);
    });

    it('should detect imports', () => {
      const analyzer = new JavaScriptAnalyzer();
      const code = "import React from 'react';";
      const result = analyzer.parse(code);
      expect(result.imports.length).toBeGreaterThan(0);
    });
  });
});
