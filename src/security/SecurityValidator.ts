/**
 * SecurityValidator - Package security validation (自主创新)
 * Validates packages against known CVEs, deprecation, license, and maintenance status.
 */
import { logger } from '../logger.js';

export interface SecurityValidationResult {
  packageName: string;
  safe: boolean;
  vulnerabilities: string[];
  warnings: string[];
  licenseCompatible: boolean;
  maintained: boolean;
  deprecated: boolean;
}

export interface SecurityValidatorOptions {
  /** Max months since last update before warning (default: 12) */
  maxStalenessMonths?: number;
  /** Allowed licenses (default: permissive list) */
  allowedLicenses?: string[];
}

export class SecurityValidator {
  private readonly log = logger.child('SecurityValidator');
  private readonly options: Required<SecurityValidatorOptions>;

  // Known CVE patterns (simplified - in production would use a real CVE database)
  private readonly knownVulnerablePackages = new Map<string, string[]>([
    ['event-stream', ['CVE-2018-16462: malicious code injection']],
    ['flatmap-stream', ['CVE-2018-16462: malicious payload']],
    ['ua-parser-js', ['CVE-2021-27292: ReDoS vulnerability']],
    ['node-ipc', ['CVE-2022-23812: protestware - destructive payload']],
    ['colors', ['CVE-2022-0355: protestware - infinite loop']],
    ['faker', ['CVE-2022-0355: protestware - data corruption']],
  ]);

  private readonly defaultAllowedLicenses = [
    'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0',
    '0BSD', 'CC0-1.0', 'Unlicense', 'WTFPL',
  ];

  constructor(options: SecurityValidatorOptions = {}) {
    this.options = {
      maxStalenessMonths: options.maxStalenessMonths ?? 12,
      allowedLicenses: options.allowedLicenses ?? this.defaultAllowedLicenses,
    };
  }

  /** Full security validation of a package */
  async validate(packageName: string, metadata?: {
    version?: string;
    license?: string;
    lastUpdate?: string;
    deprecated?: boolean;
    maintainers?: number;
  }): Promise<SecurityValidationResult> {
    this.log.debug('Validating package security', { packageName });

    const vulnerabilities = this.checkVulnerabilities(packageName);
    const deprecated = this.checkDeprecation(packageName, metadata?.deprecated);
    const licenseCompatible = this.checkLicense(metadata?.license);
    const maintained = this.checkLastUpdate(metadata?.lastUpdate);
    const warnings: string[] = [];

    if (deprecated) warnings.push(`Package "${packageName}" is deprecated`);
    if (!maintained) warnings.push(`Package "${packageName}" has not been updated in >${this.options.maxStalenessMonths} months`);
    if (!licenseCompatible && metadata?.license) {
      warnings.push(`License "${metadata.license}" may not be compatible`);
    }
    if (metadata?.maintainers !== undefined && metadata.maintainers === 0) {
      warnings.push(`Package "${packageName}" has no active maintainers`);
    }

    const safe = vulnerabilities.length === 0 && !deprecated;

    this.log.info('Security validation complete', { packageName, safe, vulnerabilities: vulnerabilities.length });

    return { packageName, safe, vulnerabilities, warnings, licenseCompatible, maintained, deprecated };
  }

  /** Check for known CVE vulnerabilities */
  checkVulnerabilities(packageName: string): string[] {
    return this.knownVulnerablePackages.get(packageName) ?? [];
  }

  /** Check if package is deprecated */
  checkDeprecation(_packageName: string, deprecated?: boolean): boolean {
    return deprecated === true;
  }

  /** Check license compatibility */
  checkLicense(license?: string): boolean {
    if (!license) return true; // Unknown license - assume compatible
    const normalized = license.trim().toUpperCase();
    return this.options.allowedLicenses.some(l => l.toUpperCase() === normalized);
  }

  /** Check maintenance status based on last update date */
  checkLastUpdate(lastUpdate?: string): boolean {
    if (!lastUpdate) return true; // Unknown - assume maintained
    try {
      const updateDate = new Date(lastUpdate);
      const monthsOld = (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsOld <= this.options.maxStalenessMonths;
    } catch {
      return true;
    }
  }

  /** Check maintainer count */
  checkMaintainers(maintainerCount: number): boolean {
    return maintainerCount > 0;
  }

  /** Determine if package is safe to use */
  isSafe(result: SecurityValidationResult): boolean {
    return result.safe;
  }
}
