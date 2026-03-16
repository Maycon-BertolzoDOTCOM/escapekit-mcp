import { describe, it, expect } from 'vitest';
import {
  validateNPMRegistryConfig,
  DEFAULT_NPM_REGISTRY_CONFIG,
  DEFAULT_ANALYZER_CONFIG,
  type NPMRegistryConfig
} from '../../src/config';

describe('config', () => {
  describe('DEFAULT_NPM_REGISTRY_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_NPM_REGISTRY_CONFIG.registryUrl).toBe('https://registry.npmjs.org');
      expect(DEFAULT_NPM_REGISTRY_CONFIG.cacheTTL).toBe(5 * 60 * 1000);
      expect(DEFAULT_NPM_REGISTRY_CONFIG.maxRetries).toBe(3);
    });
  });

  describe('DEFAULT_ANALYZER_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_ANALYZER_CONFIG.maxFileSize).toBe(1024 * 1024);
      expect(DEFAULT_ANALYZER_CONFIG.verboseLogging).toBe(false);
      expect(DEFAULT_ANALYZER_CONFIG.defaultSandboxType).toBe('unknown');
    });
  });

  describe('validateNPMRegistryConfig', () => {
    it('should validate valid config', () => {
      const config: NPMRegistryConfig = {
        registryUrl: 'https://registry.npmjs.org',
        cacheTTL: 300000,
        existenceCheckTimeout: 5000,
        versionQueryTimeout: 10000,
        maxRetries: 3,
        initialRetryDelay: 1000,
        enableRetry: true
      };
      expect(() => validateNPMRegistryConfig(config)).not.toThrow();
    });

    it('should throw error for invalid registryUrl', () => {
      const config: NPMRegistryConfig = {
        registryUrl: 'not-a-url',
        cacheTTL: 300000,
        existenceCheckTimeout: 5000,
        versionQueryTimeout: 10000,
        maxRetries: 3,
        initialRetryDelay: 1000,
        enableRetry: true
      };
      expect(() => validateNPMRegistryConfig(config)).toThrow('Invalid registryUrl');
    });

    it('should throw error for invalid cacheTTL', () => {
      const config: NPMRegistryConfig = {
        registryUrl: 'https://registry.npmjs.org',
        cacheTTL: 0,
        existenceCheckTimeout: 5000,
        versionQueryTimeout: 10000,
        maxRetries: 3,
        initialRetryDelay: 1000,
        enableRetry: true
      };
      expect(() => validateNPMRegistryConfig(config)).toThrow('Invalid cacheTTL');
    });
  });
});
