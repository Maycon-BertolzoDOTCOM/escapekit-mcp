import { describe, it, expect } from 'vitest';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase';
import { MappingStrategy } from '../../src/models/transformation.js';

describe('KnowledgeBase (Final Tests)', () => {
  describe('mapping management', () => {
    it('should retrieve exact matches from knowledge base', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
      });

      const mapping = kb.getMapping('three.js');
      expect(mapping).toBeDefined();
      expect(mapping?.realPackages).toEqual(['three']);
    });

    it('should return null for unknown packages', () => {
      const kb = new KnowledgeBase();
      const mapping = kb.getMapping('unknown-ghost-package');
      expect(mapping).toBeNull();
    });

    it('should add multiple mappings to knowledge base', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
      });
      kb.addMapping({
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.95,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
      });

      expect(kb.size()).toBe(2);
      expect(kb.getMapping('three.js')).toBeDefined();
      expect(kb.getMapping('fake-api')).toBeDefined();
    });

    it('should handle multiple real packages in mapping', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'react-router',
        realPackages: ['react-router-dom', 'react-router-native'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
      });

      const mapping = kb.getMapping('react-router');
      expect(mapping?.realPackages).toEqual(['react-router-dom', 'react-router-native']);
    });
  });

  describe('knowledge base size and clear', () => {
    it('should return correct size', () => {
      const kb = new KnowledgeBase();
      expect(kb.size()).toBe(0);

      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
      });

      expect(kb.size()).toBe(1);
    });

    it('should clear all mappings', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
      });
      kb.addMapping({
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.95,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
      });

      expect(kb.size()).toBe(2);

      kb.clear();
      expect(kb.size()).toBe(0);
      expect(kb.getMapping('three.js')).toBeNull();
    });
  });

  describe('metadata handling', () => {
    it('should store metadata in mapping', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 0.95,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
        metadata: {
          reason: 'Common 3D library',
          source: 'manual-entry',
        },
      });

      const mapping = kb.getMapping('three.js');
      expect(mapping?.metadata?.reason).toBe('Common 3D library');
      expect(mapping?.metadata?.source).toBe('manual-entry');
    });

    it('should handle mappings without metadata', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
      });

      const mapping = kb.getMapping('three.js');
      expect(mapping).toBeDefined();
      expect(mapping?.metadata).toBeUndefined();
    });
  });
});