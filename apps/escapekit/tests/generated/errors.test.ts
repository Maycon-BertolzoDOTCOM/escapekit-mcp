import { describe, it, expect } from 'vitest';
import {
  EscapeKitError,
  ParseError,
  NetworkError,
  NPMRegistryError,
  PackageNotFoundError,
  TimeoutError
} from '../../src/errors';

describe('EscapeKitError', () => {
  it('should create base error', () => {
    const error = new EscapeKitError('test message', 'TEST_CODE');
    expect(error).toBeDefined();
    expect(error.message).toBe('test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('EscapeKitError');
  });

  it('should include context', () => {
    const error = new EscapeKitError('test message', 'TEST_CODE', { key: 'value' });
    expect(error.context).toEqual({ key: 'value' });
  });

  it('should serialize to JSON', () => {
    const error = new EscapeKitError('test message', 'TEST_CODE');
    const json = error.toJSON();
    expect(json.name).toBe('EscapeKitError');
    expect(json.message).toBe('test message');
    expect(json.code).toBe('TEST_CODE');
  });
});

describe('ParseError', () => {
  it('should create parse error', () => {
    const error = new ParseError('failed to parse');
    expect(error).toBeDefined();
    expect(error.code).toBe('PARSE_ERROR');
  });
});

describe('NetworkError', () => {
  it('should create network error', () => {
    const error = new NetworkError('network failed');
    expect(error).toBeDefined();
    expect(error.code).toBe('NETWORK_ERROR');
  });
});

describe('NPMRegistryError', () => {
  it('should create NPM registry error', () => {
    const error = new NPMRegistryError('registry failed');
    expect(error).toBeDefined();
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('should include package name', () => {
    const error = new NPMRegistryError('registry failed', 'test-package');
    expect(error.context?.packageName).toBe('test-package');
  });
});

describe('PackageNotFoundError', () => {
  it('should create package not found error', () => {
    const error = new PackageNotFoundError('missing-package');
    expect(error).toBeDefined();
    expect(error.message).toContain('missing-package');
  });
});

describe('TimeoutError', () => {
  it('should create timeout error', () => {
    const error = new TimeoutError('operation', 5000);
    expect(error).toBeDefined();
    expect(error.message).toContain('operation');
    expect(error.message).toContain('5000');
  });
});
