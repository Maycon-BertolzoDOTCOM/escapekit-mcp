import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Issue } from '../../src/validate/types.js';

const mockAccess = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock('fs/promises', () => ({
  access: mockAccess,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
}));

vi.mock('path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}));

const { PolyfillInjector } = await import('../../src/validate/auto-fix/PolyfillInjector.js');

function makeIssue(type: string, message: string): Issue {
  return {
    type: type as Issue['type'],
    severity: 'error',
    message,
  };
}

describe('PolyfillInjector', () => {
  let injector: InstanceType<typeof PolyfillInjector>;

  beforeEach(() => {
    vi.resetAllMocks();
    injector = new PolyfillInjector();
  });

  // ─── detectBundler ────────────────────────────────────────────────────

  describe('detectBundler', () => {
    it('should detect Next.js when next.config.js exists', async () => {
      // hasFile for next.config.{js,ts} → true, hasDirectory for pages/app → false
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('next.config')) return undefined;
        throw new Error('ENOENT');
      });

      const result = await (injector as any).detectBundler('/proj');
      expect(result).toBe('nextjs');
    });

    it('should detect Next.js when pages directory exists', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.endsWith('/pages')) return undefined;
        throw new Error('ENOENT');
      });

      const result = await (injector as any).detectBundler('/proj');
      expect(result).toBe('nextjs');
    });

    it('should detect Next.js when app directory exists', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.endsWith('/app')) return undefined;
        throw new Error('ENOENT');
      });

      const result = await (injector as any).detectBundler('/proj');
      expect(result).toBe('nextjs');
    });

    it('should detect Vite when vite.config.js exists', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('vite.config')) return undefined;
        throw new Error('ENOENT');
      });

      const result = await (injector as any).detectBundler('/proj');
      expect(result).toBe('vite');
    });

    it('should detect Vite when vite.config.ts exists', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('vite.config')) return undefined;
        throw new Error('ENOENT');
      });

      const result = await (injector as any).detectBundler('/proj');
      expect(result).toBe('vite');
    });

    it('should detect Webpack when webpack.config.js exists', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('webpack.config')) return undefined;
        throw new Error('ENOENT');
      });

      const result = await (injector as any).detectBundler('/proj');
      expect(result).toBe('webpack');
    });

    it('should return unknown when no bundler is detected', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await (injector as any).detectBundler('/proj');
      expect(result).toBe('unknown');
    });
  });

  // ─── integrateVite ────────────────────────────────────────────────────

  describe('integrateVite', () => {
    it('should add import to existing entry point', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('// existing content');
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateVite('/proj');

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/proj/src/main.ts',
        "import './polyfills';\n// existing content"
      );
      expect(result.file).toBe('src/main.ts');
    });

    it('should not duplicate existing import', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue("import './polyfills';\n// existing");

      const result = await (injector as any).integrateVite('/proj');

      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(result.note).toBe('Polyfill import already exists');
    });

    it('should return note when no entry point found', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await (injector as any).integrateVite('/proj');

      expect(result.file).toBeUndefined();
      expect(result.note).toBe('No Vite entry point found');
    });

    it('should check multiple entry points (tsx)', async () => {
      // First entry (main.ts) not found, second (main.tsx) found
      let callCount = 0;
      mockAccess.mockImplementation(async (p: string) => {
        callCount++;
        if (p.includes('src/main.tsx')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue('// content');
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateVite('/proj');

      expect(result.file).toBe('src/main.tsx');
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  // ─── integrateWebpack ─────────────────────────────────────────────────

  describe('integrateWebpack', () => {
    it('should transform string entry to array', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('webpack.config.js')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue("entry: './src/main.js'");
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateWebpack('/proj');

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/proj/webpack.config.js',
        "entry: ['./src/main.js', './src/polyfills']"
      );
      expect(result.file).toBe('webpack.config.js');
    });

    it('should transform array entry', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('webpack.config.js')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue("entry: ['./src/main.js']");
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateWebpack('/proj');

      expect(mockWriteFile).toHaveBeenCalled();
      expect(result.file).toBe('webpack.config.js');
    });

    it('should not modify if polyfill already included', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('webpack.config.js')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue("entry: ['./src/main.js', './src/polyfills']");

      const result = await (injector as any).integrateWebpack('/proj');

      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(result.file).toBe('webpack.config.js');
    });

    it('should throw when no webpack config found', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      await expect((injector as any).integrateWebpack('/proj')).rejects.toThrow(
        'No Webpack configuration file found'
      );
    });
  });

  // ─── integrateNextjs ──────────────────────────────────────────────────

  describe('integrateNextjs', () => {
    it('should add import to _app.tsx', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('pages/_app.tsx')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue('// existing _app content');
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateNextjs('/proj');

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/proj/pages/_app.tsx',
        "import '../polyfills';\n// existing _app content"
      );
      expect(result.file).toBe('pages/_app.tsx');
    });

    it('should add import to app/layout.tsx', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('app/layout.tsx')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue('// layout content');
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateNextjs('/proj');

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/proj/app/layout.tsx',
        expect.stringContaining("import '../../polyfills'")
      );
      expect(result.file).toBe('app/layout.tsx');
    });

    it('should note when _app.tsx already has import and app dir has no layout', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('pages/_app.tsx')) return undefined;
        if (p.endsWith('/app')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue("import '../polyfills';\n// content");
      mockWriteFile.mockResolvedValue(undefined);

      await expect((injector as any).integrateNextjs('/proj')).rejects.toThrow(
        'No Next.js entry point found'
      );
    });

    it('should create minimal _app.tsx when pages dir exists but no _app.tsx', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.endsWith('/pages')) return undefined;
        throw new Error('ENOENT');
      });
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateNextjs('/proj');

      expect(mockWriteFile).toHaveBeenCalled();
      expect(result.file).toBe('pages/_app.tsx');
      expect(result.note).toBe('Created minimal _app.tsx with polyfill import');
    });

    it('should throw when no Next.js entry point found', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      await expect((injector as any).integrateNextjs('/proj')).rejects.toThrow(
        'No Next.js entry point found'
      );
    });

    it('should handle both _app.tsx and layout.tsx', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('pages/_app.tsx') || p.includes('app/layout.tsx')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue('// content');
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateNextjs('/proj');

      expect(result.file).toContain('pages/_app.tsx');
      expect(result.file).toContain('app/layout.tsx');
    });

    it('should handle _app.tsx with import and app dir without layout', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('pages/_app.tsx')) return undefined;
        if (p.endsWith('/app')) return undefined;
        if (p.endsWith('/pages')) return undefined;
        throw new Error('ENOENT');
      });
      mockReadFile.mockResolvedValue("import '../polyfills';\n// content");
      mockWriteFile.mockResolvedValue(undefined);

      const result = await (injector as any).integrateNextjs('/proj');

      // _app.tsx has import → skips
      // hasDirectory('pages') → creates minimal _app.tsx (overwrites note)
      expect(result.file).toBe('pages/_app.tsx');
      expect(result.note).toBe('Created minimal _app.tsx with polyfill import');
    });
  });

  // ─── fix ──────────────────────────────────────────────────────────────

  describe('fix', () => {
    it('should return error when message does not match any API pattern', async () => {
      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'Something went wrong')
      );

      expect(result.applied).toBe(false);
      expect(result.error).toBe('Unknown polyfill requirement');
    });

    it('should return error when API has no known polyfill', async () => {
      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'SomeUnknownAPI is not defined')
      );

      expect(result.applied).toBe(false);
      expect(result.error).toMatch(/Unknown API/);
    });

    it('should match "Cannot find module" pattern', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', "Cannot find module 'structuredClone'")
      );

      // structuredClone maps to core-js, so it should try to proceed
      expect(result.applied).toBe(false);
      expect(result.error).toBe('Could not update package.json');
    });

    it('should fail when package.json cannot be read', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'IntersectionObserver is not defined')
      );

      expect(result.applied).toBe(false);
      expect(result.error).toBe('Could not update package.json');
    });

    it('should inject polyfill with unknown bundler (applied + note)', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', dependencies: {} }));
      mockWriteFile.mockResolvedValue(undefined);

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'IntersectionObserver is not defined')
      );

      expect(result.applied).toBe(true);
      expect(result.note).toBe('Manual bundler integration required');
    });

    it('should inject polyfill and integrate with Vite', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', dependencies: {} }));
      mockWriteFile.mockResolvedValue(undefined);

      let accessCall = 0;
      mockAccess.mockImplementation(async (p: string) => {
        accessCall++;
        // polyfills.ts doesn't exist → throw
        if (p.includes('polyfills.ts')) throw new Error('ENOENT');
        // src/ directory exists
        if (p.endsWith('/src')) return undefined;
        // vite.config exists
        if (p.includes('vite.config')) return undefined;
        // main.ts exists
        if (p.includes('src/main.ts')) return undefined;
        throw new Error('ENOENT');
      });

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'IntersectionObserver is not defined')
      );

      expect(result.applied).toBe(true);
      expect(result.description).toContain('vite');
    });

    it('should handle bundler integration failure gracefully', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', dependencies: {} }));
      mockWriteFile.mockResolvedValue(undefined);

      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('polyfills.ts')) throw new Error('ENOENT');
        if (p.endsWith('/src')) return undefined;
        // webpack.config exists but throws on read
        if (p.includes('webpack.config')) return undefined;
        throw new Error('ENOENT');
      });

      // Make readFile for webpack config throw
      mockReadFile.mockImplementation(async (p: string) => {
        if (p.includes('package.json')) return JSON.stringify({ name: 'test', dependencies: {} });
        if (p.includes('webpack.config')) throw new Error('read error');
        return '// content';
      });

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'IntersectionObserver is not defined')
      );

      expect(result.applied).toBe(true);
      expect(result.note).toBeDefined();
    });

    it('should not re-add existing dependency in package.json', async () => {
      // package.json already has intersection-observer
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          dependencies: { 'intersection-observer': '1.0.0' },
        })
      );
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('polyfills.ts')) throw new Error('ENOENT');
        if (p.endsWith('/src')) return undefined;
        throw new Error('ENOENT');
      });
      mockWriteFile.mockResolvedValue(undefined);

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'IntersectionObserver is not defined')
      );

      // writeFile for package.json should NOT be called since dep already exists
      const pkgWriteCalls = (mockWriteFile.mock.calls as any[][]).filter(
        ([p]) => typeof p === 'string' && p.includes('package.json')
      );
      expect(pkgWriteCalls).toHaveLength(0);
      expect(result.applied).toBe(true);
    });

    it('should append to existing polyfills.ts', async () => {
      mockReadFile.mockImplementation(async (p: string) => {
        if (p.includes('polyfills.ts')) return "// existing\nimport 'core-js';\n";
        return JSON.stringify({ name: 'test', dependencies: {} });
      });
      mockWriteFile.mockResolvedValue(undefined);
      mockAccess.mockResolvedValue(undefined);

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'IntersectionObserver is not defined')
      );

      // Should have written to polyfills.ts with append
      const polyfillWrites = (mockWriteFile.mock.calls as any[][]).filter(
        ([p]) => typeof p === 'string' && p.includes('polyfills.ts')
      );
      expect(polyfillWrites.length).toBeGreaterThan(0);
      expect(result.applied).toBe(true);
    });

    it('should create src directory if missing when creating polyfills.ts', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', dependencies: {} }));
      mockWriteFile.mockResolvedValue(undefined);

      let srcAccessCall = 0;
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('polyfills.ts')) throw new Error('ENOENT');
        if (p.endsWith('/src')) {
          srcAccessCall++;
          throw new Error('ENOENT');
        }
        throw new Error('ENOENT');
      });

      const originalImport = (globalThis as any).__originalMkdir;

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'IntersectionObserver is not defined')
      );

      expect(result.applied).toBe(true);
    });

    it('should detect all known polyfill APIs', async () => {
      const apiNames = [
        'IntersectionObserver',
        'ResizeObserver',
        'structuredClone',
        'fetch',
        'URL',
        'crypto',
        'AbortController',
        'TextEncoder',
      ];

      for (const api of apiNames) {
        mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', dependencies: {} }));
        mockWriteFile.mockResolvedValue(undefined);
        mockAccess.mockRejectedValue(new Error('ENOENT'));

        const result = await injector.fix(
          '/proj',
          makeIssue('MISSING_POLYFILL', `${api} is not defined`)
        );

        expect(result.applied).toBe(true);
        expect(result.description).toContain(api);
      }
    });

    it('should match "is not available" pattern', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', dependencies: {} }));
      mockWriteFile.mockResolvedValue(undefined);

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'fetch is not available')
      );

      expect(result.applied).toBe(true);
    });

    it('should match "is not supported" pattern', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', dependencies: {} }));
      mockWriteFile.mockResolvedValue(undefined);

      const result = await injector.fix(
        '/proj',
        makeIssue('MISSING_POLYFILL', 'crypto is not supported')
      );

      expect(result.applied).toBe(true);
    });
  });
});
