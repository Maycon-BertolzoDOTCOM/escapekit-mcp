import { describe, it, expect, vi } from 'vitest';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase';

describe('KnowledgeBase (Final Tests)', () => {
  describe('pattern matching', () => {
    it('should match patterns with wildcards', () => {
      const kb = new KnowledgeBase();
      expect(kb.matchPattern('api.*.com', 'api.example.com')).toBe(true);
      expect(kb.matchPattern('*.service.com', 'auth.service.com')).toBe(true);
      expect(kb.matchPattern('internal-*', 'internal-database')).toBe(true);
    });

    it('should reject non-matching patterns', () => {
      const kb = new KnowledgeBase();
      expect(kb.matchPattern('safe.*.com', 'malicious.com')).toBe(false);
      expect(kb.matchPattern('*.trusted.org', 'evil.com')).toBe(false);
    });

    it('should handle regex special characters', () => {
      const kb = new KnowledgeBase();
      expect(kb.matchPattern('service[0-9]', 'service1')).toBe(true);
      expect(kb.matchPattern('service[0-9]', 'serviceA')).toBe(false);
    });
  });

  describe('threat intelligence', () => {
    it('should detect known malicious domains', () => {
      const kb = new KnowledgeBase();
      expect(kb.isMaliciousDomain('evil-tracker.com')).toBe(true);
      expect(kb.isMaliciousDomain('legitimate-api.com')).toBe(false);
    });

    it('should identify crypto mining patterns', () => {
      const kb = new KnowledgeBase();
      expect(kb.detectCryptoMining('coin-hive.com')).toBe(true);
      expect(kb.detectCryptoMining('mining-pool.org')).toBe(true);
      expect(kb.detectCryptoMining('normal-service.com')).toBe(false);
    });

    it('should flag data exfiltration domains', () => {
      const kb = new KnowledgeBase();
      expect(kb.detectDataExfiltration('exfil-server.net')).toBe(true);
      expect(kb.detectDataExfiltration('api.legitimate.com')).toBe(false);
    });
  });
});