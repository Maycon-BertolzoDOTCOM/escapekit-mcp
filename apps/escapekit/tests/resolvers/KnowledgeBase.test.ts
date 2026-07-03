/**
 * Tests for KnowledgeBase class
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase.js';
import { MappingStrategy } from '../../src/models/transformation.js';

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;
  const testFilePath = './test-knowledge-base.json';

  beforeEach(() => {
    kb = new KnowledgeBase();
  });

  afterEach(async () => {
    // Clean up test file if it exists
    try {
      await fs.unlink(testFilePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('getMapping', () => {
    it('should return null for non-existent ghost package', () => {
      const result = kb.getMapping('non-existent-package');
      expect(result).toBeNull();
    });

    it('should return mapping for existing ghost package', () => {
      kb.addMapping({
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.95,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      const result = kb.getMapping('fake-api');
      expect(result).not.toBeNull();
      expect(result?.ghostPackage).toBe('fake-api');
      expect(result?.realPackages).toEqual(['axios']);
      expect(result?.confidence).toBe(0.95);
    });
  });

  describe('addMapping', () => {
    it('should add a new mapping', () => {
      kb.addMapping({
        ghostPackage: 'test-package',
        realPackages: ['real-package'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      expect(kb.size()).toBe(1);
      const mapping = kb.getMapping('test-package');
      expect(mapping).not.toBeNull();
      expect(mapping?.realPackages).toEqual(['real-package']);
    });

    it('should overwrite existing mapping with same ghost package', () => {
      kb.addMapping({
        ghostPackage: 'test-package',
        realPackages: ['package-v1'],
        confidence: 0.8,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      kb.addMapping({
        ghostPackage: 'test-package',
        realPackages: ['package-v2'],
        confidence: 0.9,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      expect(kb.size()).toBe(1);
      const mapping = kb.getMapping('test-package');
      expect(mapping?.realPackages).toEqual(['package-v2']);
      expect(mapping?.confidence).toBe(0.9);
    });
  });

  describe('loadFromFile', () => {
    it('should load mappings from valid JSON file', async () => {
      const testData = {
        mappings: {
          'three.js': {
            realPackage: 'three',
            confidence: 1.0,
            additionalPackages: ['@types/three'],
            reason: 'Three.js 3D library'
          },
          'fake-api': {
            realPackage: 'axios',
            confidence: 0.95
          }
        }
      };

      await fs.writeFile(testFilePath, JSON.stringify(testData), 'utf-8');
      await kb.loadFromFile(testFilePath);

      expect(kb.size()).toBe(2);

      const threeMapping = kb.getMapping('three.js');
      expect(threeMapping).not.toBeNull();
      expect(threeMapping?.realPackages).toEqual(['three', '@types/three']);
      expect(threeMapping?.confidence).toBe(1.0);

      const fakeApiMapping = kb.getMapping('fake-api');
      expect(fakeApiMapping).not.toBeNull();
      expect(fakeApiMapping?.realPackages).toEqual(['axios']);
      expect(fakeApiMapping?.confidence).toBe(0.95);
    });

    it('should throw error for invalid JSON', async () => {
      await fs.writeFile(testFilePath, 'invalid json', 'utf-8');
      await expect(kb.loadFromFile(testFilePath)).rejects.toThrow();
    });

    it('should throw error for missing mappings field', async () => {
      await fs.writeFile(testFilePath, JSON.stringify({ data: {} }), 'utf-8');
      await expect(kb.loadFromFile(testFilePath)).rejects.toThrow('Invalid knowledge base format');
    });

    it('should throw error for non-existent file', async () => {
      await expect(kb.loadFromFile('./non-existent-file.json')).rejects.toThrow();
    });
  });

  describe('exportToFile', () => {
    it('should export mappings to JSON file', async () => {
      kb.addMapping({
        ghostPackage: 'test-package',
        realPackages: ['real-package', 'alternative-package'],
        confidence: 0.9,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
        metadata: {
          reason: 'Test mapping'
        }
      });

      await kb.exportToFile(testFilePath);

      const content = await fs.readFile(testFilePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.mappings).toBeDefined();
      expect(data.mappings['test-package']).toBeDefined();
      expect(data.mappings['test-package'].realPackage).toBe('real-package');
      expect(data.mappings['test-package'].additionalPackages).toEqual(['alternative-package']);
      expect(data.mappings['test-package'].confidence).toBe(0.9);
      expect(data.mappings['test-package'].reason).toBe('Test mapping');
    });

    it('should export empty knowledge base', async () => {
      await kb.exportToFile(testFilePath);

      const content = await fs.readFile(testFilePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.mappings).toBeDefined();
      expect(Object.keys(data.mappings)).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty knowledge base', () => {
      expect(kb.size()).toBe(0);
    });

    it('should return correct count after adding mappings', () => {
      kb.addMapping({
        ghostPackage: 'package1',
        realPackages: ['real1'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      kb.addMapping({
        ghostPackage: 'package2',
        realPackages: ['real2'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      expect(kb.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all mappings', () => {
      kb.addMapping({
        ghostPackage: 'package1',
        realPackages: ['real1'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      kb.addMapping({
        ghostPackage: 'package2',
        realPackages: ['real2'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      expect(kb.size()).toBe(2);

      kb.clear();

      expect(kb.size()).toBe(0);
      expect(kb.getMapping('package1')).toBeNull();
      expect(kb.getMapping('package2')).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('should preserve data through export and load', async () => {
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three', '@types/three'],
        confidence: 1.0,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
        metadata: {
          reason: 'Three.js 3D library'
        }
      });

      kb.addMapping({
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.95,
        mappingStrategy: MappingStrategy.EXACT_MATCH
      });

      await kb.exportToFile(testFilePath);

      const kb2 = new KnowledgeBase();
      await kb2.loadFromFile(testFilePath);

      expect(kb2.size()).toBe(2);

      const threeMapping = kb2.getMapping('three.js');
      expect(threeMapping?.realPackages).toEqual(['three', '@types/three']);
      expect(threeMapping?.confidence).toBe(1.0);

      const fakeApiMapping = kb2.getMapping('fake-api');
      expect(fakeApiMapping?.realPackages).toEqual(['axios']);
      expect(fakeApiMapping?.confidence).toBe(0.95);
    });
  });
});
