/**
 * NPMRegistry Tests
 * 
 * Tests for the NPMRegistry service with focus on retry logic,
 * network error handling, and graceful degradation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NPMRegistry } from '../../src/services/NPMRegistry.js';
import { NPMRegistryError, TimeoutError, PackageNotFoundError } from '../../src/errors.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NPMRegistry', () => {
  let registry: NPMRegistry;

  beforeEach(() => {
    registry = new NPMRegistry({
      registryUrl: 'https://registry.example.com',
      cacheTTL: 5000,
      existenceCheckTimeout: 1000,
      versionQueryTimeout: 2000,
      maxRetries: 2,
      initialRetryDelay: 100,
      enableRetry: true,
    });
    
    // Default mock implementation
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url !== 'string') return { ok: false, status: 400 };
      
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      };
    });
    
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('packageExists', () => {
    it('should return true for existing packages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await registry.packageExists('lodash');
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://registry.example.com/lodash', {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      });
    });

    it('should return false for non-existing packages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await registry.packageExists('non-existent-package');
      
      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith('https://registry.example.com/non-existent-package', {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle Node.js built-in modules', async () => {
      const result = await registry.packageExists('fs');
      
      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false when network error occurs after retries', async () => {
      // Mock network errors for all retry attempts
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await registry.packageExists('network-error-package');
      
      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle timeout errors gracefully', async () => {
      // Mock timeout error (AbortError)
      const timeoutError = new Error('The operation was aborted.');
      timeoutError.name = 'AbortError';
      
      mockFetch.mockRejectedValueOnce(timeoutError);
      mockFetch.mockRejectedValueOnce(timeoutError);
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await registry.packageExists('timeout-package');
      
      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should cache results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // First call
      await registry.packageExists('cached-package');
      
      // Second call should use cache
      const result = await registry.packageExists('cached-package');
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLatestVersion', () => {
    it('should return version for existing packages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          'dist-tags': { latest: '4.17.21' },
          version: '4.17.21',
        }),
      });

      const result = await registry.getLatestVersion('lodash');
      
      expect(result).toBe('4.17.21');
      expect(mockFetch).toHaveBeenCalledWith('https://registry.example.com/lodash', {
        signal: expect.any(AbortSignal),
      });
    });

    it('should return "unknown" when network error occurs after retries', async () => {
      // Mock network errors for all retry attempts
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await registry.getLatestVersion('network-error-package');
      
      expect(result).toBe('unknown');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle timeout errors gracefully', async () => {
      // Mock timeout error (AbortError)
      const timeoutError = new Error('The operation was aborted.');
      timeoutError.name = 'AbortError';
      
      mockFetch.mockRejectedValueOnce(timeoutError);
      mockFetch.mockRejectedValueOnce(timeoutError);
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await registry.getLatestVersion('timeout-package');
      
      expect(result).toBe('unknown');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle 404 responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await registry.getLatestVersion('non-existent-package');
      
      expect(result).toBe('unknown');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return "builtin" for Node.js built-in modules', async () => {
      const result = await registry.getLatestVersion('fs');
      
      expect(result).toBe('builtin');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should cache version results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          'dist-tags': { latest: '1.0.0' },
          version: '1.0.0',
        }),
      });

      // First call
      await registry.getLatestVersion('cached-version-package');
      
      // Second call should use cache
      const result = await registry.getLatestVersion('cached-version-package');
      
      expect(result).toBe('1.0.0');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkPackages', () => {
    it('should check multiple packages and return PackageInfo with status', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/lodash')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              'dist-tags': { latest: '4.17.21' },
              version: '4.17.21',
            }),
          };
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        };
      });

      const results = await registry.checkPackages(['lodash', 'non-existent']);

      expect(results.size).toBe(2);
      
      const lodashInfo = results.get('lodash');
      expect(lodashInfo).toEqual({
        name: 'lodash',
        version: '4.17.21',
        exists: true,
        status: 'FOUND',
      });

      const nonExistentInfo = results.get('non-existent');
      expect(nonExistentInfo).toEqual({
        name: 'non-existent',
        version: 'unknown',
        exists: false,
        status: 'NOT_FOUND',
      });
    });

    it('should handle network errors and mark packages as UNVERIFIED_NETWORK_ERROR', async () => {
      let networkErrorCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/network-error-package')) {
          networkErrorCount++;
          throw new Error('Network error');
        }
        if (url.includes('/success-package')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              'dist-tags': { latest: '1.0.0' },
              version: '1.0.0',
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const results = await registry.checkPackages(['network-error-package', 'success-package']);

      expect(results.size).toBe(2);
      
      const networkErrorInfo = results.get('network-error-package');
      expect(networkErrorInfo).toEqual({
        name: 'network-error-package',
        version: 'unknown',
        exists: false,
        status: 'UNVERIFIED_NETWORK_ERROR',
      });

      const successInfo = results.get('success-package');
      expect(successInfo).toEqual({
        name: 'success-package',
        version: '1.0.0',
        exists: true,
        status: 'FOUND',
      });
    });

    it('should handle Node.js built-ins correctly', async () => {
      const results = await registry.checkPackages(['fs', 'path']);

      expect(results.size).toBe(2);
      
      const fsInfo = results.get('fs');
      expect(fsInfo).toEqual({
        name: 'fs',
        version: 'builtin',
        exists: true,
        status: 'BUILTIN',
      });

      const pathInfo = results.get('path');
      expect(pathInfo).toEqual({
        name: 'path',
        version: 'builtin',
        exists: true,
        status: 'BUILTIN',
      });
    });
  });

  describe('HTTP 500 Error Handling', () => {
    it('should handle HTTP 500 errors and retry with exponential backoff', async () => {
      let errorCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/server-error-package')) {
          if (errorCount < 2) {
            errorCount++;
            return { ok: false, status: 500 };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              'dist-tags': { latest: '1.0.0' },
              version: '1.0.0',
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const result = await registry.packageExists('server-error-package');
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle HTTP 500 errors and mark as UNVERIFIED_NETWORK_ERROR after retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const results = await registry.checkPackages(['server-error-package']);

      expect(results.size).toBe(1);
      
      const serverErrorInfo = results.get('server-error-package');
      expect(serverErrorInfo).toEqual({
        name: 'server-error-package',
        version: 'unknown',
        exists: false,
        status: 'UNVERIFIED_NETWORK_ERROR',
      });
    });

    it('should handle mixed HTTP 500 and network errors', async () => {
      let mixedErrorCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/mixed-error-package')) {
          if (mixedErrorCount === 0) {
            mixedErrorCount++;
            return { ok: false, status: 500 };
          }
          if (mixedErrorCount === 1) {
            mixedErrorCount++;
            throw new Error('Network error');
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              'dist-tags': { latest: '2.0.0' },
              version: '2.0.0',
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const result = await registry.getLatestVersion('mixed-error-package');
      
      expect(result).toBe('2.0.0');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Retry Logic', () => {
    it('should implement exponential backoff delay', async () => {
      vi.useFakeTimers();
      
      // Mock network errors to trigger retries
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      const promise = registry.packageExists('retry-package');
      
      // First attempt fails immediately, waits 100ms
      await vi.advanceTimersByTimeAsync(100);
      
      // Second attempt fails, waits 200ms
      await vi.advanceTimersByTimeAsync(200);
      
      const result = await promise;
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      vi.useRealTimers();
    });

    it('should not retry when enableRetry is false', async () => {
      const registryNoRetry = new NPMRegistry({
        registryUrl: 'https://registry.example.com',
        cacheTTL: 5000,
        existenceCheckTimeout: 1000,
        versionQueryTimeout: 2000,
        maxRetries: 2,
        initialRetryDelay: 100,
        enableRetry: false,
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await registryNoRetry.packageExists('no-retry-package');
      
      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('fetchPackageScripts', () => {
    it('should return scripts object when scripts field is present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          name: 'my-pkg',
          version: '1.0.0',
          scripts: { postinstall: 'node setup.js', test: 'jest' },
        }),
      });

      const result = await registry.fetchPackageScripts('my-pkg', '1.0.0');

      expect(result).toEqual({ postinstall: 'node setup.js', test: 'jest' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.example.com/my-pkg/1.0.0',
        { signal: expect.any(AbortSignal) }
      );
    });

    it('should return {} when scripts field is absent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: 'no-scripts-pkg', version: '2.0.0' }),
      });

      const result = await registry.fetchPackageScripts('no-scripts-pkg', '2.0.0');

      expect(result).toEqual({});
    });

    it('should return null on 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await registry.fetchPackageScripts('ghost-pkg', '0.0.1');

      expect(result).toBeNull();
    });

    it('should cache null on 404 and not re-fetch', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await registry.fetchPackageScripts('ghost-pkg', '1.0.0');
      const second = await registry.fetchPackageScripts('ghost-pkg', '1.0.0');

      expect(second).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should cache successful result and not re-fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ scripts: { build: 'tsc' } }),
      });

      await registry.fetchPackageScripts('cached-pkg', '3.0.0');
      const second = await registry.fetchPackageScripts('cached-pkg', '3.0.0');

      expect(second).toEqual({ build: 'tsc' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return null on network error after retries (no caching)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await registry.fetchPackageScripts('flaky-pkg', '1.0.0');

      expect(result).toBeNull();
      // Should have retried (maxRetries=2 → 3 total attempts)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should return null on timeout (no caching)', async () => {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await registry.fetchPackageScripts('slow-pkg', '1.0.0');

      expect(result).toBeNull();
    });

    it('should use separate cache from PackageInfo cache', async () => {
      // Populate the PackageInfo cache via packageExists
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      await registry.packageExists('shared-name-pkg');

      // fetchPackageScripts should still make its own request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ scripts: { start: 'node index.js' } }),
      });
      const scripts = await registry.fetchPackageScripts('shared-name-pkg', '1.0.0');

      expect(scripts).toEqual({ start: 'node index.js' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when clearCache is called', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await registry.packageExists('cache-test-package');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      registry.clearCache();

      await registry.packageExists('cache-test-package');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Should call fetch again after cache clear
    });

    it('should respect cache TTL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // Set a very short cache TTL
      const shortTTLRegistry = new NPMRegistry({
        registryUrl: 'https://registry.example.com',
        cacheTTL: 10, // 10ms
        existenceCheckTimeout: 1000,
        versionQueryTimeout: 2000,
        maxRetries: 2,
        initialRetryDelay: 100,
        enableRetry: true,
      });

      await shortTTLRegistry.packageExists('ttl-test-package');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      await shortTTLRegistry.packageExists('ttl-test-package');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Should call fetch again after cache expires
    });
  });
});