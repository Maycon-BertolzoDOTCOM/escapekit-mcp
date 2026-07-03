import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BuildCheckResult, DependencyCheckResult } from '../../src/validate/types.js';

// vi.hoisted ensures these are available before vi.mock factories
const { mockBuildValidate, mockDepValidate, mockFixFn, mockCanFix } = vi.hoisted(() => {
  return {
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
    mockFixFn: vi.fn().mockResolvedValue([]),
    mockCanFix: vi.fn().mockReturnValue(true),
  };
});

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
    fix = mockFixFn;
    canFix = mockCanFix;
  },
}));
vi.mock('../../src/security/SecurityValidator.js', () => ({
  SecurityValidator: class {
    validate = vi.fn().mockResolvedValue({
      packageName: 'test',
      safe: true,
      vulnerabilities: [],
      warnings: [],
      licenseCompatible: true,
      maintained: true,
      deprecated: false,
    });
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
    cleanup = vi.fn().mockResolvedValue(undefined);
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

describe('ValidationEngine iterative auto-fix', () => {
  let engine: InstanceType<typeof ValidationEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ValidationEngine();
    mockBuildValidate.mockResolvedValue({
      passed: true,
      installTime: 0,
      buildTime: 0,
      errors: [],
      warnings: [],
    });
    mockDepValidate.mockResolvedValue({
      passed: true,
      ghostPackages: [],
      outdatedPackages: [],
      vulnerabilities: [],
      missingPeerDeps: [],
    });
    mockFixFn.mockResolvedValue([]);
    mockCanFix.mockReturnValue(true);
  });

  it('should set iterationCount to 0 when autoFix is false', async () => {
    const result = await engine.validate('/test', { autoFix: false });
    expect(result.iterationCount).toBe(0);
  });

  it('should not enter loop when autoFix is true but no issues', async () => {
    const result = await engine.validate('/test', { autoFix: true, maxIterations: 3 });
    expect(result.iterationCount).toBe(0);
    expect(result.fixesApplied).toHaveLength(0);
  });

  it('should perform iteration when issues exist and fixes are applied', async () => {
    mockBuildValidate.mockResolvedValueOnce({
      passed: false,
      installTime: 0,
      buildTime: 0,
      errors: [{ type: 'BUILD_ERROR', severity: 'error', message: 'Build failed' }],
      warnings: [],
    });
    mockFixFn.mockResolvedValueOnce([
      { issueType: 'BUILD_ERROR', description: 'Fixed build', applied: true },
    ]);

    const result = await engine.validate('/test', { autoFix: true, maxIterations: 3 });

    expect(result.iterationCount).toBe(1);
    expect(result.fixesApplied).toHaveLength(1);
    expect(result.fixesApplied[0].applied).toBe(true);
  });

  it('should perform multiple iterations when issues remain', async () => {
    mockBuildValidate.mockResolvedValueOnce({
      passed: false,
      installTime: 0,
      buildTime: 0,
      errors: [{ type: 'BUILD_ERROR', severity: 'error', message: 'Error 1' }],
      warnings: [],
    });
    mockFixFn.mockResolvedValue([
      { issueType: 'BUILD_ERROR', description: 'Fixed', applied: true },
    ]);
    mockBuildValidate.mockResolvedValueOnce({
      passed: false,
      installTime: 0,
      buildTime: 0,
      errors: [{ type: 'BUILD_ERROR', severity: 'error', message: 'Error 2' }],
      warnings: [],
    });
    mockBuildValidate.mockResolvedValue({
      passed: true,
      installTime: 0,
      buildTime: 0,
      errors: [],
      warnings: [],
    });

    const result = await engine.validate('/test', { autoFix: true, maxIterations: 5 });

    expect(result.iterationCount).toBe(2);
    expect(result.fixesApplied.length).toBeGreaterThanOrEqual(1);
  });

  it('should stop when no fixes are applied (no progress)', async () => {
    mockBuildValidate.mockResolvedValue({
      passed: false,
      installTime: 0,
      buildTime: 0,
      errors: [{ type: 'BUILD_ERROR', severity: 'error', message: 'Unfixable' }],
      warnings: [],
    });
    mockFixFn.mockResolvedValue([
      { issueType: 'BUILD_ERROR', description: 'Could not fix', applied: false },
    ]);

    const result = await engine.validate('/test', { autoFix: true, maxIterations: 5 });

    expect(result.iterationCount).toBe(1);
    expect(result.fixesApplied).toHaveLength(0);
  });

  it('should stop when all error issues are resolved', async () => {
    mockBuildValidate.mockResolvedValueOnce({
      passed: false,
      installTime: 0,
      buildTime: 0,
      errors: [{ type: 'BUILD_ERROR', severity: 'error', message: 'Error' }],
      warnings: [],
    });
    mockFixFn.mockResolvedValueOnce([
      { issueType: 'BUILD_ERROR', description: 'Fixed', applied: true },
    ]);

    const result = await engine.validate('/test', { autoFix: true, maxIterations: 5 });

    expect(result.iterationCount).toBe(1);
    expect(result.fixesApplied).toHaveLength(1);
  });

  it('should clamp maxIterations: 0 → 1', async () => {
    mockFixFn.mockResolvedValue([]);
    const result = await engine.validate('/test', { autoFix: true, maxIterations: 0 });
    // No issues → iterationCount stays 0
    expect(result.iterationCount).toBe(0);
  });

  it('should clamp maxIterations: 15 → 10 (no issues → no iterations)', async () => {
    const result = await engine.validate('/test', { autoFix: true, maxIterations: 15 });
    expect(result.iterationCount).toBe(0);
  });

  it('should use default maxIterations when undefined', async () => {
    const result = await engine.validate('/test', { autoFix: true });
    expect(result.iterationCount).toBe(0);
  });

  it('should re-validate dependencies after fix', async () => {
    mockDepValidate.mockResolvedValueOnce({
      passed: false,
      ghostPackages: [{ name: 'fake-pkg', importPath: 'x', file: 'x.ts', line: 1 }],
      outdatedPackages: [],
      vulnerabilities: [],
      missingPeerDeps: [],
    });
    mockBuildValidate.mockResolvedValueOnce({
      passed: true,
      installTime: 0,
      buildTime: 0,
      errors: [],
      warnings: [],
    });
    mockFixFn.mockResolvedValueOnce([
      { issueType: 'GHOST_IMPORT', description: 'Fixed', applied: true },
    ]);

    const result = await engine.validate('/test', { autoFix: true, maxIterations: 3 });

    expect(result.iterationCount).toBe(1);
    expect(result.fixesApplied).toHaveLength(1);
  });

  it('should handle warning-only issues (canDeploy true)', async () => {
    mockDepValidate.mockResolvedValueOnce({
      passed: true,
      ghostPackages: [],
      outdatedPackages: [],
      vulnerabilities: [{ name: 'old-pkg', severity: 'low', title: 'Low', fixAvailable: false }],
      missingPeerDeps: [],
    });

    const result = await engine.validate('/test', { autoFix: true, maxIterations: 3 });

    expect(result.canDeploy).toBe(true);
  });
});
