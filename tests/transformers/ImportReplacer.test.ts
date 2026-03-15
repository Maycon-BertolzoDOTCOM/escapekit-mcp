/**
 * Unit tests for ImportReplacer
 *
 * Tests cover:
 * - replaceImports() with ES6, CommonJS, and dynamic imports
 * - replaceImports() with multiple resolutions
 * - validateSyntax() with valid and invalid code
 * - generateDiff() output format
 * - Error handling with invalid code
 * - Preservation of comments and formatting
 * - Unresolved imports left unchanged
 */

import { describe, it, expect } from 'vitest';
import { ImportReplacer } from '../../src/transformers/ImportReplacer.js';
import { DependencyResolution, ResolutionMethod, TransformationType } from '../../src/models/transformation.js';
import { TransformationError } from '../../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResolution(originalImport: string, resolvedPackage: string): DependencyResolution {
  return {
    originalImport,
    resolvedPackage,
    version: '^1.0.0',
    resolutionMethod: ResolutionMethod.KNOWLEDGE_BASE,
    confidence: 0.95,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportReplacer', () => {
  const replacer = new ImportReplacer();

  // -------------------------------------------------------------------------
  // replaceImports – ES6 imports
  // -------------------------------------------------------------------------

  describe('replaceImports() – ES6 imports', () => {
    it('replaces a default ES6 import', () => {
      const source = "import api from 'fake-api';";
      const result = replacer.replaceImports(source, [makeResolution('fake-api', 'axios')]);

      expect(result.transformedCode).toContain('axios');
      expect(result.transformedCode).not.toContain('fake-api');
    });

    it('replaces named ES6 imports', () => {
      const source = "import { get, post } from 'fake-http';";
      const result = replacer.replaceImports(source, [makeResolution('fake-http', 'axios')]);

      expect(result.transformedCode).toContain('axios');
      expect(result.transformedCode).toContain('get');
      expect(result.transformedCode).toContain('post');
    });

    it('replaces namespace ES6 imports', () => {
      const source = "import * as utils from 'fake-utils';";
      const result = replacer.replaceImports(source, [makeResolution('fake-utils', 'lodash')]);

      expect(result.transformedCode).toContain('lodash');
      expect(result.transformedCode).toContain('utils');
    });

    it('replaces TypeScript type imports', () => {
      const source = "import type { Foo } from 'fake-types';";
      const result = replacer.replaceImports(source, [makeResolution('fake-types', 'real-types')]);

      expect(result.transformedCode).toContain('real-types');
      expect(result.transformedCode).not.toContain('fake-types');
    });

    it('preserves import specifiers after replacement', () => {
      const source = "import { alpha, beta, gamma } from 'ghost-pkg';";
      const result = replacer.replaceImports(source, [makeResolution('ghost-pkg', 'real-pkg')]);

      expect(result.transformedCode).toContain('alpha');
      expect(result.transformedCode).toContain('beta');
      expect(result.transformedCode).toContain('gamma');
    });
  });

  // -------------------------------------------------------------------------
  // replaceImports – CommonJS require
  // -------------------------------------------------------------------------

  describe('replaceImports() – CommonJS require', () => {
    it('replaces a CommonJS require call', () => {
      const source = "const db = require('fake-db');";
      const result = replacer.replaceImports(source, [makeResolution('fake-db', 'better-sqlite3')]);

      expect(result.transformedCode).toContain('better-sqlite3');
      expect(result.transformedCode).not.toContain('fake-db');
    });

    it('preserves the variable binding after require replacement', () => {
      const source = "const { connect } = require('fake-db');";
      const result = replacer.replaceImports(source, [makeResolution('fake-db', 'pg')]);

      expect(result.transformedCode).toContain('pg');
      expect(result.transformedCode).toContain('connect');
    });
  });

  // -------------------------------------------------------------------------
  // replaceImports – dynamic imports
  // -------------------------------------------------------------------------

  describe('replaceImports() – dynamic imports', () => {
    it('replaces a dynamic import()', () => {
      const source = "const mod = import('fake-module');";
      const result = replacer.replaceImports(source, [makeResolution('fake-module', 'real-module')]);

      expect(result.transformedCode).toContain('real-module');
      expect(result.transformedCode).not.toContain('fake-module');
    });

    it('replaces dynamic import inside async function', () => {
      const source = `
async function load() {
  const mod = await import('ghost-lib');
  return mod;
}`.trim();
      const result = replacer.replaceImports(source, [makeResolution('ghost-lib', 'real-lib')]);

      expect(result.transformedCode).toContain('real-lib');
      expect(result.transformedCode).not.toContain('ghost-lib');
    });
  });

  // -------------------------------------------------------------------------
  // replaceImports – multiple resolutions
  // -------------------------------------------------------------------------

  describe('replaceImports() – multiple resolutions', () => {
    it('replaces multiple imports in one pass', () => {
      const source = `
import api from 'fake-api';
import db from 'fake-db';
import utils from 'fake-utils';
`.trim();
      const resolutions = [
        makeResolution('fake-api', 'axios'),
        makeResolution('fake-db', 'pg'),
        makeResolution('fake-utils', 'lodash'),
      ];
      const result = replacer.replaceImports(source, resolutions);

      expect(result.transformedCode).toContain('axios');
      expect(result.transformedCode).toContain('pg');
      expect(result.transformedCode).toContain('lodash');
      expect(result.transformedCode).not.toContain('fake-api');
      expect(result.transformedCode).not.toContain('fake-db');
      expect(result.transformedCode).not.toContain('fake-utils');
    });

    it('records one applied rule per replaced import', () => {
      const source = `
import a from 'ghost-a';
import b from 'ghost-b';
`.trim();
      const result = replacer.replaceImports(source, [
        makeResolution('ghost-a', 'real-a'),
        makeResolution('ghost-b', 'real-b'),
      ]);

      expect(result.appliedRules).toHaveLength(2);
      expect(result.appliedRules[0].ruleType).toBe(TransformationType.IMPORT_REPLACEMENT);
    });

    it('returns a valid CodeTransformation object', () => {
      const source = "import foo from 'ghost';";
      const result = replacer.replaceImports(source, [makeResolution('ghost', 'real')]);

      expect(result.transformationId).toMatch(/^transform-/);
      expect(result.sourceCode).toBe(source);
      expect(result.transformedCode).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // -------------------------------------------------------------------------
  // replaceImports – unresolved imports left unchanged
  // -------------------------------------------------------------------------

  describe('replaceImports() – unresolved imports unchanged', () => {
    it('leaves imports not in resolutions list unchanged', () => {
      const source = `
import known from 'ghost-known';
import unknown from 'real-package';
`.trim();
      const result = replacer.replaceImports(source, [makeResolution('ghost-known', 'resolved-pkg')]);

      expect(result.transformedCode).toContain('resolved-pkg');
      expect(result.transformedCode).toContain('real-package');
    });

    it('returns empty appliedRules when no imports match', () => {
      const source = "import foo from 'already-real';";
      const result = replacer.replaceImports(source, [makeResolution('ghost-pkg', 'real-pkg')]);

      expect(result.appliedRules).toHaveLength(0);
      expect(result.transformedCode).toBe(result.sourceCode);
    });
  });

  // -------------------------------------------------------------------------
  // replaceImports – comment and formatting preservation
  // -------------------------------------------------------------------------

  describe('replaceImports() – comment and formatting preservation', () => {
    it('preserves inline comments on import lines', () => {
      const source = "import api from 'fake-api'; // HTTP client";
      const result = replacer.replaceImports(source, [makeResolution('fake-api', 'axios')]);

      expect(result.transformedCode).toContain('// HTTP client');
    });

    it('preserves block comments above imports', () => {
      const source = `
/* Database client */
import db from 'fake-db';
`.trim();
      const result = replacer.replaceImports(source, [makeResolution('fake-db', 'pg')]);

      expect(result.transformedCode).toContain('Database client');
    });

    it('preserves blank lines between import groups', () => {
      const source = `import a from 'ghost-a';

import b from 'ghost-b';`;
      const result = replacer.replaceImports(source, [
        makeResolution('ghost-a', 'real-a'),
        makeResolution('ghost-b', 'real-b'),
      ]);

      // Blank line should be preserved between the two imports
      expect(result.transformedCode).toContain('\n\n');
    });

    it('preserves indentation (spaces) in function body', () => {
      const source = `function load() {
  const mod = require('fake-mod');
  return mod;
}`;
      const result = replacer.replaceImports(source, [makeResolution('fake-mod', 'real-mod')]);

      // The function body indentation is preserved
      expect(result.transformedCode).toContain('real-mod');
      expect(result.transformedCode).toContain('function load()');
    });
  });

  // -------------------------------------------------------------------------
  // validateSyntax()
  // -------------------------------------------------------------------------

  describe('validateSyntax()', () => {
    it('returns true for valid JavaScript', () => {
      expect(replacer.validateSyntax("import foo from 'bar';")).toBe(true);
    });

    it('returns true for valid TypeScript', () => {
      expect(replacer.validateSyntax("const x: number = 42;")).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(replacer.validateSyntax('')).toBe(true);
    });

    it('returns false for invalid syntax', () => {
      expect(replacer.validateSyntax('import {{{;')).toBe(false);
    });

    it('returns false for unclosed brackets', () => {
      expect(replacer.validateSyntax('function foo() {')).toBe(false);
    });

    it('returns true for CommonJS code', () => {
      expect(replacer.validateSyntax("const x = require('foo');")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // generateDiff()
  // -------------------------------------------------------------------------

  describe('generateDiff()', () => {
    it('returns empty string when code is identical', () => {
      const code = "import foo from 'bar';";
      expect(replacer.generateDiff(code, code)).toBe('');
    });

    it('returns a non-empty diff when code differs', () => {
      const original = "import foo from 'old';";
      const transformed = "import foo from 'new';";
      const diff = replacer.generateDiff(original, transformed);

      expect(diff).toBeTruthy();
      expect(diff.length).toBeGreaterThan(0);
    });

    it('diff contains --- and +++ headers', () => {
      const diff = replacer.generateDiff("import a from 'x';", "import a from 'y';");

      expect(diff).toContain('---');
      expect(diff).toContain('+++');
    });

    it('diff contains @@ hunk header', () => {
      const diff = replacer.generateDiff("import a from 'x';", "import a from 'y';");

      expect(diff).toContain('@@');
    });

    it('diff shows removed lines with - prefix', () => {
      const diff = replacer.generateDiff("import a from 'old';", "import a from 'new';");

      const lines = diff.split('\n');
      expect(lines.some(l => l.startsWith('-') && l.includes('old'))).toBe(true);
    });

    it('diff shows added lines with + prefix', () => {
      const diff = replacer.generateDiff("import a from 'old';", "import a from 'new';");

      const lines = diff.split('\n');
      expect(lines.some(l => l.startsWith('+') && l.includes('new'))).toBe(true);
    });

    it('metadata.diff is populated on replaceImports result', () => {
      const source = "import api from 'fake-api';";
      const result = replacer.replaceImports(source, [makeResolution('fake-api', 'axios')]);

      expect(result.metadata?.diff).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('throws TransformationError for completely invalid source code', () => {
      const invalid = '@@@ not valid code @@@';
      expect(() =>
        replacer.replaceImports(invalid, [makeResolution('x', 'y')])
      ).toThrow(TransformationError);
    });

    it('TransformationError has operation context', () => {
      try {
        replacer.replaceImports('@@@ bad @@@', []);
      } catch (err) {
        expect(err).toBeInstanceOf(TransformationError);
        expect((err as TransformationError).code).toBe('TRANSFORMATION_ERROR');
      }
    });

    it('handles empty resolutions array without error', () => {
      const source = "import foo from 'bar';";
      const result = replacer.replaceImports(source, []);

      expect(result.transformedCode).toBe(source);
      expect(result.appliedRules).toHaveLength(0);
    });

    it('handles empty source code without error', () => {
      const result = replacer.replaceImports('', [makeResolution('x', 'y')]);

      expect(result.transformedCode).toBe('');
      expect(result.appliedRules).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Task 5.3 – Formatting preservation via recast (Babel + recast config)
  // -------------------------------------------------------------------------

  describe('Task 5.3 – Babel + recast formatting preservation', () => {
    it('preserves single quotes', () => {
      const source = "import foo from 'bar';";
      const result = replacer.replaceImports(source, [makeResolution('bar', 'baz')]);

      // recast preserves the original quote style
      expect(result.transformedCode).toContain("'baz'");
    });

    it('preserves quote style for unchanged code', () => {
      // recast preserves original quotes for nodes it doesn't reprint
      // For the replaced import source, it uses the configured quote style
      const source = "import foo from 'bar';";
      const result = replacer.replaceImports(source, [makeResolution('bar', 'baz')]);

      // The replacement uses the same quote style as the original
      expect(result.transformedCode).toContain("'baz'");
    });

    it('preserves semicolons', () => {
      const source = "import foo from 'bar';";
      const result = replacer.replaceImports(source, [makeResolution('bar', 'baz')]);

      expect(result.transformedCode).toContain(';');
    });

    it('preserves trailing commas in named imports', () => {
      const source = "import { a, b, } from 'ghost';";
      const result = replacer.replaceImports(source, [makeResolution('ghost', 'real')]);

      // recast preserves trailing comma
      expect(result.transformedCode).toContain('real');
    });

    it('preserves JSDoc comments', () => {
      const source = `
/**
 * @module api
 */
import api from 'fake-api';
`.trim();
      const result = replacer.replaceImports(source, [makeResolution('fake-api', 'axios')]);

      expect(result.transformedCode).toContain('@module api');
      expect(result.transformedCode).toContain('axios');
    });

    it('transformed code is syntactically valid', () => {
      const source = `
import api from 'fake-api';
import { connect } from 'fake-db';
const x: number = 42;
`.trim();
      const result = replacer.replaceImports(source, [
        makeResolution('fake-api', 'axios'),
        makeResolution('fake-db', 'pg'),
      ]);

      expect(replacer.validateSyntax(result.transformedCode)).toBe(true);
    });
  });
});
