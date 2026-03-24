import { PolyfillInjector } from '../../src/validate/auto-fix/PolyfillInjector.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Issue } from '../../src/validate/types.js';

describe('PolyfillInjector', () => {
  let injector: PolyfillInjector;
  
  beforeEach(() => {
    injector = new PolyfillInjector();
    vi.resetAllMocks();
  });

  describe('detectBundler', () => {
    it('should detect Next.js when next.config.js exists', async () => {
      vi.spyOn(injector as any, 'hasFile').mockResolvedValueOnce(true);
      const result = await injector['detectBundler']('/test');
      expect(result).toBe('nextjs');
    });

    it('should detect Vite when vite.config.js exists', async () => {
      vi.spyOn(injector as any, 'hasFile').mockImplementation(async (_, file) => {
        return file === 'vite.config.js';
      });
      const result = await injector['detectBundler']('/test');
      expect(result).toBe('vite');
    });

    it('should detect Webpack when webpack.config.js exists', async () => {
      vi.spyOn(injector as any, 'hasFile').mockImplementation(async (_, file) => {
        return file === 'webpack.config.js';
      });
      const result = await injector['detectBundler']('/test');
      expect(result).toBe('webpack');
    });

    it('should return unknown when no bundler is detected', async () => {
      vi.spyOn(injector as any, 'hasFile').mockResolvedValue(false);
      const result = await injector['detectBundler']('/test');
      expect(result).toBe('unknown');
    });
  });

  describe('integrateVite', () => {
    it('should add import to existing entry point', async () => {
      const mockRead = vi.fn().mockResolvedValue('// existing content');
      const mockWrite = vi.fn();
      vi.spyOn(injector as any, 'hasFile').mockResolvedValue(true);
      vi.spyOn(injector as any, 'readFile').mockImplementation(mockRead);
      vi.spyOn(injector as any, 'writeFile').mockImplementation(mockWrite);
      
      await injector['integrateVite']('/test');
      expect(mockWrite).toHaveBeenCalledWith(
        '/test/src/main.ts',
        "import './polyfills';\n// existing content"
      );
    });

    it('should not duplicate existing import', async () => {
      const mockRead = vi.fn().mockResolvedValue("import './polyfills';\n// existing content");
      vi.spyOn(injector as any, 'hasFile').mockResolvedValue(true);
      vi.spyOn(injector as any, 'readFile').mockImplementation(mockRead);
      
      const result = await injector['integrateVite']('/test');
      expect(result.note).toBe('Polyfill import already exists');
    });
  });

  describe('integrateWebpack', () => {
    it('should transform string entry to array', async () => {
      const mockRead = vi.fn().mockResolvedValue("entry: './src/main.js'");
      const mockWrite = vi.fn();
      vi.spyOn(injector as any, 'hasFile').mockResolvedValue(true);
      vi.spyOn(injector as any, 'readFile').mockImplementation(mockRead);
      vi.spyOn(injector as any, 'writeFile').mockImplementation(mockWrite);
      
      await injector['integrateWebpack']('/test');
      expect(mockWrite).toHaveBeenCalledWith(
        '/test/webpack.config.js',
        "entry: ['./src/main.js', './src/polyfills']"
      );
    });
  });

  describe('integrateNextjs', () => {
    it('should add import to _app.tsx', async () => {
      const mockRead = vi.fn().mockResolvedValue('// existing _app content');
      const mockWrite = vi.fn();
      vi.spyOn(injector as any, 'hasFile').mockImplementation(async (_, file) => {
        return file === 'pages/_app.tsx';
      });
      vi.spyOn(injector as any, 'readFile').mockImplementation(mockRead);
      vi.spyOn(injector as any, 'writeFile').mockImplementation(mockWrite);
      
      await injector['integrateNextjs']('/test');
      expect(mockWrite).toHaveBeenCalledWith(
        '/test/pages/_app.tsx',
        "import '../polyfills';\n// existing _app content"
      );
    });
  });

  describe('fix', () => {
    it('should handle unknown bundler with warning', async () => {
      const mockDetect = vi.spyOn(injector as any, 'detectBundler').mockResolvedValue('unknown');
      const mockWarn = vi.spyOn(injector['log'], 'warn');
      
      const issue: Issue = { type: 'test', message: 'IntersectionObserver is not defined' };
      const result = await injector.fix('/test', issue);
      
      expect(mockDetect).toHaveBeenCalled();
      expect(mockWarn).toHaveBeenCalled();
      expect(result.note).toBe('Manual bundler integration required');
    });
  });
});