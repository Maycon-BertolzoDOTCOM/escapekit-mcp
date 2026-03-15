/**
 * Integration tests for KnowledgeBase with actual knowledge-base.json
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase.js';
import { MappingStrategy } from '../../src/models/transformation.js';

describe('KnowledgeBase Integration', () => {
  let kb: KnowledgeBase;

  beforeEach(async () => {
    kb = new KnowledgeBase();
    await kb.loadFromFile('knowledge-base.json');
  });

  it('should load at least 10 mappings from knowledge-base.json', () => {
    expect(kb.size()).toBeGreaterThanOrEqual(10);
  });

  it('should have mapping for three.js', () => {
    const mapping = kb.getMapping('three.js');
    expect(mapping).not.toBeNull();
    expect(mapping?.ghostPackage).toBe('three.js');
    expect(mapping?.realPackages).toContain('three');
    expect(mapping?.realPackages).toContain('@types/three');
    expect(mapping?.confidence).toBe(1.0);
    expect(mapping?.mappingStrategy).toBe(MappingStrategy.EXACT_MATCH);
  });

  it('should have mapping for mockapi.io', () => {
    const mapping = kb.getMapping('mockapi.io');
    expect(mapping).not.toBeNull();
    expect(mapping?.ghostPackage).toBe('mockapi.io');
    expect(mapping?.realPackages).toContain('axios');
    expect(mapping?.confidence).toBe(0.9);
  });

  it('should have mapping for fake-api-client', () => {
    const mapping = kb.getMapping('fake-api-client');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('axios');
    expect(mapping?.confidence).toBe(0.95);
  });

  it('should have mapping for mock-database', () => {
    const mapping = kb.getMapping('mock-database');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('better-sqlite3');
  });

  it('should have mapping for sandbox-canvas', () => {
    const mapping = kb.getMapping('sandbox-canvas');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('canvas');
  });

  it('should have mapping for test-utils', () => {
    const mapping = kb.getMapping('test-utils');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('@testing-library/react');
  });

  it('should have mapping for fake-fetch', () => {
    const mapping = kb.getMapping('fake-fetch');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('node-fetch');
  });

  it('should have mapping for mock-websocket', () => {
    const mapping = kb.getMapping('mock-websocket');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('ws');
  });

  it('should have mapping for sandbox-crypto', () => {
    const mapping = kb.getMapping('sandbox-crypto');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('crypto-js');
  });

  it('should have mapping for fake-storage', () => {
    const mapping = kb.getMapping('fake-storage');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('node-localstorage');
  });

  it('should have mapping for mock-auth', () => {
    const mapping = kb.getMapping('mock-auth');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('jsonwebtoken');
  });

  it('should have mapping for sandbox-dom', () => {
    const mapping = kb.getMapping('sandbox-dom');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('jsdom');
  });

  it('should have mapping for fake-router', () => {
    const mapping = kb.getMapping('fake-router');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('express');
  });

  it('should have mapping for mock-logger', () => {
    const mapping = kb.getMapping('mock-logger');
    expect(mapping).not.toBeNull();
    expect(mapping?.realPackages).toContain('winston');
  });

  it('all mappings should have confidence between 0.0 and 1.0', () => {
    // This test verifies a key property from the spec
    const testPackages = [
      'three.js',
      'mockapi.io',
      'fake-api-client',
      'mock-database',
      'sandbox-canvas',
      'test-utils',
      'fake-fetch',
      'mock-websocket',
      'sandbox-crypto',
      'fake-storage',
      'mock-auth',
      'sandbox-dom',
      'fake-router',
      'mock-logger'
    ];

    for (const pkg of testPackages) {
      const mapping = kb.getMapping(pkg);
      expect(mapping).not.toBeNull();
      expect(mapping!.confidence).toBeGreaterThanOrEqual(0.0);
      expect(mapping!.confidence).toBeLessThanOrEqual(1.0);
    }
  });

  it('all mappings should have at least one real package', () => {
    const testPackages = [
      'three.js',
      'mockapi.io',
      'fake-api-client',
      'mock-database',
      'sandbox-canvas',
      'test-utils',
      'fake-fetch',
      'mock-websocket',
      'sandbox-crypto',
      'fake-storage',
      'mock-auth',
      'sandbox-dom',
      'fake-router',
      'mock-logger'
    ];

    for (const pkg of testPackages) {
      const mapping = kb.getMapping(pkg);
      expect(mapping).not.toBeNull();
      expect(mapping!.realPackages.length).toBeGreaterThan(0);
    }
  });
});
