import { describe, it, expect } from 'vitest';
import { SlopsquatDetector } from '../../src/security/SlopsquatDetector.js';


describe('SlopsquatDetector', () => {
  const detector = new SlopsquatDetector();

  describe('findTyposquatTarget', () => {
    it('detects 1-character typos of popular packages', () => {
      expect(detector.findTyposquatTarget('lodsh')).toBe('lodash');
      expect(detector.findTyposquatTarget('reactt')).toBe('react');
      expect(detector.findTyposquatTarget('expres')).toBe('express');
      expect(detector.findTyposquatTarget('axois')).toBe('axios');
    });

    it('ignores exact matches of popular packages', () => {
      expect(detector.findTyposquatTarget('react')).toBeNull();
      expect(detector.findTyposquatTarget('lodash')).toBeNull();
    });

    it('ignores legitimate prefixed/suffixed packages', () => {
      expect(detector.findTyposquatTarget('react-dom')).toBeNull();
      expect(detector.findTyposquatTarget('express-validator')).toBeNull();
    });
  });

  describe('matchesHallucinationPattern', () => {
    it('detects extreme compound hallucinated names', () => {
      expect(detector.matchesHallucinationPattern('react-awesome-slider-pro-utils')).toBe(true);
      expect(detector.matchesHallucinationPattern('vue-advanced-data-grid-premium')).toBe(true);
    });

    it('detects generic hallucinated specific formats', () => {
      expect(detector.matchesHallucinationPattern('node-database')).toBe(true);
      expect(detector.matchesHallucinationPattern('ai-api-client')).toBe(true);
    });

    it('passes legitimate non-hallucinated names', () => {
      expect(detector.matchesHallucinationPattern('react-router')).toBe(false);
      expect(detector.matchesHallucinationPattern('lodash-es')).toBe(false);
    });
  });

  describe('calculateShannonEntropy', () => {
    it('flags highly random strings with high entropy', () => {
      // "abcdefghijklmnopqrstuvwxyz" has high entropy (no repeating chars)
      const randomStr = 'abcdefghijklmnopqrstuvwxyz';
      const entropy = detector.calculateShannonEntropy(randomStr);
      expect(entropy).toBeGreaterThan(4.5);
    });

    it('gives lower entropy to normal package names', () => {
      const normalName = 'react-dom';
      const entropy = detector.calculateShannonEntropy(normalName);
      expect(entropy).toBeLessThan(4.0);
    });
  });

  describe('analyze', () => {
    it('returns null for safe packages', async () => {
      const result = await detector.analyze('react');
      expect(result).toBeNull();

      const result2 = await detector.analyze('express-rate-limit');
      expect(result2).toBeNull();
    });

    it('flags typosquatting as an error', async () => {
      const result = await detector.analyze('lodsh');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('Slopsquatting');
      expect(result!.description).toContain('lodash');
    });

    it('flags extreme hallucination patterns as a warning', async () => {
      const result = await detector.analyze('react-super-awesome-carousel-pro');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.description).toContain('AI code hallucination patterns');
    });

    it('considers recency metadata as amplifying factor', async () => {
      const recentMetadata = { 
        name: 'react-advanced-utils', 
        version: '1.0.0', 
        publishDate: new Date() // Just published
      };
      
      const result = await detector.analyze('react-advanced-utils', recentMetadata);
      expect(result).not.toBeNull();
      expect(result!.description).toContain('published very recently');
    });
  });
});
