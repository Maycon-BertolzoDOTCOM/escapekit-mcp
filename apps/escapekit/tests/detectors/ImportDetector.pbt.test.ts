import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { ImportDetector, createImportDetector } from '../../src/detectors/ImportDetector.js';

// Property 1: ES6 import detection invariance
describe('Property 1: ES6 import detection invariance', () => {
  it('detect() returns results with type="es6" for ES6 imports', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('fs', 'path', 'http', 'express', 'lodash', 'react'),
        (packageName) => {
          const detector = createImportDetector();
          const code = `import test from '${packageName}';`;
          const results = detector.detect(code);
          
          if (results.length > 0) {
            return results[0].type === 'es6' && results[0].source === packageName;
          }
          return false;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Property 2: Relative import classification invariance
describe('Property 2: Relative import classification invariance', () => {
  it('detect() correctly identifies relative imports', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('./utils', '../module', '/absolute/path', 'react', 'lodash'),
        (path) => {
          const detector = createImportDetector();
          const code = `import test from '${path}';`;
          const results = detector.detect(code);
          
          if (results.length > 0) {
            const shouldBeRelative = path.startsWith('./') || path.startsWith('../') || path.startsWith('/');
            return results[0].isRelative === shouldBeRelative;
          }
          return false;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Property 3: CommonJS require detection invariance
describe('Property 3: CommonJS require detection invariance', () => {
  it('detect() returns results with type="commonjs" for require statements', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('fs', 'path', 'http', 'express', 'lodash', 'axios'),
        (packageName) => {
          const detector = createImportDetector();
          const code = `const pkg = require('${packageName}');`;
          const results = detector.detect(code);
          
          if (results.length > 0) {
            return results[0].type === 'commonjs' && results[0].source === packageName;
          }
          return false;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Property 4: Package name extraction invariance
describe('Property 4: Package name extraction invariance', () => {
  it('extractPackageName() returns correct package name for non-scoped packages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('react', 'lodash', 'express', 'moment', 'axios'),
        fc.array(fc.constantFrom('utils', 'helpers', 'lib', 'dist'), { minLength: 0, maxLength: 3 }),
        (pkg, subpaths) => {
          const detector = createImportDetector();
          const source = [pkg, ...subpaths].join('/');
          const extracted = detector.extractPackageName(source);
          
          return extracted === pkg;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Property 5: Pattern clearing invariance
describe('Property 5: Pattern clearing invariance', () => {
  it('clearPatterns() prevents detection of subsequent imports', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('react', 'lodash', 'express', 'axios'),
        (packageName) => {
          const detector = createImportDetector();
          const code = `import test from '${packageName}';`;
          
          const beforeClear = detector.detect(code);
          if (beforeClear.length === 0) return false;
          
          detector.clearPatterns();
          
          const afterClear = detector.detect(code);
          return afterClear.length === 0;
        }
      ),
      { numRuns: 20 }
    );
  });
});