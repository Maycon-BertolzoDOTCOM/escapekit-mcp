import { describe, it, expect } from 'vitest';
import { config } from '../../src/config.js';

describe('Config (Basic Tests)', () => {
  describe('default values', () => {
    it('should have default port defined', () => {
      expect(config.port).toBeDefined();
      expect(typeof config.port).toBe('number');
    });

    it('should have default host defined', () => {
      expect(config.host).toBeDefined();
      expect(typeof config.host).toBe('string');
    });

    it('should have log level defined', () => {
      expect(config.logLevel).toBeDefined();
      expect(['info', 'debug', 'warn', 'error']).toContain(config.logLevel);
    });
  });

  describe('environment detection', () => {
    it('should detect environment type', () => {
      expect(config.env).toBeDefined();
      expect(['development', 'production', 'test']).toContain(config.env);
    });

    it('should have isDevelopment property', () => {
      expect(typeof config.isDevelopment).toBe('boolean');
    });

    it('should have isProduction property', () => {
      expect(typeof config.isProduction).toBe('boolean');
    });
  });
});
