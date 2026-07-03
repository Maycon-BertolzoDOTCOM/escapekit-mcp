import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackGenerator } from '../../src/validate/auto-fix/FallbackGenerator.js';
import type { Issue } from '../../src/validate/types.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock handlebars
vi.mock('handlebars', () => ({
  default: {
    compile: vi.fn().mockImplementation((source) => () => source),
  },
}));

describe('FallbackGenerator', () => {
  let generator: FallbackGenerator;
  const mockIssue: Issue = { type: 'webgl-support', message: 'WebGL not supported' };

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new FallbackGenerator();
  });

  describe('detectUIFramework', () => {
    it('should detect React projects', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockResolvedValue(JSON.stringify({ dependencies: { react: '^18.0.0' } }));
      
      const result = await generator['detectUIFramework']('/project');
      expect(result).toBe('react');
    });

    it('should detect Vue projects', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockResolvedValue(JSON.stringify({ dependencies: { vue: '^3.0.0' } }));
      
      const result = await generator['detectUIFramework']('/project');
      expect(result).toBe('vue');
    });

    it('should detect Svelte projects', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockResolvedValue(JSON.stringify({ dependencies: { svelte: '^3.0.0' } }));
      
      const result = await generator['detectUIFramework']('/project');
      expect(result).toBe('svelte');
    });

    it('should return vanilla for projects without frameworks', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockResolvedValue(JSON.stringify({ dependencies: {} }));
      
      const result = await generator['detectUIFramework']('/project');
      expect(result).toBe('vanilla');
    });

    it('should return vanilla when package.json is missing', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await generator['detectUIFramework']('/project');
      expect(result).toBe('vanilla');
    });
  });

  describe('renderTemplate', () => {
    it('should render template successfully', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockResolvedValue('template content');
      
      const result = await generator['renderTemplate']('three', {
        containerSelector: '#app',
        width: 800,
        height: 600,
        projectName: 'test'
      });
      
      expect(result).toBe('template content');
    });

    it('should return null when template file is missing', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await generator['renderTemplate']('three', {
        containerSelector: '#app',
        width: 800,
        height: 600,
        projectName: 'test'
      });
      
      expect(result).toBeNull();
    });

    it('should return null when Handlebars is not available', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockResolvedValue('template content');
      
      // Simulate Handlebars compile throwing an error
      const handlebars = await import('handlebars');
      handlebars.default.compile.mockImplementation(() => {
        throw new Error('Module not found');
      });
      
      const result = await generator['renderTemplate']('three', {
        containerSelector: '#app',
        width: 800,
        height: 600,
        projectName: 'test'
      });
      
      expect(result).toBeNull();
      
      // Restore compile mock
      handlebars.default.compile.mockImplementation((source: string) => () => source);
    });
  });

  describe('generateFallbackCode', () => {
    it('should use template when available', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockResolvedValue('template content');
      
      const result = await generator['generateFallbackCode']('three', {
        containerSelector: '#app',
        width: 800,
        height: 600,
        projectName: 'test'
      });
      
      expect(result).toBe('template content');
    });

    it('should fall back to hardcoded version when template fails', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await generator['generateFallbackCode']('three', {
        containerSelector: '#app',
        width: 800,
        height: 600,
        projectName: 'test'
      });
      
      expect(result).toContain('createThreeFallback');
    });
  });

  describe('integrateIntoEntryPoint', () => {
    it('should integrate into React entry point', async () => {
      const { access, readFile, writeFile } = await import('fs/promises');
      
      // Mock file system
      access.mockImplementation((path) => {
        if (path.endsWith('src/App.tsx')) return Promise.resolve();
        return Promise.reject();
      });
      
      readFile.mockResolvedValue('// App content');
      
      const result = await generator['integrateIntoEntryPoint']('/project', 'react');
      
      expect(result.file).toBe('src/App.tsx');
      expect(writeFile).toHaveBeenCalled();
    });

    it('should not duplicate existing imports', async () => {
      const { access, readFile, writeFile } = await import('fs/promises');
      
      access.mockResolvedValue();
      readFile.mockResolvedValue("import { checkWebGLSupport } from './utils/webgl-fallback';");
      
      const result = await generator['integrateIntoEntryPoint']('/project', 'react');
      
      expect(result.file).toBeDefined();
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should return note when no entry point is found', async () => {
      const { access } = await import('fs/promises');
      access.mockRejectedValue(new Error('File not found'));
      
      const result = await generator['integrateIntoEntryPoint']('/project', 'react');
      
      expect(result.note).toBeDefined();
    });
  });

  describe('fix', () => {
    it('should generate fallback code and CSS', async () => {
      const { readFile, writeFile, access, mkdir } = await import('fs/promises');
      
      // Mock package.json
      readFile.mockImplementation((path) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ name: 'test-project', dependencies: { react: '^18.0.0' } }));
        }
        return Promise.reject();
      });
      
      // Mock template
      vi.doMock('handlebars', () => ({
        default: {
          compile: vi.fn().mockImplementation((source) => () => source),
        },
      }));
      
      access.mockRejectedValue(new Error('Directory not found'));
      
      const result = await generator.fix('/project', mockIssue);
      
      expect(result.applied).toBe(true);
      expect(result.description).toContain('test-project');
      expect(writeFile).toHaveBeenCalledTimes(2); // fallback.ts and CSS
    });

    it('should handle errors gracefully', async () => {
      const { readFile, writeFile } = await import('fs/promises');
      readFile.mockRejectedValue(new Error('File not found'));
      writeFile.mockRejectedValue(new Error('Write failed'));
      
      const result = await generator.fix('/project', mockIssue);
      
      expect(result.applied).toBe(false);
    });
  });
});