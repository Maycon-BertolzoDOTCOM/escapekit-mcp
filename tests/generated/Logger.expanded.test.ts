import { describe, it, expect } from 'vitest';
import { logger } from '../../src/logger.js';

describe('Logger (Basic Tests)', () => {
  describe('child method', () => {
    it('should create child logger with context', () => {
      const childLogger = logger.child({ module: 'test' });
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(typeof childLogger.debug).toBe('function');
    });
  });

  describe('log levels', () => {
    it('should have all standard log methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should accept string messages', () => {
      // Just test that the method exists and can be called
      expect(() => logger.info('Test message')).not.toThrow();
    });

    it('should accept object context', () => {
      expect(() => logger.info('Test with context', { key: 'value' })).not.toThrow();
    });
  });
});
