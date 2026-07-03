import { vi, describe, it, expect, beforeEach } from 'vitest';
import type {
  BuildCheckResult,
  DependencyCheckResult,
  WebGLCheckResult,
} from '../../src/validate/types.js';

const { mockBuildValidate, mockDepValidate, mockWebGLValidate, mockEnvTest, mockEnvCleanup } =
  vi.hoisted(() => ({
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
    mockWebGLValidate: vi.fn<(url: string) => Promise<WebGLCheckResult>>(),
    mockEnvTest: vi.fn(),
    mockEnvCleanup: vi.fn().mockResolvedValue(undefined),
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
    validate = mockWebGLValidate;
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
    test = mockEnvTest;
    cleanup = mockEnvCleanup;
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

describe('ValidationEngine WebGL Integration', () => {
  let engine: InstanceType<typeof ValidationEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ValidationEngine();
    mockEnvTest.mockResolvedValue({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
    });
    mockWebGLValidate.mockResolvedValue({
      passed: true,
      hasCanvas: true,
      hasWebGL: true,
      hasWebGL2: false,
      fallbackApplied: false,
      jsErrors: [],
      loadTimeMs: 100,
    });
  });

  it('P1 — thorough + detectedUrl → checks.webgl defined', async () => {
    mockEnvTest.mockResolvedValueOnce({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
      detectedUrl: 'http://localhost:3000',
    });

    const result = await engine.validate('/test', { level: 'thorough', environment: 'local' });

    expect(result.checks.webgl).toBeDefined();
    expect(mockWebGLValidate).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('P2 — WebGL failed with jsErrors → canDeploy false', async () => {
    mockEnvTest.mockResolvedValueOnce({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
      detectedUrl: 'http://localhost:3000',
    });
    mockWebGLValidate.mockResolvedValueOnce({
      passed: false,
      hasCanvas: true,
      hasWebGL: false,
      hasWebGL2: false,
      fallbackApplied: false,
      jsErrors: ['WebGL not supported'],
      loadTimeMs: 100,
    });

    const result = await engine.validate('/test', { level: 'thorough', environment: 'local' });

    expect(result.canDeploy).toBe(false);
    expect(result.remainingIssues).toContainEqual(
      expect.objectContaining({
        type: 'WEBGL_ERROR',
        severity: 'error',
        message: 'WebGL not supported',
      })
    );
  });

  it('P3 — basic → checks.webgl undefined', async () => {
    const result = await engine.validate('/test', { level: 'basic' });
    expect(result.checks.webgl).toBeUndefined();
    expect(mockWebGLValidate).not.toHaveBeenCalled();
  });

  it('P3b — standard → checks.webgl undefined', async () => {
    const result = await engine.validate('/test', { level: 'standard', environment: 'local' });
    expect(result.checks.webgl).toBeUndefined();
    expect(mockWebGLValidate).not.toHaveBeenCalled();
  });

  it('P4 — WebGL passed with jsErrors (Playwright missing) → no issue', async () => {
    mockEnvTest.mockResolvedValueOnce({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
      detectedUrl: 'http://localhost:3000',
    });
    mockWebGLValidate.mockResolvedValueOnce({
      passed: true,
      hasCanvas: true,
      hasWebGL: true,
      hasWebGL2: false,
      fallbackApplied: false,
      jsErrors: ['Playwright not installed - WebGL check skipped'],
      loadTimeMs: 100,
    });

    const result = await engine.validate('/test', { level: 'thorough', environment: 'local' });

    expect(result.canDeploy).toBe(true);
    expect(result.remainingIssues.find(i => i.type === 'WEBGL_ERROR')).toBeUndefined();
  });

  it('P5 — thorough without URL → checks.webgl undefined', async () => {
    mockEnvTest.mockResolvedValueOnce({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
      detectedUrl: undefined,
    });

    const result = await engine.validate('/test', { level: 'thorough', environment: 'local' });

    expect(result.checks.webgl).toBeUndefined();
    expect(mockWebGLValidate).not.toHaveBeenCalled();
  });

  it('P6 — URL fallback from logs', async () => {
    mockEnvTest.mockResolvedValueOnce({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: ['[local] http://localhost:5173 ready'],
      detectedUrl: undefined,
    });

    const result = await engine.validate('/test', { level: 'thorough', environment: 'local' });

    expect(result.checks.webgl).toBeDefined();
    expect(mockWebGLValidate).toHaveBeenCalledWith('http://localhost:5173');
  });

  it('P7 — WebGLValidator exception → caught, no crash', async () => {
    mockEnvTest.mockResolvedValueOnce({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
      detectedUrl: 'http://localhost:3000',
    });
    mockWebGLValidate.mockRejectedValueOnce(new Error('timeout'));

    const result = await engine.validate('/test', { level: 'thorough', environment: 'local' });

    expect(result.checks.webgl).toBeUndefined();
    expect(result.canDeploy).toBe(true);
  });

  it('P8 — WebGL passed → no WEBGL_ERROR issue', async () => {
    mockEnvTest.mockResolvedValueOnce({
      name: 'local',
      passed: true,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
      detectedUrl: 'http://localhost:3000',
    });

    const result = await engine.validate('/test', { level: 'thorough', environment: 'local' });

    expect(result.canDeploy).toBe(true);
    expect(result.remainingIssues.find(i => i.type === 'WEBGL_ERROR')).toBeUndefined();
  });

  it('P9 — environment test failed → BUILD_ERROR issue', async () => {
    mockEnvTest.mockResolvedValueOnce({
      name: 'local',
      passed: false,
      startupTimeMs: 5000,
      healthChecks: [],
      apiTests: [],
      logs: [],
      error: 'server did not start',
    });

    const result = await engine.validate('/test', { level: 'standard', environment: 'local' });

    expect(result.remainingIssues).toContainEqual(
      expect.objectContaining({ type: 'BUILD_ERROR', severity: 'error' })
    );
  });

  it('P10 — cleanup always called', async () => {
    const result = await engine.validate('/test', { level: 'standard', environment: 'local' });
    expect(mockEnvCleanup).toHaveBeenCalled();
  });
});
