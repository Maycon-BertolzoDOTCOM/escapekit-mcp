import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebGLValidator } from '../../src/validate/validators/WebGLValidator.js';

describe('WebGLValidator', () => {
  let validator: WebGLValidator;

  beforeEach(() => {
    vi.resetAllMocks();
    validator = new WebGLValidator({ timeoutMs: 5000, headless: true });
  });

  // ─── constructor ──────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const v = new WebGLValidator();
      expect(v).toBeInstanceOf(WebGLValidator);
    });

    it('should accept custom timeout and headless options', () => {
      const v = new WebGLValidator({ timeoutMs: 10000, headless: false });
      expect(v).toBeInstanceOf(WebGLValidator);
    });
  });

  // ─── validate with Playwright unavailable ─────────────────────────────

  describe('validate when Playwright is not available', () => {
    it('should return passed=true with Playwright not available message', async () => {
      // Playwright import will fail because @playwright/test is not installed in test env
      // or we mock the dynamic import to throw
      vi.doMock('@playwright/test', () => {
        throw new Error('Playwright not installed');
      });

      const result = await validator.validate('http://localhost:3000');

      expect(result.passed).toBe(true);
      expect(result.hasCanvas).toBe(false);
      expect(result.hasWebGL).toBe(false);
      expect(result.hasWebGL2).toBe(false);
      expect(result.fallbackApplied).toBe(false);
      expect(result.jsErrors).toContain('Playwright not installed - WebGL check skipped');
      expect(result.loadTimeMs).toBe(0);
    });
  });

  // ─── validate with mocked Playwright ──────────────────────────────────

  describe('validate with mocked Playwright', () => {
    let mockPage: any;
    let mockContext: any;
    let mockBrowser: any;
    let mockChromium: any;

    beforeEach(() => {
      mockPage = {
        on: vi.fn(),
        goto: vi.fn().mockResolvedValue({ ok: () => true, status: () => 200 }),
        evaluate: vi.fn(),
      };
      mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
      };
      mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockChromium = {
        launch: vi.fn().mockResolvedValue(mockBrowser),
      };
    });

    it('should detect WebGL when canvas with webgl context exists', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce({ hasCanvas: true, hasWebGL: true, hasWebGL2: false })
        .mockResolvedValueOnce(false);

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.hasCanvas).toBe(true);
      expect(result.hasWebGL).toBe(true);
      expect(result.hasWebGL2).toBe(false);
      expect(result.fallbackApplied).toBe(false);
      expect(result.passed).toBe(true);
      expect(result.loadTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should detect WebGL2 when available', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce({ hasCanvas: true, hasWebGL: true, hasWebGL2: true })
        .mockResolvedValueOnce(false);

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.hasWebGL2).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('should detect fallback when data-fallback attribute exists', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce({ hasCanvas: true, hasWebGL: false, hasWebGL2: false })
        .mockResolvedValueOnce(true);

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.fallbackApplied).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('should handle page with no canvas', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce({ hasCanvas: false, hasWebGL: false, hasWebGL2: false })
        .mockResolvedValueOnce(false);

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.hasCanvas).toBe(false);
      expect(result.passed).toBe(true); // No canvas needed → passed
    });

    it('should capture JS errors from page', async () => {
      let errorHandler: ((err: Error) => void) | undefined;
      mockPage.on.mockImplementation((event: string, handler: (err: Error) => void) => {
        if (event === 'pageerror') errorHandler = handler;
      });

      mockPage.evaluate
        .mockResolvedValueOnce({ hasCanvas: true, hasWebGL: false, hasWebGL2: false })
        .mockResolvedValueOnce(false);

      mockPage.goto.mockImplementation(async () => {
        // Simulate JS error during navigation
        if (errorHandler) errorHandler(new Error('WebGL context creation failed'));
        return { ok: () => true, status: () => 200 };
      });

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.jsErrors.length).toBeGreaterThan(0);
    });

    it('should handle HTTP error response', async () => {
      mockPage.goto.mockResolvedValue({ ok: () => false, status: () => 404 });

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.jsErrors).toContain('Server returned 404');
      expect(result.passed).toBe(false);
    });

    it('should handle null response', async () => {
      mockPage.goto.mockResolvedValue(null);

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.jsErrors).toContain('Server returned no response');
      expect(result.passed).toBe(false);
    });

    it('should handle browser launch failure', async () => {
      mockChromium.launch.mockRejectedValue(new Error('Failed to launch browser'));

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.passed).toBe(false);
      expect(result.jsErrors.some(e => e.includes('Failed to launch browser'))).toBe(true);
    });

    it('should close browser even when evaluation throws', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(result.jsErrors.some(e => e.includes('Evaluation failed'))).toBe(true);
    });

    it('should set loadTimeMs to a positive value', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce({ hasCanvas: false, hasWebGL: false, hasWebGL2: false })
        .mockResolvedValueOnce(false);

      vi.doMock('@playwright/test', () => ({
        chromium: mockChromium,
      }));

      const result = await validator.validate('http://localhost:3000');

      expect(result.loadTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
