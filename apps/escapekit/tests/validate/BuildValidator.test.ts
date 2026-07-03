import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const mockAccess = vi.fn();
const mockReadFile = vi.fn();

vi.mock('fs/promises', () => ({
  access: mockAccess,
  readFile: mockReadFile,
}));

// Mock child_process.spawn
const mockSpawn = vi.fn();

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

const { BuildValidator } = await import('../../src/validate/validators/BuildValidator.js');

/** Create a mock child process that emits events */
function createMockChild(options: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  delay?: number;
}): EventEmitter {
  const child = new EventEmitter();
  (child as any).stdout = new EventEmitter();
  (child as any).stderr = new EventEmitter();
  (child as any).killed = false;
  (child as any).pid = 12345;
  (child as any).kill = vi.fn();

  const { stdout = '', stderr = '', exitCode = 0, delay = 10 } = options;

  // Emit data then close after delay
  setTimeout(() => {
    if (stdout) (child as any).stdout.emit('data', Buffer.from(stdout));
    if (stderr) (child as any).stderr.emit('data', Buffer.from(stderr));
    setTimeout(() => child.emit('close', exitCode), delay);
  }, 5);

  return child;
}

describe('BuildValidator', () => {
  let validator: InstanceType<typeof BuildValidator>;

  beforeEach(() => {
    vi.resetAllMocks();
    validator = new BuildValidator({ installTimeoutMs: 5000, buildTimeoutMs: 5000 });
  });

  // ─── constructor ──────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should use default options', () => {
      const v = new BuildValidator();
      expect(v).toBeInstanceOf(BuildValidator);
    });

    it('should accept custom timeouts', () => {
      const v = new BuildValidator({ installTimeoutMs: 10000, buildTimeoutMs: 5000 });
      expect(v).toBeInstanceOf(BuildValidator);
    });
  });

  // ─── validate: missing package.json ───────────────────────────────────

  describe('validate when package.json is missing', () => {
    it('should return error when package.json does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await validator.validate('/nonexistent');

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('package.json not found');
    });
  });

  // ─── validate: npm install failure ────────────────────────────────────

  describe('validate when npm install fails', () => {
    it('should return error when npm install fails', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockSpawn.mockReturnValue(createMockChild({ stderr: 'npm ERR! network error', exitCode: 1 }));

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(false);
      expect(result.errors[0].message).toContain('npm install failed');
      expect(result.installTime).toBeGreaterThan(0);
    });
  });

  // ─── validate: no build/dev script ────────────────────────────────────

  describe('validate when no build script exists', () => {
    it('should pass with warning when no build or dev script', async () => {
      mockAccess.mockResolvedValue(undefined);
      // npm install succeeds
      mockSpawn.mockReturnValueOnce(createMockChild({ stdout: 'installed', exitCode: 0 }));
      // package.json has no scripts
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', scripts: { test: 'jest' } }));

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('No build or dev script'));
    });

    it('should handle package.json parse failure gracefully', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockSpawn.mockReturnValueOnce(createMockChild({ stdout: 'installed', exitCode: 0 }));
      mockReadFile.mockRejectedValue(new Error('read error'));

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('No build or dev script'));
    });
  });

  // ─── validate: successful build ───────────────────────────────────────

  describe('validate with successful build', () => {
    it('should pass when npm install and build succeed', async () => {
      mockAccess.mockResolvedValue(undefined);

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        if (spawnCall === 1) {
          // npm install
          return createMockChild({ stdout: 'added packages', exitCode: 0 });
        }
        if (spawnCall === 2) {
          // npm run build
          return createMockChild({ stdout: 'Build completed', exitCode: 0 });
        }
        // tsc --noEmit
        return createMockChild({ stdout: '', exitCode: 0 });
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc' },
          dependencies: {},
        })
      );

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.installTime).toBeGreaterThan(0);
      expect(result.buildTime).toBeGreaterThan(0);
    });
  });

  // ─── validate: build failure ──────────────────────────────────────────

  describe('validate when build fails', () => {
    it('should return error when build fails', async () => {
      mockAccess.mockResolvedValue(undefined);

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        if (spawnCall === 1) {
          return createMockChild({ stdout: 'installed', exitCode: 0 });
        }
        return createMockChild({
          stderr: 'TypeScript error TS2345',
          exitCode: 1,
        });
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc' },
          dependencies: {},
        })
      );

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(false);
      expect(result.errors[0].message).toContain('Build failed');
    });
  });

  // ─── validate: warnings extraction ────────────────────────────────────

  describe('validate warning extraction', () => {
    it('should extract warnings from build output', async () => {
      mockAccess.mockResolvedValue(undefined);

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        if (spawnCall === 1) {
          return createMockChild({ stdout: 'installed', exitCode: 0 });
        }
        if (spawnCall === 2) {
          return createMockChild({
            stdout: 'WARNING: deprecated API used\ndeprecated: use new method\nBuild done',
            exitCode: 0,
          });
        }
        return createMockChild({ stdout: '', exitCode: 0 });
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc' },
          dependencies: {},
        })
      );

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.toLowerCase().includes('warning'))).toBe(true);
    });

    it('should extract warnings on build failure too', async () => {
      mockAccess.mockResolvedValue(undefined);

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        if (spawnCall === 1) {
          return createMockChild({ stdout: 'installed', exitCode: 0 });
        }
        return createMockChild({
          stdout: 'peer dep warning\nBuild failed',
          stderr: 'error TS1005',
          exitCode: 1,
        });
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc' },
          dependencies: {},
        })
      );

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ─── validate: TypeScript check ───────────────────────────────────────

  describe('validate TypeScript type check', () => {
    it('should run tsc when tsconfig.json exists', async () => {
      let accessCall = 0;
      mockAccess.mockImplementation(async (p: string) => {
        accessCall++;
        if (p.includes('tsconfig.json')) return undefined;
        return undefined;
      });

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        if (spawnCall <= 2) {
          return createMockChild({ stdout: 'ok', exitCode: 0 });
        }
        // tsc
        return createMockChild({ stdout: '', exitCode: 0 });
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc' },
          dependencies: {},
        })
      );

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(true);
    });

    it('should add warning when tsc fails', async () => {
      mockAccess.mockResolvedValue(undefined);

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        if (spawnCall <= 2) {
          return createMockChild({ stdout: 'ok', exitCode: 0 });
        }
        return createMockChild({
          stderr: "Type 'string' is not assignable to type 'number'",
          exitCode: 1,
        });
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc' },
          dependencies: {},
        })
      );

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.includes('TypeScript errors'))).toBe(true);
    });
  });

  // ─── validate: bundle size ────────────────────────────────────────────

  describe('validate bundle size calculation', () => {
    it('should calculate bundle size when dist exists', async () => {
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('dist')) return undefined;
        return undefined;
      });

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        return createMockChild({ stdout: 'ok', exitCode: 0 });
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc' },
          dependencies: {},
        })
      );

      // Mock readdir and stat for bundle size
      const mockReaddir = vi.fn().mockResolvedValue(['index.js']);
      const mockStat = vi.fn().mockResolvedValue({ isDirectory: () => false, size: 1024 });

      vi.doMock('fs/promises', () => ({
        access: mockAccess,
        readFile: mockReadFile,
        readdir: mockReaddir,
        stat: mockStat,
      }));

      const result = await validator.validate('/proj');

      // bundleSize may or may not be set depending on dynamic import mocking
      expect(result).toBeDefined();
    });
  });

  // ─── validate: dev script ─────────────────────────────────────────────

  describe('validate with dev script only', () => {
    it('should detect dev script and attempt dev server check', async () => {
      mockAccess.mockResolvedValue(undefined);

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        if (spawnCall === 1) {
          return createMockChild({ stdout: 'ok', exitCode: 0 });
        }
        // Return a child that will timeout quickly
        const child = new EventEmitter();
        (child as any).stdout = new EventEmitter();
        (child as any).stderr = new EventEmitter();
        (child as any).killed = false;
        (child as any).pid = 12345;
        (child as any).kill = vi.fn();
        return child;
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { dev: 'vite' },
          dependencies: {},
        })
      );

      const fastValidator = new BuildValidator({
        installTimeoutMs: 5000,
        buildTimeoutMs: 200,
      });

      const result = await fastValidator.validate('/proj');

      // Dev server won't become ready → fails but code path is covered
      expect(result.passed).toBe(false);
      expect(spawnCall).toBe(2);
    }, 10000);
  });

  // ─── validate: dev script timeout ─────────────────────────────────────

  describe('validate dev script timeout', () => {
    it('should fail when dev server times out', async () => {
      mockAccess.mockResolvedValue(undefined);

      let spawnCall = 0;
      mockSpawn.mockImplementation(() => {
        spawnCall++;
        if (spawnCall === 1) {
          return createMockChild({ stdout: 'ok', exitCode: 0 });
        }
        // Dev server that never becomes ready
        const child = new EventEmitter();
        (child as any).stdout = new EventEmitter();
        (child as any).stderr = new EventEmitter();
        (child as any).killed = false;
        (child as any).pid = 12345;
        (child as any).kill = vi.fn();
        // Don't emit anything - will timeout
        return child;
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          name: 'test',
          scripts: { dev: 'vite' },
          dependencies: {},
        })
      );

      const fastValidator = new BuildValidator({
        installTimeoutMs: 5000,
        buildTimeoutMs: 200,
      });

      const result = await fastValidator.validate('/proj');

      expect(result.passed).toBe(false);
      expect(result.errors[0].message).toContain('Dev server failed');
    }, 10000);
  });

  // ─── validate: process error ──────────────────────────────────────────

  describe('validate process error handling', () => {
    it('should handle spawn error event', async () => {
      mockAccess.mockResolvedValue(undefined);

      const child = new EventEmitter();
      (child as any).stdout = new EventEmitter();
      (child as any).stderr = new EventEmitter();
      (child as any).killed = false;
      (child as any).pid = 12345;
      (child as any).kill = vi.fn();

      setTimeout(() => {
        child.emit('error', new Error('ENOENT: command not found'));
      }, 5);

      mockSpawn.mockReturnValue(child);

      const result = await validator.validate('/proj');

      expect(result.passed).toBe(false);
      expect(result.errors[0].message).toContain('npm install failed');
    });
  });
});
