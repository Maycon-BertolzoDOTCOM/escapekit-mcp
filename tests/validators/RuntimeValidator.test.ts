import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuntimeValidator } from '../../src/validators/RuntimeValidator.js';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('RuntimeValidator', () => {
  let validator: RuntimeValidator;

  beforeEach(() => {
    validator = new RuntimeValidator({
      installTimeoutMs: 1000,
      bootTimeoutMs: 1000,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockChildProcess(options: { exitCode?: number; stdoutData?: string; stderrData?: string; delay?: number }) {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    child.pid = 12345;

    setTimeout(() => {
      if (options.stdoutData) child.stdout.emit('data', Buffer.from(options.stdoutData));
      if (options.stderrData) child.stderr.emit('data', Buffer.from(options.stderrData));
      
      if (options.exitCode !== undefined) {
        child.emit('close', options.exitCode);
      }
    }, options.delay || 10);

    return child;
  }

  it('validates a successful install and boot', async () => {
    // 1st call: npm install
    // 2nd call: npm run dev
    vi.mocked(child_process.spawn)
      .mockReturnValueOnce(createMockChildProcess({ exitCode: 0, stdoutData: 'added 50 packages' }))
      .mockReturnValueOnce(createMockChildProcess({ stdoutData: 'Vite ready in 150ms\n  http://localhost:5173' }));

    const result = await validator.validate('/mock/path');

    expect(result.valid).toBe(true);
    expect(result.installSuccess).toBe(true);
    expect(result.bootSuccess).toBe(true);
    expect(result.serverUrl).toBe('http://localhost:5173');
    expect(result.error).toBeUndefined();
  });

  it('fails validation if npm install fails', async () => {
    vi.mocked(child_process.spawn)
      .mockReturnValueOnce(createMockChildProcess({ exitCode: 1, stderrData: 'ERR! 404 Not Found' }));

    const result = await validator.validate('/mock/path');

    expect(result.valid).toBe(false);
    expect(result.installSuccess).toBe(false);
    expect(result.bootSuccess).toBe(false);
    expect(result.error).toContain('npm install failed with exit code 1');
    expect(child_process.spawn).toHaveBeenCalledTimes(1); // Should not proceed to boot
  });

  it('fails validation if npm run dev exits prematurely', async () => {
    vi.mocked(child_process.spawn)
      .mockReturnValueOnce(createMockChildProcess({ exitCode: 0 }))
      .mockReturnValueOnce(createMockChildProcess({ exitCode: 1, stderrData: 'Error: Cannot find module' }));

    const result = await validator.validate('/mock/path');

    expect(result.valid).toBe(false);
    expect(result.installSuccess).toBe(true);
    expect(result.bootSuccess).toBe(false);
    expect(result.error).toContain('Dev server exited prematurely');
  });

  it('fails validation if dev server boot times out', async () => {
    vi.mocked(child_process.spawn)
      .mockReturnValueOnce(createMockChildProcess({ exitCode: 0 }))
      .mockReturnValueOnce(createMockChildProcess({ delay: 2000 })); // Longer than bootTimeoutMs (1000)

    const result = await validator.validate('/mock/path');

    expect(result.valid).toBe(false);
    expect(result.bootSuccess).toBe(false);
    expect(result.error).toContain('timed out');
  });
});
