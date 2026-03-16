const fs = require('fs');
const path = require('path');

const detectorPath = 'src/validators/RuntimeValidator.ts';
const outputPath = 'tests/generated/RuntimeValidator.test.ts';

console.log('Generating test for:', detectorPath);

const testCode = `import { describe, it, expect } from 'vitest';
import { RuntimeValidator } from '../../${detectorPath}';

describe('RuntimeValidator', () => {
  describe('constructor', () => {
    it('should use default timeouts', () => {
      const validator = new RuntimeValidator();
      expect(validator).toBeDefined();
    });

    it('should use custom timeouts', () => {
      const validator = new RuntimeValidator({
        installTimeoutMs: 30000,
        bootTimeoutMs: 10000
      });
      expect(validator).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return validation result', async () => {
      const validator = new RuntimeValidator();
      const result = await validator.validate('/nonexistent/path');
      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.installSuccess).toBe(false);
      expect(result.bootSuccess).toBe(false);
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
