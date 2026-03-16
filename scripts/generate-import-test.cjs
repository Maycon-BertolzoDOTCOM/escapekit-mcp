const fs = require('fs');
const path = require('path');

const detectorPath = 'src/detectors/ImportDetector.ts';
const outputPath = 'tests/generated/ImportDetector.test.ts';

console.log('Generating test for:', detectorPath);

const testCode = `import { describe, it, expect } from 'vitest';
import { ImportDetector, createImportDetector } from '../../${detectorPath}';

describe('ImportDetector', () => {
  describe('detect', () => {
    it('should detect ES6 imports', () => {
      const detector = createImportDetector();
      const code = 'import React from "react";';
      const result = detector.detect(code);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('react');
      expect(result[0].type).toBe('es6');
    });

    it('should detect CommonJS requires', () => {
      const detector = createImportDetector();
      const code = 'const fs = require("fs");';
      const result = detector.detect(code);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('fs');
      expect(result[0].type).toBe('commonjs');
    });

    it('should detect multiple imports', () => {
      const detector = createImportDetector();
      const code = 'import React from "react"; const fs = require("fs");';
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect relative imports', () => {
      const detector = createImportDetector();
      const code = 'import { helper } from "./helper";';
      const result = detector.detect(code);
      expect(result).toHaveLength(1);
      expect(result[0].isRelative).toBe(true);
    });

    it('should detect scoped packages', () => {
      const detector = createImportDetector();
      const code = 'import { Button } from "@mui/material";';
      const result = detector.detect(code);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('@mui/material');
    });
  });

  describe('getPackageNames', () => {
    it('should extract unique package names', () => {
      const detector = createImportDetector();
      const code = 'import React from "react"; import React from "react";';
      const imports = detector.detect(code);
      const packages = detector.getPackageNames(imports);
      expect(packages).toHaveLength(1);
    });

    it('should exclude relative imports', () => {
      const detector = createImportDetector();
      const code = 'import React from "react"; import { helper } from "./helper";';
      const imports = detector.detect(code);
      const packages = detector.getPackageNames(imports);
      expect(packages).toHaveLength(1);
      expect(packages[0]).toBe('react');
    });
  });

  describe('getImportsByType', () => {
    it('should filter ES6 imports', () => {
      const detector = createImportDetector();
      const code = 'import React from "react";';
      const imports = detector.detect(code);
      const es6Imports = detector.getImportsByType(imports, 'es6');
      expect(es6Imports).toHaveLength(1);
    });
  });

  describe('getStatistics', () => {
    it('should calculate import statistics', () => {
      const detector = createImportDetector();
      const code = 'import React from "react"; const fs = require("fs");';
      const imports = detector.detect(code);
      const stats = detector.getStatistics(imports);
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.packages).toBeGreaterThanOrEqual(1);
    });
  });
});
`;

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, testCode, 'utf-8');
console.log('Test saved to:', outputPath);
console.log('Done!');
