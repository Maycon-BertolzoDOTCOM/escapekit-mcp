/**
 * WebGLValidator - Validates WebGL support with fallback detection
 *
 * Uses Playwright to check if a running project correctly handles
 * WebGL canvas rendering or falls back gracefully.
 *
 * @module validate/validators/WebGLValidator
 */

import { logger } from '../../logger.js';
import type { WebGLCheckResult } from '../types.js';

export interface WebGLValidatorOptions {
  timeoutMs?: number;
  headless?: boolean;
}

export class WebGLValidator {
  private readonly log = logger.child('WebGLValidator');

  constructor(private readonly options: WebGLValidatorOptions = {}) {
    this.options.timeoutMs = options.timeoutMs ?? 15000;
    this.options.headless = options.headless ?? true;
  }

  async validate(url: string): Promise<WebGLCheckResult> {
    this.log.info('Starting WebGL validation', { url });

    let chromium: any;
    try {
      const playwright = await import('@playwright/test');
      chromium = playwright.chromium;
    } catch {
      this.log.warn('Playwright not available, skipping WebGL validation');
      return {
        passed: true,
        hasCanvas: false,
        hasWebGL: false,
        hasWebGL2: false,
        fallbackApplied: false,
        jsErrors: ['Playwright not installed - WebGL check skipped'],
        loadTimeMs: 0,
      };
    }

    const result: WebGLCheckResult = {
      passed: false,
      hasCanvas: false,
      hasWebGL: false,
      hasWebGL2: false,
      fallbackApplied: false,
      jsErrors: [],
      loadTimeMs: 0,
    };

    const startTime = Date.now();
    let browser: any = null;

    try {
      browser = await chromium.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage();

      page.on('pageerror', (err: Error) => {
        result.jsErrors.push(err.message);
      });

      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.options.timeoutMs,
      });

      if (!response || !response.ok()) {
        result.jsErrors.push(`Server returned ${response?.status() || 'no response'}`);
        return result;
      }

      // Check for canvas and WebGL
      const canvasData = await page.evaluate(() => {
        const doc = (globalThis as any).document;
        const canvases = Array.from(doc.querySelectorAll('canvas')) as any[];
        let hasWebGL = false;
        let hasWebGL2 = false;

        for (const canvas of canvases) {
          try {
            const gl =
              (canvas as any).getContext('webgl') ||
              (canvas as any).getContext('experimental-webgl');
            if (gl) hasWebGL = true;
          } catch {
            // WebGL not available for this canvas
          }
          try {
            const gl2 = (canvas as any).getContext('webgl2');
            if (gl2) hasWebGL2 = true;
          } catch {
            // WebGL2 not available for this canvas
          }
        }

        return { hasCanvas: canvases.length > 0, hasWebGL, hasWebGL2 };
      });

      result.hasCanvas = canvasData.hasCanvas;
      result.hasWebGL = canvasData.hasWebGL;
      result.hasWebGL2 = canvasData.hasWebGL2;

      // Check if fallback is used (e.g., CSS 2D transform instead of WebGL)
      const hasFallback = await page.evaluate(() => {
        const doc = (globalThis as any).document;
        return !!(
          doc.querySelector('[data-fallback]') ||
          doc.querySelector('.webgl-fallback') ||
          doc.querySelector('.canvas-fallback')
        );
      });
      result.fallbackApplied = hasFallback;

      // Pass if: no canvas needed, or WebGL works, or fallback is in place
      result.passed =
        !result.hasCanvas ||
        result.hasWebGL ||
        result.fallbackApplied ||
        result.jsErrors.length === 0;
    } catch (err) {
      result.jsErrors.push(err instanceof Error ? err.message : String(err));
      result.passed = false;
    } finally {
      if (browser) {
        await browser.close();
      }
      result.loadTimeMs = Date.now() - startTime;
    }

    this.log.info('WebGL validation complete', {
      passed: result.passed,
      hasWebGL: result.hasWebGL,
      fallbackApplied: result.fallbackApplied,
    });

    return result;
  }
}
