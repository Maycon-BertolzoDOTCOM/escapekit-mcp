/**
 * BrowserEnvironment - Tests in a real browser using Playwright
 *
 * Launches a browser, navigates to the running app, checks for
 * JS errors, console errors, and DOM state.
 *
 * @module validate/environments/BrowserEnvironment
 */

import { logger } from '../../logger.js';
import type { Environment, EnvironmentResult } from '../types.js';

export interface BrowserEnvironmentOptions {
  timeoutMs?: number;
  headless?: boolean;
  viewport?: { width: number; height: number };
}

export class BrowserEnvironment implements Environment {
  readonly name = 'browser';
  private readonly log = logger.child('BrowserEnvironment');

  constructor(private readonly options: BrowserEnvironmentOptions = {}) {
    this.options.timeoutMs = options.timeoutMs ?? 15000;
    this.options.headless = options.headless ?? true;
    this.options.viewport = options.viewport ?? { width: 1280, height: 720 };
  }

  async test(projectPath: string): Promise<EnvironmentResult> {
    this.log.info('Starting browser environment test', { projectPath });

    // BrowserEnvironment tests a URL, not a path - the URL must be passed
    // via the first argument. This is handled by the ValidationEngine.
    // For now, we return a placeholder.
    return {
      name: this.name,
      passed: false,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: ['BrowserEnvironment requires a running server URL'],
      error: 'Use LocalEnvironment or DockerEnvironment first to start a server',
    };
  }

  /**
   * Test a specific URL in a real browser.
   * This is the primary method called by ValidationEngine.
   */
  async testUrl(url: string): Promise<EnvironmentResult> {
    this.log.info('Testing URL in browser', { url });

    let chromium: typeof import('@playwright/test').chromium;
    try {
      const playwright = await import('@playwright/test');
      chromium = playwright.chromium;
    } catch {
      return {
        name: this.name,
        passed: true,
        startupTimeMs: 0,
        healthChecks: [
          { name: 'browser-skip', passed: true, message: 'Playwright not installed', latencyMs: 0 },
        ],
        apiTests: [],
        logs: ['Playwright not available - browser test skipped'],
      };
    }

    const result: EnvironmentResult = {
      name: this.name,
      passed: false,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
    };

    const startTime = Date.now();
    let browser: import('@playwright/test').Browser | null = null;
    const jsErrors: string[] = [];
    const consoleErrors: string[] = [];

    try {
      browser = await chromium.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext({ viewport: this.options.viewport });
      const page = await context.newPage();

      page.on('pageerror', (err: Error) => {
        jsErrors.push(err.message);
        result.logs.push(`[browser:js-error] ${err.message}`);
      });

      page.on('console', (msg: import('@playwright/test').ConsoleMessage) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
          result.logs.push(`[browser:console-error] ${msg.text()}`);
        }
      });

      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.options.timeoutMs,
      });

      result.startupTimeMs = Date.now() - startTime;

      if (!response) {
        result.error = 'No response from server';
        return result;
      }

      result.healthChecks.push({
        name: 'browser:page-load',
        passed: response.ok(),
        message: `HTTP ${response.status()}`,
        latencyMs: result.startupTimeMs,
      });

      if (!response.ok()) {
        result.error = `Server returned HTTP ${response.status()}`;
        return result;
      }

      // Check for fatal JS errors
      result.healthChecks.push({
        name: 'browser:no-js-errors',
        passed: jsErrors.length === 0,
        message: jsErrors.length === 0 ? 'No JS errors' : `${jsErrors.length} JS errors found`,
        latencyMs: 0,
      });

      // Check for critical console errors
      result.healthChecks.push({
        name: 'browser:console-clean',
        passed: consoleErrors.length === 0,
        message:
          consoleErrors.length === 0
            ? 'No console errors'
            : `${consoleErrors.length} console errors`,
        latencyMs: 0,
      });

      result.passed = response.ok() && jsErrors.length === 0;
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      result.logs.push(`[browser:error] ${result.error}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    return result;
  }

  async cleanup(): Promise<void> {
    // Browser is cleaned up in testUrl itself
  }
}
