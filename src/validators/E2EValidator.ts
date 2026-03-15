/**
 * E2EValidator - Browser-based runtime validation
 * 
 * Uses Playwright to connect to a running dev server and validates
 * that the frontend actually renders without catastrophic JS errors.
 */

import { chromium, Browser } from '@playwright/test';
import { logger } from '../logger.js';

export interface E2EValidationResult {
  valid: boolean;
  pageLoaded: boolean;
  jsErrors: string[];
  consoleErrors: string[];
  metrics: {
    loadTimeMs: number;
    hasCanvas: boolean;
    hasWebGL: boolean;
  };
}

export interface E2EValidatorOptions {
  timeoutMs?: number;
  headless?: boolean;
}

export class E2EValidator {
  private readonly log = logger.child('E2EValidator');
  
  constructor(private readonly options: E2EValidatorOptions = {}) {
    this.options.timeoutMs = this.options.timeoutMs ?? 10000;
    this.options.headless = this.options.headless ?? true;
  }

  async validate(url: string): Promise<E2EValidationResult> {
    this.log.info('Starting E2E validation', { url });
    
    const result: E2EValidationResult = {
      valid: false,
      pageLoaded: false,
      jsErrors: [],
      consoleErrors: [],
      metrics: {
        loadTimeMs: 0,
        hasCanvas: false,
        hasWebGL: false,
      }
    };

    let browser: Browser | null = null;
    const startTime = Date.now();

    try {
      this.log.debug('Launching browser');
      browser = await chromium.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
      });

      const page = await context.newPage();

      // Hook up error listeners
      page.on('pageerror', (err) => {
        this.log.debug('Caught page error', { message: err.message });
        result.jsErrors.push(err.message);
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          this.log.debug('Caught console error', { text: msg.text() });
          result.consoleErrors.push(msg.text());
        }
      });

      this.log.debug('Navigating to ' + url);
      const response = await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: this.options.timeoutMs 
      });

      if (!response) {
        throw new Error('No response from server');
      }

      if (!response.ok()) {
        throw new Error(`Server returned HTTP ${response.status()}`);
      }

      result.pageLoaded = true;

      // Check canvas and webgl presence (common in generative UI tasks)
      this.log.debug('Evaluating DOM contexts');
      const canvasData = await page.evaluate(() => {
        const canvases = Array.from((globalThis as any).document.querySelectorAll('canvas')) as any[];
        
        // Check if any canvas successfully initialized a WebGL context
        const hasWebGL = canvases.some((canvas: any) => {
          try {
            return !!(canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('experimental-webgl'));
          } catch (e) {
            return false;
          }
        });

        return {
          hasCanvas: canvases.length > 0,
          hasWebGL
        };
      });

      result.metrics.hasCanvas = canvasData.hasCanvas;
      result.metrics.hasWebGL = canvasData.hasWebGL;

      // Project is visually valid if there are no fatal JS errors and page loaded 200 OK
      result.valid = result.jsErrors.length === 0;
      
    } catch (err) {
      this.log.error('E2E validation failed', { error: err instanceof Error ? err.message : String(err) });
      result.valid = false;
      result.jsErrors.push(err instanceof Error ? err.message : String(err));
    } finally {
      if (browser) {
        await browser.close();
      }
      result.metrics.loadTimeMs = Date.now() - startTime;
    }

    return result;
  }
}
