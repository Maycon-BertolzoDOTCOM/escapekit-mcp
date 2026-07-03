/**
 * ImportDetector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImportDetector, createImportDetector } from '../../src/detectors/ImportDetector.js';

describe('ImportDetector', () => {
  let detector: ImportDetector;

  beforeEach(() => {
    detector = createImportDetector();
  });

  describe('detect', () => {
    it('should detect ES6 named imports', () => {
      const code = "import { useState, useEffect } from 'react';";
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('es6');
      expect(results[0].source).toBe('react');
      expect(results[0].isRelative).toBe(false);
    });

    it('should detect ES6 default imports', () => {
      const code = "import React from 'react';";
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('es6');
      expect(results[0].source).toBe('react');
    });

    it('should detect ES6 wildcard imports', () => {
      const code = "import * as THREE from 'three';";
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('es6');
      expect(results[0].source).toBe('three');
    });

    it('should detect ES6 imports without from clause', () => {
      const code = "import './styles.css';";
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('es6');
      expect(results[0].source).toBe('./styles.css');
      expect(results[0].isRelative).toBe(true);
    });

    it('should detect CommonJS requires', () => {
      const code = "const fs = require('fs');";
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('commonjs');
      expect(results[0].source).toBe('fs');
      expect(results[0].isRelative).toBe(false);
    });

    it('should detect relative imports', () => {
      const code = `
        import { utils } from './utils';
        import { helpers } from '../helpers';
        import { config } from '/config';
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r.isRelative).toBe(true);
      });
    });

    it('should detect scoped packages', () => {
      const code = "import { create } from '@google/generative-ai';";
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('@google/generative-ai');
      expect(results[0].isRelative).toBe(false);
    });

    it('should detect multiple imports', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        import * as THREE from 'three';
        const fs = require('fs');
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(4);
    });

    it('should capture line and column positions', () => {
      const code = `
import React from 'react';
`;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].line).toBe(2);
      expect(results[0].column).toBeGreaterThan(0);
    });
  });

  describe('getPackageNames', () => {
    it('should extract package names from imports', () => {
      const imports = [
        { type: 'es6' as const, source: 'react', line: 1, column: 1, isRelative: false },
        { type: 'es6' as const, source: 'three', line: 2, column: 1, isRelative: false },
        { type: 'es6' as const, source: './utils', line: 3, column: 1, isRelative: true },
      ];
      
      const packages = detector.getPackageNames(imports);
      
      expect(packages).toHaveLength(2);
      expect(packages).toContain('react');
      expect(packages).toContain('three');
      expect(packages).not.toContain('./utils');
    });

    it('should handle scoped packages', () => {
      const imports = [
        { type: 'es6' as const, source: '@google/generative-ai', line: 1, column: 1, isRelative: false },
      ];
      
      const packages = detector.getPackageNames(imports);
      
      expect(packages).toHaveLength(1);
      expect(packages[0]).toBe('@google/generative-ai');
    });

    it('should extract main package from scoped package with subpath', () => {
      const imports = [
        { type: 'es6' as const, source: '@google/generative-ai/model', line: 1, column: 1, isRelative: false },
      ];
      
      const packages = detector.getPackageNames(imports);
      
      expect(packages).toHaveLength(1);
      expect(packages[0]).toBe('@google/generative-ai');
    });

    it('should return unique package names', () => {
      const imports = [
        { type: 'es6' as const, source: 'react', line: 1, column: 1, isRelative: false },
        { type: 'es6' as const, source: 'react', line: 2, column: 1, isRelative: false },
        { type: 'es6' as const, source: 'react', line: 3, column: 1, isRelative: false },
      ];
      
      const packages = detector.getPackageNames(imports);
      
      expect(packages).toHaveLength(1);
      expect(packages[0]).toBe('react');
    });

    it('should return empty array when no imports', () => {
      const packages = detector.getPackageNames([]);
      
      expect(packages).toHaveLength(0);
    });
  });

  describe('getImportsByType', () => {
    it('should filter ES6 imports', () => {
      const imports = [
        { type: 'es6' as const, source: 'react', line: 1, column: 1, isRelative: false },
        { type: 'es6' as const, source: 'three', line: 2, column: 1, isRelative: false },
        { type: 'commonjs' as const, source: 'fs', line: 3, column: 1, isRelative: false },
      ];
      
      const es6Imports = detector.getImportsByType(imports, 'es6');
      const commonjsImports = detector.getImportsByType(imports, 'commonjs');
      
      expect(es6Imports).toHaveLength(2);
      expect(commonjsImports).toHaveLength(1);
    });
  });

  describe('getRelativeImports', () => {
    it('should filter relative imports', () => {
      const imports = [
        { type: 'es6' as const, source: 'react', line: 1, column: 1, isRelative: false },
        { type: 'es6' as const, source: './utils', line: 2, column: 1, isRelative: true },
        { type: 'es6' as const, source: '../helpers', line: 3, column: 1, isRelative: true },
      ];
      
      const relativeImports = detector.getRelativeImports(imports);
      
      expect(relativeImports).toHaveLength(2);
    });
  });

  describe('getExternalImports', () => {
    it('should filter external imports', () => {
      const imports = [
        { type: 'es6' as const, source: 'react', line: 1, column: 1, isRelative: false },
        { type: 'es6' as const, source: './utils', line: 2, column: 1, isRelative: true },
        { type: 'es6' as const, source: '../helpers', line: 3, column: 1, isRelative: true },
      ];
      
      const externalImports = detector.getExternalImports(imports);
      
      expect(externalImports).toHaveLength(1);
      expect(externalImports[0].source).toBe('react');
    });
  });

  describe('isRelativeImport', () => {
    it('should identify relative imports starting with ./', () => {
      expect(detector.isRelativeImport('./utils')).toBe(true);
    });

    it('should identify relative imports starting with ../', () => {
      expect(detector.isRelativeImport('../helpers')).toBe(true);
    });

    it('should identify absolute imports starting with /', () => {
      expect(detector.isRelativeImport('/config')).toBe(true);
    });

    it('should identify external imports', () => {
      expect(detector.isRelativeImport('react')).toBe(false);
      expect(detector.isRelativeImport('three')).toBe(false);
      expect(detector.isRelativeImport('@google/generative-ai')).toBe(false);
    });
  });

  describe('extractPackageName', () => {
    it('should extract package name from simple import', () => {
      expect(detector.extractPackageName('react')).toBe('react');
    });

    it('should extract package name with subpath', () => {
      expect(detector.extractPackageName('react-dom/client')).toBe('react-dom');
    });

    it('should extract scoped package name', () => {
      expect(detector.extractPackageName('@google/generative-ai')).toBe('@google/generative-ai');
    });

    it('should extract scoped package with subpath', () => {
      expect(detector.extractPackageName('@google/generative-ai/model')).toBe('@google/generative-ai');
    });

    it('should handle multiple slashes', () => {
      expect(detector.extractPackageName('@package/sub1/sub2')).toBe('@package/sub1');
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      const imports = [
        { type: 'es6' as const, source: 'react', line: 1, column: 1, isRelative: false },
        { type: 'es6' as const, source: 'three', line: 2, column: 1, isRelative: false },
        { type: 'es6' as const, source: './utils', line: 3, column: 1, isRelative: true },
        { type: 'commonjs' as const, source: 'fs', line: 4, column: 1, isRelative: false },
      ];
      
      const stats = detector.getStatistics(imports);
      
      expect(stats.total).toBe(4);
      expect(stats.es6).toBe(3);
      expect(stats.commonjs).toBe(1);
      expect(stats.relative).toBe(1);
      expect(stats.external).toBe(3);
      expect(stats.packages).toBe(3); // react, three, and fs
    });

    it('should handle empty imports', () => {
      const stats = detector.getStatistics([]);
      
      expect(stats.total).toBe(0);
      expect(stats.es6).toBe(0);
      expect(stats.commonjs).toBe(0);
      expect(stats.relative).toBe(0);
      expect(stats.external).toBe(0);
      expect(stats.packages).toBe(0);
    });
  });

  describe('addPattern', () => {
    it('should add custom pattern', () => {
      const customPattern = {
        pattern: /import\s+[\w\s]+from\s+['"]([^'"]+)['"]/g,
        type: 'es6' as const,
      };
      
      detector.addPattern(customPattern);
      
      const code = "import React from 'react';";
      const results = detector.detect(code);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('clearPatterns', () => {
    it('should clear all patterns', () => {
      const code = "import React from 'react';";
      
      // First, verify detection works
      const beforeClear = detector.detect(code);
      expect(beforeClear.length).toBeGreaterThan(0);
      
      // Clear patterns
      detector.clearPatterns();
      
      // Now it should not detect anything
      const afterClear = detector.detect(code);
      expect(afterClear.length).toBe(0);
    });
  });

  describe('getPatterns', () => {
    it('should return all patterns', () => {
      const patterns = detector.getPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach(p => {
        expect(p).toHaveProperty('pattern');
        expect(p).toHaveProperty('type');
        expect(p.pattern).toBeInstanceOf(RegExp);
        expect(typeof p.type).toBe('string');
      });
    });
  });
});