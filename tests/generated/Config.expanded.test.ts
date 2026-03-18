import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NPM_REGISTRY_CONFIG,
  DEFAULT_ANALYZER_CONFIG,
  validateNPMRegistryConfig,
  validateAnalyzerConfig,
} from '../../src/config.js';

describe('Config (Basic Tests)', () => {
  describe('default NPM registry config', () => {
    it('should have default registry URL defined', () => {
      expect(DEFAULT_NPM_REGISTRY_CONFIG.registryUrl).toBeDefined();
      expect(DEFAULT_NPM_REGISTRY_CONFIG.registryUrl).toBe('https://registry.npmjs.org');
    });

    it('should have default cache TTL defined', () => {
      expect(DEFAULT_NPM_REGISTRY_CONFIG.cacheTTL).toBeDefined();
      expect(typeof DEFAULT_NPM_REGISTRY_CONFIG.cacheTTL).toBe('number');
      expect(DEFAULT_NPM_REGISTRY_CONFIG.cacheTTL).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should have default timeouts defined', () => {
      expect(DEFAULT_NPM_REGISTRY_CONFIG.existenceCheckTimeout).toBeDefined();
      expect(DEFAULT_NPM_REGISTRY_CONFIG.versionQueryTimeout).toBeDefined();
      expect(DEFAULT_NPM_REGISTRY_CONFIG.maxRetries).toBeDefined();
      expect(DEFAULT_NPM_REGISTRY_CONFIG.initialRetryDelay).toBeDefined();
    });

    it('should have retry enabled by default', () => {
      expect(DEFAULT_NPM_REGISTRY_CONFIG.enableRetry).toBe(true);
    });
  });

  describe('default analyzer config', () => {
    it('should have default max file size defined', () => {
      expect(DEFAULT_ANALYZER_CONFIG.maxFileSize).toBeDefined();
      expect(DEFAULT_ANALYZER_CONFIG.maxFileSize).toBe(1024 * 1024); // 1MB
    });

    it('should have verbose logging disabled by default', () => {
      expect(DEFAULT_ANALYZER_CONFIG.verboseLogging).toBe(false);
    });

    it('should have default sandbox type', () => {
      expect(DEFAULT_ANALYZER_CONFIG.defaultSandboxType).toBeDefined();
      expect(typeof DEFAULT_ANALYZER_CONFIG.defaultSandboxType).toBe('string');
    });

    it('should have confidence score weights defined', () => {
      expect(DEFAULT_ANALYZER_CONFIG.errorWeight).toBeDefined();
      expect(DEFAULT_ANALYZER_CONFIG.warningWeight).toBeDefined();
      expect(DEFAULT_ANALYZER_CONFIG.errorWeight).toBe(0.2);
      expect(DEFAULT_ANALYZER_CONFIG.warningWeight).toBe(0.05);
    });
  });

  describe('NPM registry config validation', () => {
    it('should validate valid NPM registry config', () => {
      expect(() => validateNPMRegistryConfig(DEFAULT_NPM_REGISTRY_CONFIG)).not.toThrow();
    });

    it('should throw error for invalid registry URL', () => {
      const invalidConfig = { ...DEFAULT_NPM_REGISTRY_CONFIG, registryUrl: 'not-a-url' };
      expect(() => validateNPMRegistryConfig(invalidConfig)).toThrow('Invalid registryUrl');
    });

    it('should throw error for negative cache TTL', () => {
      const invalidConfig = { ...DEFAULT_NPM_REGISTRY_CONFIG, cacheTTL: -1000 };
      expect(() => validateNPMRegistryConfig(invalidConfig)).toThrow('Invalid cacheTTL');
    });

    it('should throw error for negative timeouts', () => {
      const invalidConfig = { ...DEFAULT_NPM_REGISTRY_CONFIG, existenceCheckTimeout: -100 };
      expect(() => validateNPMRegistryConfig(invalidConfig)).toThrow('Invalid existenceCheckTimeout');
    });

    it('should throw error for negative max retries', () => {
      const invalidConfig = { ...DEFAULT_NPM_REGISTRY_CONFIG, maxRetries: -1 };
      expect(() => validateNPMRegistryConfig(invalidConfig)).toThrow('Invalid maxRetries');
    });
  });

  describe('analyzer config validation', () => {
    it('should validate valid analyzer config', () => {
      expect(() => validateAnalyzerConfig(DEFAULT_ANALYZER_CONFIG)).not.toThrow();
    });

    it('should throw error for negative max file size', () => {
      const invalidConfig = { ...DEFAULT_ANALYZER_CONFIG, maxFileSize: -100 };
      expect(() => validateAnalyzerConfig(invalidConfig)).toThrow('Invalid maxFileSize');
    });

    it('should throw error for negative error weight', () => {
      const invalidConfig = { ...DEFAULT_ANALYZER_CONFIG, errorWeight: -0.1 };
      expect(() => validateAnalyzerConfig(invalidConfig)).toThrow('Invalid errorWeight');
    });

    it('should throw error for negative warning weight', () => {
      const invalidConfig = { ...DEFAULT_ANALYZER_CONFIG, warningWeight: -0.1 };
      expect(() => validateAnalyzerConfig(invalidConfig)).toThrow('Invalid warningWeight');
    });
  });
});