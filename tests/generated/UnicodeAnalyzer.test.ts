import { describe, it, expect } from 'vitest';
import { UnicodeAnalyzer } from '../../src/security/UnicodeAnalyzer.ts';

describe('UnicodeAnalyzer', () => {
  describe('analyze', () => {
    it('should detect invisible characters', () => {
      const analyzer = new UnicodeAnalyzer();
      const result = analyzer.analyze('fake\u200Bpackage');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('unicode_risk');
    });

    it('should detect Bidi characters', () => {
      const analyzer = new UnicodeAnalyzer();
      const result = analyzer.analyze('package\u202E');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].severity).toBe('error');
    });

    it('should detect mixed script (homoglyph)', () => {
      const analyzer = new UnicodeAnalyzer();
      const result = analyzer.analyze('pаypal', 'package_name');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should not flag clean package names', () => {
      const analyzer = new UnicodeAnalyzer();
      const result = analyzer.analyze('react');
      expect(result).toHaveLength(0);
    });

    it('should handle script context', () => {
      const analyzer = new UnicodeAnalyzer();
      const result = analyzer.analyze('const x = 1;', 'script');
      expect(result).toHaveLength(0);
    });
  });
});
