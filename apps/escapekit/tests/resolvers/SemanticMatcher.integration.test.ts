/**
 * Integration tests for SemanticMatcher with real NPMRegistry
 * 
 * These tests use the actual NPMRegistry service to verify
 * semantic matching works with real package data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticMatcher } from '../../src/resolvers/SemanticMatcher.js';
import { NPMRegistry } from '../../src/services/NPMRegistry.js';
import { MappingStrategy } from '../../src/models/transformation.js';

describe('SemanticMatcher Integration', () => {
  let matcher: SemanticMatcher;
  let npmRegistry: NPMRegistry;

  beforeEach(() => {
    npmRegistry = new NPMRegistry({
      enableCache: true,
      enableRetry: true,
      maxRetries: 2,
      retryDelay: 100
    });
    matcher = new SemanticMatcher(npmRegistry);
  });

  it('should find "three" as alternative for "three-js"', async () => {
    const results = await matcher.findSimilar('three-js', {
      minSimilarity: 0.5,
      maxResults: 5
    });

    expect(results.length).toBeGreaterThan(0);
    
    // Should find 'three' as a candidate
    const hasThree = results.some(r => r.realPackages.includes('three'));
    expect(hasThree).toBe(true);

    // All results should have proper structure
    for (const result of results) {
      expect(result.ghostPackage).toBe('three-js');
      expect(result.mappingStrategy).toBe(MappingStrategy.SEMANTIC_MATCH);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(result.realPackages.length).toBeGreaterThan(0);
    }
  }, 10000); // 10 second timeout for network requests

  it('should find "axios" as alternative for "axios-client"', async () => {
    const results = await matcher.findSimilar('axios-client', {
      minSimilarity: 0.5,
      maxResults: 5
    });

    expect(results.length).toBeGreaterThan(0);
    
    // Should find 'axios' as a candidate
    const hasAxios = results.some(r => r.realPackages.includes('axios'));
    expect(hasAxios).toBe(true);
  }, 10000);

  it('should respect minimum similarity threshold', async () => {
    const results = await matcher.findSimilar('completely-nonexistent-package-xyz', {
      minSimilarity: 0.9, // Very high threshold
      maxResults: 5
    });

    // Should return empty or very few results
    expect(results.length).toBeLessThanOrEqual(1);
  }, 10000);

  it('should limit results to maxResults', async () => {
    const results = await matcher.findSimilar('react', {
      minSimilarity: 0.3,
      maxResults: 3
    });

    expect(results.length).toBeLessThanOrEqual(3);
  }, 10000);

  it('should rank results by confidence (descending)', async () => {
    const results = await matcher.findSimilar('lodash-utils', {
      minSimilarity: 0.3,
      maxResults: 5
    });

    // Verify descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  }, 10000);

  it('should cache package metadata for performance', async () => {
    const startTime = Date.now();
    
    // First call - will fetch from NPM
    await matcher.analyzePackage('axios');
    const firstCallTime = Date.now() - startTime;

    const cacheStartTime = Date.now();
    
    // Second call - should use cache
    await matcher.analyzePackage('axios');
    const secondCallTime = Date.now() - cacheStartTime;

    // Second call should be significantly faster (cached)
    expect(secondCallTime).toBeLessThan(firstCallTime);
  }, 10000);

  it('should handle non-existent packages gracefully', async () => {
    const results = await matcher.findSimilar('this-package-definitely-does-not-exist-xyz-123', {
      minSimilarity: 0.7,
      maxResults: 5
    });

    // Should return empty array without throwing
    expect(results).toEqual([]);
  }, 10000);

  it('should calculate similarity with real package metadata', async () => {
    const metadata = await matcher.analyzePackage('axios');

    expect(metadata.name).toBe('axios');
    expect(metadata.version).toBeDefined();
    expect(metadata.keywords).toBeDefined();
    expect(metadata.deprecated).toBe(false);

    const similarity = matcher.calculateSimilarity('axios-client', 'axios', metadata);
    
    expect(similarity).toBeGreaterThan(0.5);
    expect(similarity).toBeLessThanOrEqual(1.0);
  }, 10000);
});
