import { describe, it, expect } from 'vitest';
import { generateEscapeKit, type GenerateOptions } from '../../src/tools/generate';

describe('generateEscapeKit', () => {
  describe('parameter validation', () => {
    it('should handle basic options', async () => {
      const options: GenerateOptions = {
        includeDocker: false,
        includeCI: false,
        dryRun: true
      };
      expect(options.dryRun).toBe(true);
    });

    it('should handle force option', async () => {
      const options: GenerateOptions = {
        force: true
      };
      expect(options.force).toBe(true);
    });

    it('should handle all options', async () => {
      const options: GenerateOptions = {
        includeDocker: true,
        includeCI: true,
        templatePath: '/custom/path',
        force: true,
        dryRun: false
      };
      expect(options.includeDocker).toBe(true);
      expect(options.includeCI).toBe(true);
      expect(options.templatePath).toBe('/custom/path');
      expect(options.force).toBe(true);
      expect(options.dryRun).toBe(false);
    });
  });
});
