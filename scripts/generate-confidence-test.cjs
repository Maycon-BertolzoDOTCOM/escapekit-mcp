const fs = require('fs');
const path = require('path');

const detectorPath = 'src/utils/ConfidenceCalculator.ts';
const outputPath = 'tests/generated/ConfidenceCalculator.test.ts';

console.log('Generating test for:', detectorPath);

const testCode = `import { describe, it, expect } from 'vitest';
import { ConfidenceCalculator } from '../../${detectorPath}';

describe('ConfidenceCalculator', () => {
  describe('calculate', () => {
    it('should return perfect score with no issues', () => {
      const calc = new ConfidenceCalculator();
      const result = calc.calculate([]);
      expect(result.score).toBe(1.0);
      expect(result.level).toBe('excellent');
      expect(result.errorIssues).toBe(0);
      expect(result.warningIssues).toBe(0);
    });

    it('should decrease score with error issues', () => {
      const calc = new ConfidenceCalculator();
      const issues = [
        { id: '1', type: 'test', severity: 'error', message: 'Test error', location: { file: 'test', line: 1, column: 1 } }
      ];
      const result = calc.calculate(issues);
      expect(result.score).toBeLessThan(1.0);
      expect(result.errorIssues).toBe(1);
    });

    it('should decrease score with warning issues', () => {
      const calc = new ConfidenceCalculator();
      const issues = [
        { id: '1', type: 'test', severity: 'warning', message: 'Test warning', location: { file: 'test', line: 1, column: 1 } }
      ];
      const result = calc.calculate(issues);
      expect(result.score).toBeLessThan(1.0);
      expect(result.warningIssues).toBe(1);
    });

    it('should return medium level for medium scores', () => {
      const calc = new ConfidenceCalculator();
      const issues = [
        { id: '1', type: 'test', severity: 'warning', message: 'Test', location: { file: 'test', line: 1, column: 1 } },
        { id: '2', type: 'test', severity: 'warning', message: 'Test', location: { file: 'test', line: 1, column: 1 } }
      ];
      const result = calc.calculate(issues);
      expect(result.level).toBe('high');
    });

    it('should return low level for low scores', () => {
      const calc = new ConfidenceCalculator();
      const issues = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        type: 'test',
        severity: 'error',
        message: 'Test',
        location: { file: 'test', line: 1, column: 1 }
      }));
      const result = calc.calculate(issues);
      expect(result.level).toBe('critical');
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
