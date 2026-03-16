/**
 * Recommendation Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RecommendationEngine } from '../../src/recommendations/RecommendationEngine.js';

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;

  beforeEach(() => {
    engine = new RecommendationEngine();
  });

  describe('generate()', () => {
    it('should generate recommendation for framework-mix', async () => {
      const recommendation = await engine.generate({
        problemType: 'framework-mix',
        context: {
          framework: 'vite',
          platform: 'nextjs',
        },
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.id).toBe('framework-mix');
      expect(recommendation.title).toContain('Framework Mixing');
      expect(recommendation.severity).toBe('error');
      expect(recommendation.steps.length).toBeGreaterThan(0);
    });

    it('should generate recommendation for ghost-import', async () => {
      const recommendation = await engine.generate({
        problemType: 'ghost-import',
        context: {
          dependencies: ['analytics-browser'],
        },
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.id).toBe('ghost-import');
      expect(recommendation.title).toContain('Ghost Import');
      expect(recommendation.severity).toBe('error');
      expect(recommendation.steps.length).toBeGreaterThan(0);
    });

    it('should generate recommendation for phantom-dependency', async () => {
      const recommendation = await engine.generate({
        problemType: 'phantom-dependency',
        context: {
          dependencies: ['express'],
        },
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.id).toBe('phantom-dependency');
      expect(recommendation.title).toContain('Phantom Dependency');
      expect(recommendation.severity).toBe('error');
      expect(recommendation.steps.length).toBeGreaterThan(0);
    });

    it('should generate recommendation for mock-api', async () => {
      const recommendation = await engine.generate({
        problemType: 'mock-api',
        context: {},
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.id).toBe('mock-api');
      expect(recommendation.title).toContain('Mock API');
      expect(recommendation.severity).toBe('error');
      expect(recommendation.steps.length).toBeGreaterThan(0);
    });

    it('should generate generic recommendation for unknown problem type', async () => {
      const recommendation = await engine.generate({
        problemType: 'unknown-problem',
        context: {},
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.id).toBe('generic-unknown-problem');
      expect(recommendation.title).toContain('unknown-problem');
      expect(recommendation.steps.length).toBeGreaterThan(0);
    });
  });

  describe('formatAsMarkdown()', () => {
    it('should format recommendation as Markdown', async () => {
      const recommendation = await engine.generate({
        problemType: 'ghost-import',
        context: {},
      });

      const markdown = engine.formatAsMarkdown(recommendation);

      expect(markdown).toContain('🔴');
      expect(markdown).toContain(recommendation.title);
      expect(markdown).toContain('📋 Steps to fix');
      expect(markdown).toContain('🚀 Quick Fix Commands');
      expect(markdown).toContain('📚 References');
    });

    it('should include severity icon', async () => {
      const recommendation = await engine.generate({
        problemType: 'ghost-import',
        context: {},
      });

      const markdown = engine.formatAsMarkdown(recommendation);
      expect(markdown).toContain('🔴'); // Error severity
    });
  });

  describe('getQuickFixCommands()', () => {
    it('should return quick fix commands', async () => {
      const recommendation = await engine.generate({
        problemType: 'phantom-dependency',
        context: {},
      });

      const commands = engine.getQuickFixCommands(recommendation);

      expect(commands).toBeDefined();
      expect(commands.length).toBeGreaterThan(0);
      expect(commands[0]).toContain('npm install');
    });

    it('should return empty array if no commands', async () => {
      const recommendation = await engine.generate({
        problemType: 'unknown-problem',
        context: {},
      });

      const commands = engine.getQuickFixCommands(recommendation);

      expect(commands).toBeDefined();
      expect(commands.length).toBe(0);
    });
  });

  describe('hasTemplate()', () => {
    it('should return true for known problem types', () => {
      expect(engine.hasTemplate('framework-mix')).toBe(true);
      expect(engine.hasTemplate('ghost-import')).toBe(true);
      expect(engine.hasTemplate('phantom-dependency')).toBe(true);
      expect(engine.hasTemplate('mock-api')).toBe(true);
    });

    it('should return false for unknown problem types', () => {
      expect(engine.hasTemplate('unknown-problem')).toBe(false);
      expect(engine.hasTemplate('non-existent')).toBe(false);
    });
  });

  describe('getLoadedTemplateIds()', () => {
    it('should return list of loaded template IDs', () => {
      const ids = engine.getLoadedTemplateIds();

      expect(ids).toBeDefined();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain('framework-mix');
      expect(ids).toContain('ghost-import');
      expect(ids).toContain('phantom-dependency');
      expect(ids).toContain('mock-api');
    });
  });
});