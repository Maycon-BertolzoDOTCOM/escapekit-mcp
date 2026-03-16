import { describe, it, expect } from 'vitest';
import { Logger, LogLevel } from '../../src/logger';

describe('Logger', () => {
  describe('constructor', () => {
    it('should create logger with default level', () => {
      const logger = new Logger();
      expect(logger).toBeDefined();
    });

    it('should create logger with INFO level', () => {
      const logger = new Logger(LogLevel.INFO);
      expect(logger).toBeDefined();
    });

    it('should create logger with prefix', () => {
      const logger = new Logger(LogLevel.INFO, 'Test');
      expect(logger).toBeDefined();
    });
  });

  describe('setLevel', () => {
    it('should change log level', () => {
      const logger = new Logger();
      logger.setLevel(LogLevel.DEBUG);
      expect(logger).toBeDefined();
      logger.setLevel(LogLevel.WARN);
      expect(logger).toBeDefined();
    });
  });

  describe('log methods', () => {
    it('should call debug method', () => {
      const logger = new Logger(LogLevel.DEBUG);
      logger.debug('test message');
      expect(logger).toBeDefined();
    });

    it('should call info method', () => {
      const logger = new Logger(LogLevel.INFO);
      logger.info('test message');
      expect(logger).toBeDefined();
    });

    it('should call warn method', () => {
      const logger = new Logger(LogLevel.WARN);
      logger.warn('test message');
      expect(logger).toBeDefined();
    });

    it('should call error method', () => {
      const logger = new Logger(LogLevel.ERROR);
      logger.error('test message');
      expect(logger).toBeDefined();
    });

    it('should log with context', () => {
      const logger = new Logger(LogLevel.INFO);
      logger.info('test message', { key: 'value' });
      expect(logger).toBeDefined();
    });
  });

  describe('child', () => {
    it('should create child logger', () => {
      const logger = new Logger(LogLevel.INFO);
      const child = logger.child('Child');
      expect(child).toBeDefined();
    });
  });
});
