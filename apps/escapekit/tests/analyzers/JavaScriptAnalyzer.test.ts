/**
 * Tests for JavaScriptAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JavaScriptAnalyzer } from '../../src/analyzers/JavaScriptAnalyzer.js';
import { ParseError } from '../../src/errors.js';

describe('JavaScriptAnalyzer', () => {
  let analyzer: JavaScriptAnalyzer;

  beforeEach(() => {
    analyzer = new JavaScriptAnalyzer();
  });

  describe('parse()', () => {
    it('should parse valid JavaScript code with imports', () => {
      const code = 'import React from "react";';
      const result = analyzer.parse(code);
      
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].source).toBe('react');
      expect(result.mockApis).toHaveLength(0);
      expect(result.webglUsages).toHaveLength(0);
    });

    it('should parse code with mock API calls', () => {
      const code = 'fetch("https://mockapi.io/api/users")';
      const result = analyzer.parse(code);
      
      expect(result.mockApis).toHaveLength(1);
      expect(result.mockApis[0].endpoint).toContain('mockapi.io');
    });

    it('should parse code with WebGL usage', () => {
      const code = 'const gl = canvas.getContext("webgl");';
      const result = analyzer.parse(code);
      
      expect(result.webglUsages.length).toBeGreaterThan(0);
    });

    it('should handle empty code', () => {
      const code = '';
      const result = analyzer.parse(code);
      
      expect(result.imports).toHaveLength(0);
      expect(result.mockApis).toHaveLength(0);
      expect(result.webglUsages).toHaveLength(0);
    });

    it('should include error context when ParseError is thrown', () => {
      // Mock the importDetector to throw an error
      const mockError = new Error('Detector failed');
      analyzer['importDetector'].detect = () => {
        throw mockError;
      };
      
      try {
        analyzer.parse('some code');
        expect.fail('Should have thrown ParseError');
      } catch (error) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).message).toBe('Failed to parse JavaScript code');
        expect((error as ParseError).context).toBeDefined();
        expect((error as ParseError).context?.operation).toBe('parse');
        expect((error as ParseError).context?.error).toBe('Detector failed');
        expect((error as ParseError).context?.codeLength).toBe(9);
      }
    });
  });

  describe('getPackageNames()', () => {
    it('should extract package names from imports', () => {
      const code = 'import React from "react";\nimport { useState } from "react";';
      const result = analyzer.parse(code);
      const packageNames = analyzer.getPackageNames(result.imports);
      
      expect(packageNames).toContain('react');
    });

    it('should handle scoped packages', () => {
      const code = 'import { Button } from "@mui/material";';
      const result = analyzer.parse(code);
      const packageNames = analyzer.getPackageNames(result.imports);
      
      expect(packageNames).toContain('@mui/material');
    });
  });

  describe('languageName()', () => {
    it('should return correct language name', () => {
      expect(analyzer.languageName()).toBe('JavaScript/TypeScript');
    });
  });
});
