import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BuildCheckResult, DependencyCheckResult } from '../../src/validate/types.js';
import type { SecurityValidationResult } from '../../src/security/SecurityValidator.js';

const { mockBuildValidate, mockDepValidate, mockSecValidate, mockReadFile } = vi.hoisted(() => ({
  mockBuildValidate: vi.fn<(p?: string) => Promise<BuildCheckResult>>().mockResolvedValue({
    passed: true,
    installTime: 0,
    buildTime: 0,
    errors: [],
    warnings: [],
  }),
  mockDepValidate: vi.fn<(p?: string) => Promise<DependencyCheckResult>>().mockResolvedValue({
    passed: true,
    ghostPackages: [],
    outdatedPackages: [],
    vulnerabilities: [],
    missingPeerDeps: [],
  }),
  mockSecValidate: vi.fn<(pkg: string) => Promise<SecurityValidationResult>>(),
  mockReadFile: vi.fn<(path: string, enc: string) => Promise<string>>(),
}));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  access: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock('../../src/validate/validators/BuildValidator.js', () => ({
  BuildValidator: class {
    validate = mockBuildValidate;
  },
}));
vi.mock('../../src/validate/validators/DependencyValidator.js', () => ({
  DependencyValidator: class {
    validate = mockDepValidate;
  },
}));
vi.mock('../../src/validate/validators/WebGLValidator.js', () => ({
  WebGLValidator: class {
    validate = vi.fn();
  },
}));
vi.mock('../../src/validate/auto-fix/AutoFixEngine.js', () => ({
  AutoFixEngine: class {
    fix = vi.fn().mockResolvedValue([]);
    canFix = vi.fn().mockReturnValue(true);
  },
}));
vi.mock('../../src/security/SecurityValidator.js', () => ({
  SecurityValidator: class {
    validate = mockSecValidate;
  },
}));
vi.mock('../../src/validate/environments/LocalEnvironment.js', () => ({
  LocalEnvironment: class {
    name = 'local';
    test = vi.fn().mockResolvedValue({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
    });
    cleanup = vi.fn().mockResolvedValue(undefined);
  },
}));
vi.mock('../../src/validate/environments/DockerEnvironment.js', () => ({
  DockerEnvironment: class {
    name = 'docker';
    test = vi.fn();
    cleanup = vi.fn();
  },
}));
vi.mock('../../src/logger.js', () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { ValidationEngine } = await import('../../src/validate/ValidationEngine.js');

function safeResult(pkg: string): SecurityValidationResult {
  return {
    packageName: pkg,
    safe: true,
    vulnerabilities: [],
    warnings: [],
    licenseCompatible: true,
    maintained: true,
    deprecated: false,
  };
}

describe('ValidationEngine security validation', () => {
  let engine: InstanceType<typeof ValidationEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ValidationEngine();
    mockReadFile.mockResolvedValue(JSON.stringify({ dependencies: {}, devDependencies: {} }));
    mockSecValidate.mockImplementation(async (pkg: string) => safeResult(pkg));
  });

  it('P1 — event-stream → checks.security.passed === false', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { 'event-stream': '^3.3.4' }, devDependencies: {} })
    );
    mockSecValidate.mockImplementation(async (pkg: string) =>
      pkg === 'event-stream'
        ? { ...safeResult(pkg), safe: false, vulnerabilities: ['CVE-2018-16462'] }
        : safeResult(pkg)
    );

    const result = await engine.validate('/test/path');

    expect(result.checks.security?.passed).toBe(false);
    expect(result.checks.security?.vulnerablePackages).toContain('event-stream');
  });

  it('P2 — event-stream → canDeploy === false', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { 'event-stream': '^3.3.4' }, devDependencies: {} })
    );
    mockSecValidate.mockImplementation(async (pkg: string) =>
      pkg === 'event-stream'
        ? { ...safeResult(pkg), safe: false, vulnerabilities: ['CVE-2018-16462'] }
        : safeResult(pkg)
    );

    const result = await engine.validate('/test/path');

    expect(result.canDeploy).toBe(false);
    expect(result.remainingIssues).toContainEqual(
      expect.objectContaining({ type: 'SECURITY_VULNERABILITY', severity: 'error' })
    );
  });

  it('P3 — no vulnerable packages → passed === true', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { lodash: '^4.17.21' }, devDependencies: {} })
    );

    const result = await engine.validate('/test/path');

    expect(result.checks.security?.passed).toBe(true);
    expect(result.remainingIssues.find(i => i.type === 'SECURITY_VULNERABILITY')).toBeUndefined();
  });

  it('P4 — checks.security defined at all levels', async () => {
    const basic = await engine.validate('/test/path', { level: 'basic' });
    const standard = await engine.validate('/test/path', { level: 'standard' });
    const thorough = await engine.validate('/test/path', { level: 'thorough' });

    expect(basic.checks.security).toBeDefined();
    expect(standard.checks.security).toBeDefined();
    expect(thorough.checks.security).toBeDefined();
  });

  it('P5 — package with warning → severity warning, canDeploy true', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { 'old-pkg': '^1.0.0' }, devDependencies: {} })
    );
    mockSecValidate.mockImplementation(async (pkg: string) => ({
      ...safeResult(pkg),
      warnings: ['deprecated'],
      deprecated: true,
      maintained: false,
    }));

    const result = await engine.validate('/test/path');

    expect(result.canDeploy).toBe(true);
    expect(result.remainingIssues).toContainEqual(
      expect.objectContaining({ type: 'SECURITY_WARNING', severity: 'warning' })
    );
  });

  it('Deduplicates packages', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { 'dup-pkg': '^1.0.0' }, devDependencies: {} })
    );
    mockDepValidate.mockResolvedValueOnce({
      passed: true,
      ghostPackages: [{ name: 'dup-pkg', importPath: 'x', file: 'x.ts', line: 1 }],
      outdatedPackages: [],
      vulnerabilities: [],
      missingPeerDeps: [],
    });

    await engine.validate('/test/path');

    const calls = mockSecValidate.mock.calls.filter(c => c[0] === 'dup-pkg');
    expect(calls).toHaveLength(1);
  });

  it('Continues when package.json is missing', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    mockDepValidate.mockResolvedValueOnce({
      passed: true,
      ghostPackages: [{ name: 'ghost-pkg', importPath: 'x', file: 'x.ts', line: 1 }],
      outdatedPackages: [],
      vulnerabilities: [],
      missingPeerDeps: [],
    });

    const result = await engine.validate('/test/path');

    expect(result.checks.security).toBeDefined();
    expect(mockSecValidate).toHaveBeenCalledWith('ghost-pkg');
  });

  it('Handles per-package exceptions gracefully', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { 'pkg-a': '^1.0.0', 'pkg-b': '^2.0.0' },
        devDependencies: {},
      })
    );
    mockSecValidate.mockImplementation(async (pkg: string) => {
      if (pkg === 'pkg-a') throw new Error('timeout');
      return safeResult(pkg);
    });

    const result = await engine.validate('/test/path');

    // pkg-a threw, pkg-b succeeded
    const names = result.checks.security?.packageResults.map(r => r.packageName);
    expect(names).toContain('pkg-b');
    expect(names).not.toContain('pkg-a');
  });

  it('Handles empty package list', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ dependencies: {}, devDependencies: {} }));

    const result = await engine.validate('/test/path');

    expect(result.checks.security?.passed).toBe(true);
    expect(result.checks.security?.packageResults).toEqual([]);
  });

  it('Populates licenseIssues', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { 'gpl-pkg': '^1.0.0' }, devDependencies: {} })
    );
    mockSecValidate.mockImplementation(async (pkg: string) => ({
      ...safeResult(pkg),
      warnings: ['GPL license'],
      licenseCompatible: false,
    }));

    const result = await engine.validate('/test/path');

    expect(result.checks.security?.licenseIssues).toContain('gpl-pkg');
  });

  it('collectPackageNames includes devDependencies', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ dependencies: { react: '^18' }, devDependencies: { vitest: '^1' } })
    );

    await engine.validate('/test/path');

    expect(mockSecValidate).toHaveBeenCalledWith('react');
    expect(mockSecValidate).toHaveBeenCalledWith('vitest');
  });

  it('collectPackageNames includes vulnerabilities', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ dependencies: {}, devDependencies: {} }));
    mockDepValidate.mockResolvedValue({
      passed: true,
      ghostPackages: [],
      outdatedPackages: [],
      vulnerabilities: [{ name: 'vuln-pkg', severity: 'high', title: 'x', fixAvailable: false }],
      missingPeerDeps: [],
    });

    await engine.validate('/test/path');

    expect(mockSecValidate).toHaveBeenCalledWith('vuln-pkg');
  });
});
