import { describe, it, expect, vi } from 'vitest';
import { createLogger, parseLogLevel, LogLevel } from '../../scripts/kiwi-logger';

describe('kiwi-logger', () => {
  describe('createLogger', () => {
    it('should create logger with default level', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
    });

    it('should accept custom level', () => {
      const logger = createLogger({ level: 'debug' });
      expect(logger).toBeDefined();
    });

    it('should accept prefix', () => {
      const logger = createLogger({ prefix: 'Test' });
      expect(logger).toBeDefined();
    });
  });

  describe('parseLogLevel', () => {
    it('should parse valid levels', () => {
      expect(parseLogLevel('debug')).toBe('debug');
      expect(parseLogLevel('info')).toBe('info');
      expect(parseLogLevel('warn')).toBe('warn');
      expect(parseLogLevel('error')).toBe('error');
      expect(parseLogLevel('silent')).toBe('silent');
    });

    it('should return info for invalid level', () => {
      expect(parseLogLevel('invalid')).toBe('info');
      expect(parseLogLevel(undefined)).toBe('info');
    });
  });
});
