import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  generateId,
  type ErrorSeverity,
  type IssueType
} from '../../src/models/schemas';

describe('schemas', () => {
  describe('createSuccessResponse', () => {
    it('should create success response', () => {
      const response = createSuccessResponse({ data: 'test' });
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ data: 'test' });
    });

    it('should create success response with metadata', () => {
      const response = createSuccessResponse({ data: 'test' });
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ data: 'test' });
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response', () => {
      const response = createErrorResponse('error message', 'ERROR_CODE');
      expect(response.success).toBe(false);
      expect(response.errors).toBeDefined();
      expect(response.errors.length).toBe(1);
      expect(response.errors[0].message).toBe('error message');
      expect(response.errors[0].code).toBe('ERROR_CODE');
    });

    it('should create error response with severity', () => {
      const response = createErrorResponse('error message', 'ERROR_CODE', 'warning');
      expect(response.success).toBe(false);
      expect(response.errors).toBeDefined();
      expect(response.errors.length).toBe(1);
      expect(response.errors[0].severity).toBe('warning');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with prefix', () => {
      const id = generateId('test');
      expect(id).toContain('test-');
    });
  });

  describe('ErrorSeverity type', () => {
    it('should accept valid severity values', () => {
      const severity1: ErrorSeverity = 'error';
      const severity2: ErrorSeverity = 'warning';
      const severity3: ErrorSeverity = 'info';
      expect(severity1).toBe('error');
      expect(severity2).toBe('warning');
      expect(severity3).toBe('info');
    });
  });

  describe('IssueType type', () => {
    it('should accept valid issue types', () => {
      const types: IssueType[] = [
        'ghost_import',
        'mock_api',
        'unrealistic_assumption',
        'security_risk',
        'infinite_loop',
        'postinstall_risk',
        'slopsquat_risk',
        'unicode_risk'
      ];
      expect(types.length).toBe(8);
    });
  });
});
