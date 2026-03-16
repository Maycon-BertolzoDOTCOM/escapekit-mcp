import { describe, it, expect } from 'vitest';
import { SecurityValidator } from '../../src/security/SecurityValidator';

describe('SecurityValidator', () => {
  describe('constructor', () => {
    it('should create validator with default options', () => {
      const validator = new SecurityValidator();
      expect(validator).toBeDefined();
    });

    it('should create validator with custom options', () => {
      const validator = new SecurityValidator({ maxStalenessMonths: 24 });
      expect(validator).toBeDefined();
    });
  });

  describe('checkVulnerabilities', () => {
    it('should return empty array for safe package', () => {
      const validator = new SecurityValidator();
      const result = validator.checkVulnerabilities('safe-package');
      expect(result).toEqual([]);
    });

    it('should return vulnerabilities for known vulnerable package', () => {
      const validator = new SecurityValidator();
      const result = validator.checkVulnerabilities('event-stream');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('CVE-2018-16462');
    });
  });

  describe('checkLicense', () => {
    it('should return true for MIT license', () => {
      const validator = new SecurityValidator();
      const result = validator.checkLicense('MIT');
      expect(result).toBe(true);
    });

    it('should return true for undefined license', () => {
      const validator = new SecurityValidator();
      const result = validator.checkLicense(undefined);
      expect(result).toBe(true);
    });

    it('should return false for proprietary license', () => {
      const validator = new SecurityValidator();
      const result = validator.checkLicense('PROPRIETARY');
      expect(result).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate safe package', async () => {
      const validator = new SecurityValidator();
      const result = await validator.validate('safe-package');
      expect(result.packageName).toBe('safe-package');
      expect(result.safe).toBe(true);
    });

    it('should validate vulnerable package', async () => {
      const validator = new SecurityValidator();
      const result = await validator.validate('event-stream');
      expect(result.packageName).toBe('event-stream');
      expect(result.safe).toBe(false);
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
    });
  });
});
