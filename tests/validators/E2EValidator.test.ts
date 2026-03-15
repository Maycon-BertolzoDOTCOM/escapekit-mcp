import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { E2EValidator } from '../../src/validators/E2EValidator.js';
import { chromium } from '@playwright/test';

vi.mock('@playwright/test', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe('E2EValidator', () => {
  let validator: E2EValidator;
  let pageMock: any;
  let browserMock: any;

  beforeEach(() => {
    validator = new E2EValidator({ timeoutMs: 100 });
    vi.clearAllMocks();

    pageMock = {
      on: vi.fn().mockImplementation((event: string, cb: Function) => {}),
      goto: vi.fn().mockResolvedValue({
        ok: () => true,
        status: () => 200,
      }),
      evaluate: vi.fn().mockResolvedValue({
        hasCanvas: true,
        hasWebGL: true,
      }),
    };

    const contextMock = {
      newPage: vi.fn().mockResolvedValue(pageMock),
    };

    browserMock = {
      newContext: vi.fn().mockResolvedValue(contextMock),
      close: vi.fn(),
    };

    vi.mocked(chromium.launch).mockResolvedValue(browserMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates a successful page load without errors', async () => {
    const result = await validator.validate('http://localhost:3000');

    expect(result.valid).toBe(true);
    expect(result.pageLoaded).toBe(true);
    expect(result.metrics.hasCanvas).toBe(true);
    expect(result.metrics.hasWebGL).toBe(true);
    expect(result.jsErrors).toHaveLength(0);
    expect(result.consoleErrors).toHaveLength(0);
    expect(browserMock.close).toHaveBeenCalledTimes(1);
  });

  it('fails validation on HTTP error', async () => {
    pageMock.goto.mockResolvedValue({
      ok: () => false,
      status: () => 500,
    });

    const result = await validator.validate('http://localhost:3000');

    expect(result.valid).toBe(false);
    expect(result.pageLoaded).toBe(false);
    expect(result.jsErrors[0]).toContain('HTTP 500');
  });

  it('fails validation if network times out', async () => {
    pageMock.goto.mockRejectedValue(new Error('Timeout 100ms exceeded'));

    const result = await validator.validate('http://localhost:3000');

    expect(result.valid).toBe(false);
    expect(result.jsErrors[0]).toContain('Timeout');
  });

  it('collects JS errors and fails validation if present', async () => {
    pageMock.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'pageerror') {
        cb(new Error('SyntaxError: Unexpected token'));
      }
    });

    const result = await validator.validate('http://localhost:3000');

    expect(result.jsErrors[0]).toContain('SyntaxError: Unexpected token');
    expect(result.valid).toBe(false); // JS errors invalidate UI builds
  });

  it('collects console errors but does not necessarily fail on them alone', async () => {
    pageMock.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'console') {
        const msg = { type: () => 'error', text: () => 'Failed to load resource: 404' };
        cb(msg);
      }
    });

    const result = await validator.validate('http://localhost:3000');

    expect(result.consoleErrors).toContain('Failed to load resource: 404');
    expect(result.valid).toBe(true); 
  });
});
