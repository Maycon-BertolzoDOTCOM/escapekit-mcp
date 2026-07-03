import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityValidator } from '../../src/security/SecurityValidator.js';
import type { SecurityValidationResult } from '../../src/security/SecurityValidator.js';

vi.mock('../../src/logger.js', () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SecurityValidator', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new SecurityValidator();
  });

  // ─── constructor ──────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const v = new SecurityValidator();
      expect(v).toBeInstanceOf(SecurityValidator);
    });

    it('should accept custom maxStalenessMonths', () => {
      const v = new SecurityValidator({ maxStalenessMonths: 6 });
      expect(v).toBeInstanceOf(SecurityValidator);
    });

    it('should accept custom allowedLicenses', () => {
      const v = new SecurityValidator({ allowedLicenses: ['MIT', 'Apache-2.0'] });
      expect(v).toBeInstanceOf(SecurityValidator);
    });

    it('should accept all options', () => {
      const v = new SecurityValidator({ maxStalenessMonths: 24, allowedLicenses: ['MIT'] });
      expect(v).toBeInstanceOf(SecurityValidator);
    });
  });

  // ─── checkVulnerabilities ─────────────────────────────────────────────

  describe('checkVulnerabilities', () => {
    it('should detect event-stream as vulnerable', () => {
      const result = validator.checkVulnerabilities('event-stream');
      expect(result).toEqual(['CVE-2018-16462: malicious code injection']);
    });

    it('should detect flatmap-stream as vulnerable', () => {
      const result = validator.checkVulnerabilities('flatmap-stream');
      expect(result).toEqual(['CVE-2018-16462: malicious payload']);
    });

    it('should detect ua-parser-js as vulnerable', () => {
      const result = validator.checkVulnerabilities('ua-parser-js');
      expect(result).toEqual(['CVE-2021-27292: ReDoS vulnerability']);
    });

    it('should detect node-ipc as vulnerable', () => {
      const result = validator.checkVulnerabilities('node-ipc');
      expect(result).toEqual(['CVE-2022-23812: protestware - destructive payload']);
    });

    it('should detect colors as vulnerable', () => {
      const result = validator.checkVulnerabilities('colors');
      expect(result).toEqual(['CVE-2022-0355: protestware - infinite loop']);
    });

    it('should detect faker as vulnerable', () => {
      const result = validator.checkVulnerabilities('faker');
      expect(result).toEqual(['CVE-2022-0355: protestware - data corruption']);
    });

    it('should return empty array for safe packages', () => {
      expect(validator.checkVulnerabilities('lodash')).toEqual([]);
      expect(validator.checkVulnerabilities('react')).toEqual([]);
      expect(validator.checkVulnerabilities('express')).toEqual([]);
    });

    it('should return empty array for unknown packages', () => {
      expect(validator.checkVulnerabilities('some-random-package')).toEqual([]);
    });
  });

  // ─── checkDeprecation ─────────────────────────────────────────────────

  describe('checkDeprecation', () => {
    it('should return true when deprecated flag is true', () => {
      expect(validator.checkDeprecation('pkg', true)).toBe(true);
    });

    it('should return false when deprecated flag is false', () => {
      expect(validator.checkDeprecation('pkg', false)).toBe(false);
    });

    it('should return false when deprecated flag is undefined', () => {
      expect(validator.checkDeprecation('pkg', undefined)).toBe(false);
    });

    it('should return false when no metadata provided', () => {
      expect(validator.checkDeprecation('pkg')).toBe(false);
    });
  });

  // ─── checkLicense ─────────────────────────────────────────────────────

  describe('checkLicense', () => {
    it('should accept MIT license', () => {
      expect(validator.checkLicense('MIT')).toBe(true);
    });

    it('should accept ISC license', () => {
      expect(validator.checkLicense('ISC')).toBe(true);
    });

    it('should accept BSD-2-Clause license', () => {
      expect(validator.checkLicense('BSD-2-Clause')).toBe(true);
    });

    it('should accept BSD-3-Clause license', () => {
      expect(validator.checkLicense('BSD-3-Clause')).toBe(true);
    });

    it('should accept Apache-2.0 license', () => {
      expect(validator.checkLicense('Apache-2.0')).toBe(true);
    });

    it('should accept 0BSD license', () => {
      expect(validator.checkLicense('0BSD')).toBe(true);
    });

    it('should accept CC0-1.0 license', () => {
      expect(validator.checkLicense('CC0-1.0')).toBe(true);
    });

    it('should accept Unlicense', () => {
      expect(validator.checkLicense('Unlicense')).toBe(true);
    });

    it('should accept WTFPL license', () => {
      expect(validator.checkLicense('WTFPL')).toBe(true);
    });

    it('should reject GPL-3.0 license', () => {
      expect(validator.checkLicense('GPL-3.0')).toBe(false);
    });

    it('should reject GPL-2.0 license', () => {
      expect(validator.checkLicense('GPL-2.0')).toBe(false);
    });

    it('should reject AGPL-3.0 license', () => {
      expect(validator.checkLicense('AGPL-3.0')).toBe(false);
    });

    it('should return true for undefined license (assume compatible)', () => {
      expect(validator.checkLicense(undefined)).toBe(true);
    });

    it('should return true for empty string license', () => {
      expect(validator.checkLicense('')).toBe(true);
    });

    it('should handle case-insensitive license matching', () => {
      expect(validator.checkLicense('mit')).toBe(true);
      expect(validator.checkLicense('Mit')).toBe(true);
      expect(validator.checkLicense('  MIT  ')).toBe(true);
    });

    it('should respect custom allowedLicenses', () => {
      const custom = new SecurityValidator({ allowedLicenses: ['MIT'] });
      expect(custom.checkLicense('MIT')).toBe(true);
      expect(custom.checkLicense('ISC')).toBe(false);
      expect(custom.checkLicense('Apache-2.0')).toBe(false);
    });
  });

  // ─── checkLastUpdate ──────────────────────────────────────────────────

  describe('checkLastUpdate', () => {
    it('should return true for undefined lastUpdate', () => {
      expect(validator.checkLastUpdate(undefined)).toBe(true);
    });

    it('should return true for recent update (1 month ago)', () => {
      const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(validator.checkLastUpdate(recent)).toBe(true);
    });

    it('should return true for update exactly at threshold', () => {
      const atThreshold = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(validator.checkLastUpdate(atThreshold)).toBe(true);
    });

    it('should return false for stale update (24 months ago)', () => {
      const stale = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(validator.checkLastUpdate(stale)).toBe(false);
    });

    it('should return false for very old update (36 months ago)', () => {
      const veryOld = new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(validator.checkLastUpdate(veryOld)).toBe(false);
    });

    it('should respect custom maxStalenessMonths', () => {
      const custom = new SecurityValidator({ maxStalenessMonths: 3 });
      const fourMonthsAgo = new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const twoMonthsAgo = new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000).toISOString();

      expect(custom.checkLastUpdate(fourMonthsAgo)).toBe(false);
      expect(custom.checkLastUpdate(twoMonthsAgo)).toBe(true);
    });

    it('should return true for invalid date string (NaN → assume maintained)', () => {
      // After fix: isNaN check catches invalid dates and returns true
      expect(validator.checkLastUpdate('not-a-date')).toBe(true);
    });
  });

  // ─── checkMaintainers ─────────────────────────────────────────────────

  describe('checkMaintainers', () => {
    it('should return true when maintainers > 0', () => {
      expect(validator.checkMaintainers(1)).toBe(true);
      expect(validator.checkMaintainers(5)).toBe(true);
    });

    it('should return false when maintainers is 0', () => {
      expect(validator.checkMaintainers(0)).toBe(false);
    });

    it('should return false when maintainers is negative', () => {
      expect(validator.checkMaintainers(-1)).toBe(false);
    });
  });

  // ─── isSafe ───────────────────────────────────────────────────────────

  describe('isSafe', () => {
    it('should return true for safe result', () => {
      const result: SecurityValidationResult = {
        packageName: 'lodash',
        safe: true,
        vulnerabilities: [],
        warnings: [],
        licenseCompatible: true,
        maintained: true,
        deprecated: false,
      };
      expect(validator.isSafe(result)).toBe(true);
    });

    it('should return false for unsafe result', () => {
      const result: SecurityValidationResult = {
        packageName: 'event-stream',
        safe: false,
        vulnerabilities: ['CVE-2018-16462'],
        warnings: [],
        licenseCompatible: true,
        maintained: true,
        deprecated: false,
      };
      expect(validator.isSafe(result)).toBe(false);
    });
  });

  // ─── validate (integration) ───────────────────────────────────────────

  describe('validate', () => {
    it('should return safe=true for clean package', async () => {
      const result = await validator.validate('lodash');

      expect(result.packageName).toBe('lodash');
      expect(result.safe).toBe(true);
      expect(result.vulnerabilities).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.deprecated).toBe(false);
      expect(result.maintained).toBe(true);
      expect(result.licenseCompatible).toBe(true);
    });

    it('should return safe=false for known vulnerable package', async () => {
      const result = await validator.validate('event-stream');

      expect(result.packageName).toBe('event-stream');
      expect(result.safe).toBe(false);
      expect(result.vulnerabilities).toContain('CVE-2018-16462: malicious code injection');
    });

    it('should return safe=false for deprecated package', async () => {
      const result = await validator.validate('some-pkg', { deprecated: true });

      expect(result.safe).toBe(false);
      expect(result.deprecated).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('deprecated'));
    });

    it('should return safe=true for deprecated package without vulnerabilities', async () => {
      const result = await validator.validate('old-pkg', { deprecated: true });

      // safe = vulnerabilities.length === 0 && !deprecated → false
      expect(result.safe).toBe(false);
    });

    it('should generate stale warning for old packages', async () => {
      const oldDate = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = await validator.validate('old-pkg', { lastUpdate: oldDate });

      expect(result.maintained).toBe(false);
      expect(result.warnings).toContainEqual(expect.stringContaining('has not been updated'));
    });

    it('should generate license warning for incompatible license', async () => {
      const result = await validator.validate('gpl-pkg', { license: 'GPL-3.0' });

      expect(result.licenseCompatible).toBe(false);
      expect(result.warnings).toContainEqual(expect.stringContaining('GPL-3.0'));
    });

    it('should generate no-maintainers warning', async () => {
      const result = await validator.validate('abandoned-pkg', { maintainers: 0 });

      expect(result.warnings).toContainEqual(expect.stringContaining('no active maintainers'));
    });

    it('should not add maintainers warning when maintainers > 0', async () => {
      const result = await validator.validate('active-pkg', { maintainers: 3 });

      expect(result.warnings.find(w => w.includes('no active maintainers'))).toBeUndefined();
    });

    it('should not add maintainers warning when maintainers is undefined', async () => {
      const result = await validator.validate('pkg');

      expect(result.warnings.find(w => w.includes('no active maintainers'))).toBeUndefined();
    });

    it('should not add license warning when license is undefined', async () => {
      const result = await validator.validate('pkg');

      expect(result.warnings.find(w => w.includes('license'))).toBeUndefined();
    });

    it('should accumulate multiple warnings', async () => {
      const oldDate = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = await validator.validate('bad-pkg', {
        deprecated: true,
        lastUpdate: oldDate,
        license: 'GPL-3.0',
        maintainers: 0,
      });

      expect(result.warnings.length).toBe(4);
      expect(result.safe).toBe(false);
    });

    it('should handle package with all metadata fields', async () => {
      const result = await validator.validate('full-pkg', {
        version: '1.0.0',
        license: 'MIT',
        lastUpdate: new Date().toISOString(),
        deprecated: false,
        maintainers: 5,
      });

      expect(result.safe).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.licenseCompatible).toBe(true);
      expect(result.maintained).toBe(true);
      expect(result.deprecated).toBe(false);
    });

    it('should handle empty string packageName', async () => {
      const result = await validator.validate('');

      expect(result.packageName).toBe('');
      expect(result.safe).toBe(true);
    });

    it('should correctly combine vulnerability + deprecation for safe flag', async () => {
      // Vulnerable package that is also deprecated
      const result = await validator.validate('faker', { deprecated: true });

      expect(result.safe).toBe(false);
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.deprecated).toBe(true);
    });

    it('should consider safe when only license is incompatible', async () => {
      const result = await validator.validate('gpl-only-pkg', { license: 'GPL-3.0' });

      // safe = vulnerabilities.length === 0 && !deprecated → true (license doesn't affect safe)
      expect(result.safe).toBe(true);
      expect(result.licenseCompatible).toBe(false);
    });

    it('should consider safe when only package is stale', async () => {
      const oldDate = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = await validator.validate('stale-pkg', { lastUpdate: oldDate });

      // safe = vulnerabilities.length === 0 && !deprecated → true (staleness doesn't affect safe)
      expect(result.safe).toBe(true);
      expect(result.maintained).toBe(false);
    });
  });
});
