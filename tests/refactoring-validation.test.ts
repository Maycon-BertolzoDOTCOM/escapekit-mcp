/**
 * Refactoring Validation Tests (Moderate Level)
 * Based on modern research: AST comparison, property-based testing, performance validation
 * 
 * References:
 * - "Revisiting Code Similarity Evaluation with AST Edit Distance" (2024)
 * - "Novel Refactoring and Semantic Aware AST Differencing Tool" (2024)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JavaScriptAnalyzer } from '../src/analyzers/JavaScriptAnalyzer';
import { CodeAnalyzer } from '../src/analyzers/CodeAnalyzer';

describe('Refactoring Validation - Moderate Level', () => {
  let jsAnalyzer: JavaScriptAnalyzer;
  let codeAnalyzer: CodeAnalyzer;

  beforeEach(() => {
    jsAnalyzer = new JavaScriptAnalyzer();
    codeAnalyzer = new CodeAnalyzer();
  });

  describe('Property 1: Parse Result Equivalence', () => {
    const testCases = [
      {
        name: 'ES6 imports',
        code: 'import React from "react";\nimport { useState } from "react";',
        expectedImports: 2,
      },
      {
        name: 'CommonJS requires',
        code: 'const fs = require("fs");\nconst path = require("path");',
        expectedImports: 2,
      },
      {
        name: 'Mock API calls',
        code: 'fetch("https://mockapi.io/api/users");\naxios.get("https://jsonplaceholder.typicode.com/posts");',
        expectedMockApis: 2,
      },
      {
        name: 'WebGL usage',
        code: 'const gl = canvas.getContext("webgl");\nimport * as THREE from "three";',
        expectedWebGL: 2,
      },
      {
        name: 'Mixed code',
        code: `
          import React from "react";
          const axios = require("axios");
          fetch("https://mockapi.io/api/data");
          const gl = canvas.getContext("webgl");
        `,
        expectedImports: 2,
        expectedMockApis: 1,
        expectedWebGL: 1,
      },
    ];

    testCases.forEach(({ name, code, expectedImports, expectedMockApis, expectedWebGL }) => {
      it(`should produce consistent results for ${name}`, () => {
        const result = jsAnalyzer.parse(code);

        if (expectedImports !== undefined) {
          expect(result.imports).toHaveLength(expectedImports);
        }
        if (expectedMockApis !== undefined) {
          expect(result.mockApis).toHaveLength(expectedMockApis);
        }
        if (expectedWebGL !== undefined) {
          expect(result.webglUsages).toHaveLength(expectedWebGL);
        }

        // Validate structure consistency
        result.imports.forEach((imp) => {
          expect(imp).toHaveProperty('type');
          expect(imp).toHaveProperty('source');
          expect(imp).toHaveProperty('line');
          expect(imp).toHaveProperty('column');
        });
      });
    });
  });

  describe('Property 2: Error Handling Equivalence', () => {
    it('should handle empty string consistently', () => {
      const result = jsAnalyzer.parse('');
      expect(result.imports).toHaveLength(0);
      expect(result.mockApis).toHaveLength(0);
      expect(result.webglUsages).toHaveLength(0);
    });

    it('should handle code with no detectable patterns', () => {
      const result = jsAnalyzer.parse('const x = 42;');
      expect(result.imports).toHaveLength(0);
      expect(result.mockApis).toHaveLength(0);
      expect(result.webglUsages).toHaveLength(0);
    });
  });

  describe('Property 3: Performance Validation', () => {
    const largeCode = `
      import React from "react";
      import { useState, useEffect } from "react";
      import axios from "axios";
      const fs = require("fs");
      const path = require("path");
      
      ${'fetch("https://mockapi.io/api/users");\n'.repeat(50)}
      ${'const gl = canvas.getContext("webgl");\n'.repeat(50)}
    `;

    it('should parse large code within acceptable time (<100ms)', () => {
      const start = performance.now();
      const result = jsAnalyzer.parse(largeCode);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result.imports.length).toBeGreaterThan(0);
      expect(result.mockApis.length).toBeGreaterThan(0);
      expect(result.webglUsages.length).toBeGreaterThan(0);
    });
  });

  describe('Property 4: Sandbox Detection Equivalence', () => {
    const sandboxCases = [
      {
        name: 'AI Studio pattern',
        code: 'import { GoogleGenerativeAI } from "@google/generative-ai";',
        expectedSandbox: 'ai-studio',
      },
      {
        name: 'Replit pattern',
        code: 'import Replit from "@replit/database";',
        expectedSandbox: 'replit',
      },
      {
        name: 'No sandbox',
        code: 'import React from "react";',
        expectedSandbox: 'unknown',
      },
    ];

    sandboxCases.forEach(({ name, code, expectedSandbox }) => {
      it(`should detect ${name} consistently`, async () => {
        const result = await codeAnalyzer.analyze(code, { checkNPMRegistry: false });
        expect(result.sandboxType).toBe(expectedSandbox);
      });
    });
  });

  describe('Property 5: Confidence Score Consistency', () => {
    const confidenceCases = [
      {
        name: 'no issues',
        code: 'import React from "react";',
        expectedRange: [0.9, 1.0],
      },
      {
        name: 'mock APIs',
        code: 'fetch("https://mockapi.io/api/users");',
        expectedRange: [0.7, 1.0], // Mock APIs are warnings, not critical
      },
    ];

    confidenceCases.forEach(({ name, code, expectedRange }) => {
      it(`should calculate confidence score for ${name} within expected range`, async () => {
        const result = await codeAnalyzer.analyze(code, { checkNPMRegistry: false });
        expect(result.confidenceScore).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(result.confidenceScore).toBeLessThanOrEqual(expectedRange[1]);
      });
    });

    it('should produce consistent confidence scores for identical code', async () => {
      const code = 'import React from "react";';
      const result1 = await codeAnalyzer.analyze(code, { checkNPMRegistry: false });
      const result2 = await codeAnalyzer.analyze(code, { checkNPMRegistry: false });
      
      expect(result1.confidenceScore).toBe(result2.confidenceScore);
    });
  });

  describe('Property 6: Method Signature Stability', () => {
    it('should maintain JavaScriptAnalyzer public API', () => {
      expect(typeof jsAnalyzer.parse).toBe('function');
      expect(typeof jsAnalyzer.languageName).toBe('function');
      expect(typeof jsAnalyzer.getPackageNames).toBe('function');

      // Validate method signatures
      expect(jsAnalyzer.languageName()).toBe('JavaScript/TypeScript');
      
      const parseResult = jsAnalyzer.parse('import React from "react";');
      expect(parseResult).toHaveProperty('imports');
      expect(parseResult).toHaveProperty('mockApis');
      expect(parseResult).toHaveProperty('webglUsages');

      const packageNames = jsAnalyzer.getPackageNames(parseResult.imports);
      expect(Array.isArray(packageNames)).toBe(true);
    });

    it('should maintain CodeAnalyzer public API', () => {
      expect(typeof codeAnalyzer.analyze).toBe('function');
      expect(typeof codeAnalyzer.clearCache).toBe('function');

      // clearCache should not throw
      expect(() => codeAnalyzer.clearCache()).not.toThrow();
    });
  });

  describe('Property 7: Output Structure Validation', () => {
    it('should produce valid AnalysisResult structure', async () => {
      const code = 'import React from "react";';
      const result = await codeAnalyzer.analyze(code, { checkNPMRegistry: false });

      // Validate required fields
      expect(result).toHaveProperty('analysisId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('sandboxType');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('confidenceScore');

      // Validate types
      expect(typeof result.analysisId).toBe('string');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.sandboxType).toBe('string');
      expect(typeof result.language).toBe('string');
      expect(typeof result.summary).toBe('object');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.confidenceScore).toBe('number');

      // Validate ranges
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });
  });
});
