import { describe, it, expect } from 'vitest';
import { AuditLogger } from '../../src/audit/AuditLogger';

describe('AuditLogger', () => {
  describe('constructor', () => {
    it('should create logger', () => {
      const logger = new AuditLogger();
      expect(logger).toBeDefined();
    });
  });

  describe('logRequest', () => {
    it('should log request', () => {
      const auditLogger = new AuditLogger();
      auditLogger.logRequest({
        operation: 'test',
        mirror: 'npm',
        success: true,
        duration: 100
      });
      const entries = auditLogger.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].operation).toBe('test');
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for empty logger', () => {
      const auditLogger = new AuditLogger();
      const stats = auditLogger.getStatistics();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should calculate statistics correctly', () => {
      const auditLogger = new AuditLogger();
      auditLogger.logRequest({
        operation: 'test',
        mirror: 'npm',
        success: true,
        duration: 100
      });
      auditLogger.logRequest({
        operation: 'test',
        mirror: 'npm',
        success: false,
        duration: 200
      });
      const stats = auditLogger.getStatistics();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successRate).toBe(0.5);
      expect(stats.averageDuration).toBe(150);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      const auditLogger = new AuditLogger();
      auditLogger.logRequest({
        operation: 'test',
        mirror: 'npm',
        success: true,
        duration: 100
      });
      auditLogger.clear();
      expect(auditLogger.getEntries().length).toBe(0);
    });
  });
});
