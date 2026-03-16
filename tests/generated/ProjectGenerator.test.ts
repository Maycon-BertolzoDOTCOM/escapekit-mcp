import { describe, it, expect } from 'vitest';
import { ProjectGenerator } from '../../src/generators/ProjectGenerator';

describe('ProjectGenerator', () => {
  describe('constructor', () => {
    it('should create generator', () => {
      const generator = new ProjectGenerator();
      expect(generator).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate project structure', async () => {
      const generator = new ProjectGenerator();
      const params = {
        rootPath: '/tmp/test-project',
        projectName: 'test-project'
      };
      const result = await generator.generate(params);
      expect(result).toBeDefined();
    });
  });
});
