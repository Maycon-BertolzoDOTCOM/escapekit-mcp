import { describe, it, expect } from 'vitest';
import { UnicodeAnalyzer } from '../../src/security/UnicodeAnalyzer.js';

describe('UnicodeAnalyzer', () => {
  const analyzer = new UnicodeAnalyzer();

  describe('analyze', () => {
    it('returns empty array for clean ASCII package names', () => {
      const issues = analyzer.analyze('react-dom', 'package_name');
      expect(issues).toHaveLength(0);
    });

    it('returns empty array for clean ASCII scripts', () => {
      const issues = analyzer.analyze('console.log("hello world");', 'script');
      expect(issues).toHaveLength(0);
    });

    it('detects invisible characters (zero-width joiner)', () => {
      // "react" + zero-width joiner
      const name = 'react\u200D';
      const issues = analyzer.analyze(name, 'package_name');
      
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Invisible Unicode');
      expect(issues[0].severity).toBe('warning');
    });

    it('detects Bidi control characters (Trojan Source)', () => {
      // "admin" with Right-to-Left Override
      const code = 'const access = "admin\u202E"';
      const issues = analyzer.analyze(code, 'script');
      
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('bidirectional');
      expect(issues[0].severity).toBe('error');
    });

    it('detects mixed-script homoglyph attacks (Cyrillic mixed with Latin)', () => {
      // "paypal" where the first 'a' is a Cyrillic 'а' (U+0430)
      const homoglyphName = 'p\u0430ypal';
      const issues = analyzer.analyze(homoglyphName, 'package_name');
      
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Mixed-script');
      expect(issues[0].severity).toBe('error');
    });

    it('flags multiple issues if multiple attack types are combined', () => {
      // Cyrillic 'а' + RLO
      const multiVector = 'p\u0430ypal\u202E';
      const issues = analyzer.analyze(multiVector, 'package_name');
      
      expect(issues).toHaveLength(2);
      const types = issues.map(i => i.message);
      expect(types).toContain('Potentially malicious bidirectional (Bidi) Unicode characters detected');
      expect(types).toContain('Mixed-script package name detected (Homoglyph Attack)');
    });
  });
});
