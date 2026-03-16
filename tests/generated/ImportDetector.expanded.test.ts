import { describe, it, expect } from 'vitest';
import { ImportDetector } from '../../src/detectors/ImportDetector';

describe('ImportDetector (Expanded)', () => {
  describe('detect', () => {
    it('should detect multiple imports', () => {
      const detector = new ImportDetector();
      const code = `
        import express from 'express';
        import lodash from 'lodash';
        import { useState } from 'react';
      `;
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBe(3);
    });

    it('should detect ES6 imports', () => {
      const detector = new ImportDetector();
      const code = "import { useState } from 'react';";
      const result = detector.detect(code);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('es6');
    });

    it('should detect CommonJS requires', () => {
      const detector = new ImportDetector();
      const code = "const express = require('express');";
      const result = detector.detect(code);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('commonjs');
    });

    it('should identify relative imports', () => {
      const detector = new ImportDetector();
      const code = "import { helper } from './utils';";
      const result = detector.detect(code);
      expect(result.length).toBe(1);
      expect(result[0].isRelative).toBe(true);
    });

    it('should handle empty code', () => {
      const detector = new ImportDetector();
      const result = detector.detect('');
      expect(result).toEqual([]);
    });

    it('should handle code without imports', () => {
      const detector = new ImportDetector();
      const code = 'const x = 42;';
      const result = detector.detect(code);
      expect(result).toEqual([]);
    });
  });

  describe('ImportStatement structure', () => {
    it('should include line and column information', () => {
      const detector = new ImportDetector();
      const code = "import express from 'express';";
      const result = detector.detect(code);
      expect(result.length).toBe(1);
      expect(result[0].line).toBeDefined();
      expect(result[0].column).toBeDefined();
      expect(typeof result[0].line).toBe('number');
      expect(typeof result[0].column).toBe('number');
    });

    it('should include source information', () => {
      const detector = new ImportDetector();
      const code = "import express from 'express';";
      const result = detector.detect(code);
      expect(result.length).toBe(1);
      expect(result[0].source).toBe('express');
    });
  });
});
