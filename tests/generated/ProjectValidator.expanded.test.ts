import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectValidator } from '../../src/validators/ProjectValidator';

// Mock global para fs/promises
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    access: vi.fn(),
    readFile: vi.fn(),
  };
});

// Mock para EscapeContractWriter
vi.mock('../../src/generators/EscapeContractWriter', () => ({
  EscapeContractWriter: vi.fn().mockImplementation(() => ({
    readContract: vi.fn().mockResolvedValue({}),
    validateContract: vi.fn().mockResolvedValue(true),
  })),
}));

describe('ProjectValidator (Expanded)', () => {
  let validator: ProjectValidator;

  beforeEach(() => {
    validator = new ProjectValidator();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create validator with default configuration', () => {
      expect(validator).toBeDefined();
      expect(typeof validator.validate).toBe('function');
    });
  });

  describe('basic validation structure', () => {
    it('should have validate method that returns expected structure', async () => {
      // Test the public validate method exists
      const result = await validator.validate('/test/path');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('passed');
      expect(result.summary).toHaveProperty('failed');
    });

    it('should return boolean valid flag', async () => {
      const result = await validator.validate('/test/path');
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return array of checks', async () => {
      const result = await validator.validate('/test/path');
      expect(Array.isArray(result.checks)).toBe(true);
    });
  });

  describe('file extension validation', () => {
    it('should have default source extensions defined', () => {
      // Test that default extensions are properly set
      // This test validates the internal configuration without mocking
      expect(Array.isArray((validator as any).defaultSourceExtensions)).toBe(true);
      expect((validator as any).defaultSourceExtensions).toContain('.ts');
      expect((validator as any).defaultSourceExtensions).toContain('.js');
    });

    it('should have default required files defined', () => {
      expect(Array.isArray((validator as any).defaultRequiredFiles)).toBe(true);
      expect((validator as any).defaultRequiredFiles).toContain('package.json');
      expect((validator as any).defaultRequiredFiles).toContain('tsconfig.json');
    });
  });

  describe('ghost import patterns', () => {
    it('should have default ghost import patterns', () => {
      expect(Array.isArray((validator as any).defaultGhostPatterns)).toBe(true);
      expect((validator as any).defaultGhostPatterns.length).toBeGreaterThan(0);
    });

    it('should include common ghost patterns', () => {
      const patterns = (validator as any).defaultGhostPatterns as RegExp[];
      const patternStrings = patterns.map(p => p.source);
      expect(patternStrings.some(p => p.includes('fake'))).toBe(true);
      expect(patternStrings.some(p => p.includes('mock'))).toBe(true);
    });
  });
});
