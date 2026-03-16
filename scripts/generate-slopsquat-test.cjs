const fs = require('fs');
const path = require('path');

const detectorPath = 'src/security/SlopsquatDetector.ts';
const outputPath = 'tests/generated/SlopsquatDetector.test.ts';

console.log('Generating test for:', detectorPath);

const testCode = `import { describe, it, expect } from 'vitest';
import { SlopsquatDetector } from '../../${detectorPath}';

describe('SlopsquatDetector', () => {
  describe('analyze', () => {
    it('should detect typosquatting', async () => {
      const detector = new SlopsquatDetector();
      const issue = await detector.analyze('reaact');
      expect(issue).not.toBeNull();
      expect(issue.type).toBe('slopsquat_risk');
    });

    it('should detect hallucination patterns', async () => {
      const detector = new SlopsquatDetector();
      const issue = await detector.analyze('react-awesome-pro-toolkit');
      expect(issue).not.toBeNull();
      expect(issue.type).toBe('slopsquat_risk');
    });

    it('should detect high entropy names', async () => {
      const detector = new SlopsquatDetector({ maxEntropy: 3 });
      const issue = await detector.analyze('xyz123abc789');
      expect(issue).not.toBeNull();
      expect(issue.type).toBe('slopsquat_risk');
    });

    it('should return null for legitimate packages', async () => {
      const detector = new SlopsquatDetector();
      const issue = await detector.analyze('react');
      expect(issue).toBeNull();
    });

    it('should consider recency in risk assessment', async () => {
      const detector = new SlopsquatDetector();
      const metadata = {
        publishDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      };
      const issue = await detector.analyze('reaact', metadata);
      expect(issue).not.toBeNull();
      expect(issue.description).toContain('published very recently');
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
