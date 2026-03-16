import { describe, it, expect } from 'vitest';
import { RiskScorer } from '../../src/security/RiskScorer.ts';

describe('RiskScorer', () => {
  describe('calculateScore', () => {
    it('should return 0 for no patterns', () => {
      const scorer = new RiskScorer();
      const score = scorer.calculateScore([]);
      expect(score).toBe(0);
    });

    it('should calculate score for network patterns', () => {
      const scorer = new RiskScorer();
      const patterns = [
        { type: 'network_request', regex: /curl/, line: 1, column: 1 }
      ];
      const score = scorer.calculateScore(patterns);
      expect(score).toBe(30);
    });

    it('should deduplicate pattern types', () => {
      const scorer = new RiskScorer();
      const patterns = [
        { type: 'network_request', regex: /curl/, line: 1, column: 1 },
        { type: 'network_request', regex: /wget/, line: 2, column: 1 }
      ];
      const score = scorer.calculateScore(patterns);
      expect(score).toBe(30); // Only counted once
    });

    it('should cap score at 100', () => {
      const scorer = new RiskScorer();
      const patterns = [
        { type: 'slopsquat', regex: /./, line: 1, column: 1 },
        { type: 'unicode_homoglyph', regex: /./, line: 1, column: 1 },
        { type: 'unicode_bidi', regex: /./, line: 1, column: 1 }
      ];
      const score = scorer.calculateScore(patterns);
      expect(score).toBe(100);
    });
  });

  describe('getSeverity', () => {
    it('should return error for scores > 70', () => {
      const scorer = new RiskScorer();
      expect(scorer.getSeverity(80)).toBe('error');
    });

    it('should return warning for scores 40-70', () => {
      const scorer = new RiskScorer();
      expect(scorer.getSeverity(50)).toBe('warning');
    });

    it('should return info for scores < 40', () => {
      const scorer = new RiskScorer();
      expect(scorer.getSeverity(20)).toBe('info');
    });
  });
});
