/**
 * Tests for core data models and schemas
 */

import { describe, it, expect } from 'vitest';
import {
  generateId,
  createErrorResponse,
  createSuccessResponse,
} from '../src/models/schemas.js';

describe('generateId', () => {
  it('should generate unique IDs with prefix', () => {
    const id1 = generateId('test');
    const id2 = generateId('test');
    
    expect(id1).toMatch(/^test-\d+-[a-z0-9]+$/);
    expect(id2).toMatch(/^test-\d+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it('should handle different prefixes', () => {
    const id1 = generateId('analysis');
    const id2 = generateId('escape');
    
    expect(id1).toMatch(/^analysis-/);
    expect(id2).toMatch(/^escape-/);
  });
});

describe('createErrorResponse', () => {
  it('should create error response with default severity', () => {
    const response = createErrorResponse('Test error');
    
    expect(response.success).toBe(false);
    expect(response.errors).toHaveLength(1);
    expect(response.errors[0].code).toBe('UNKNOWN_ERROR');
    expect(response.errors[0].message).toBe('Test error');
    expect(response.errors[0].severity).toBe('error');
  });

  it('should create error response with custom code', () => {
    const response = createErrorResponse('Test error', 'CUSTOM_ERROR');
    
    expect(response.errors[0].code).toBe('CUSTOM_ERROR');
  });

  it('should create error response with custom severity', () => {
    const response = createErrorResponse('Test warning', 'WARNING_CODE', 'warning');
    
    expect(response.errors[0].severity).toBe('warning');
  });

  it('should have no data in error response', () => {
    const response = createErrorResponse('Test error');
    
    expect(response.data).toBeUndefined();
  });
});

describe('createSuccessResponse', () => {
  it('should create success response with data', () => {
    const data = { test: 'value' };
    const response = createSuccessResponse(data);
    
    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });

  it('should have no errors in success response', () => {
    const response = createSuccessResponse({ test: 'value' });
    
    expect(response.errors).toHaveLength(0);
  });

  it('should handle complex data types', () => {
    const data = {
      nested: { value: 123 },
      array: [1, 2, 3],
      string: 'test',
    };
    const response = createSuccessResponse(data);
    
    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });
});