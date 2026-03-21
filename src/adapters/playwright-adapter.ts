/**
 * Playwright Test Results Adapter
 * Converte resultados de testes Playwright para formato interno
 */

import { readFileSync } from 'fs';
import { TestAdapter, TestResult, AdapterConfig } from './index';

interface PlaywrightTest {
  title: string;
  ok: boolean;
  error?: {
    message: string;
    stack?: string;
  };
  location?: {
    file: string;
    line: number;
    column: number;
  };
  results?: PlaywrightTestResult[];
}

interface PlaywrightError {
  message: string;
  stack?: string;
}

interface PlaywrightTestResult {
  workerIndex: number;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  errors: PlaywrightError[];
  tests: PlaywrightTest[];
  startTime: number;
  duration: number;
}

interface PlaywrightSuite {
  title: string;
  file?: string;
  suites?: PlaywrightSuite[];
  tests: PlaywrightTest[];
}

interface PlaywrightOutput {
  config?: Record<string, unknown>;
  suites: PlaywrightSuite[];
  errors?: PlaywrightError[];
  stats?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    timedOut: number;
  };
}

export class PlaywrightAdapter implements TestAdapter {
  private config: AdapterConfig;

  constructor(config: AdapterConfig = {}) {
    this.config = {
      includeSkipped: true,
      includeTodo: false,
      stripAnsiColors: true,
      maxDuration: 60000,
      ...config,
    };
  }

  getFrameworkName(): string {
    return 'playwright';
  }

  canHandle(source: string): boolean {
    try {
      let content: string;
      if (source.endsWith('.json')) {
        content = readFileSync(source, 'utf-8');
      } else {
        content = source;
      }
      const data = JSON.parse(content);
      return data.suites !== undefined || data.config !== undefined;
    } catch {
      return false;
    }
  }

  async load(source: string): Promise<TestResult[]> {
    let data: PlaywrightOutput;

    try {
      const content = source.endsWith('.json') ? readFileSync(source, 'utf-8') : source;
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to parse Playwright JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const results: TestResult[] = [];

    if (!data.suites || !Array.isArray(data.suites)) {
      return results;
    }

    for (const suite of data.suites) {
      this.processSuite(suite, results);
    }

    return results.filter(result => {
      if (result.outcome === 'skipped' && !this.config.includeSkipped) {
        return false;
      }
      return true;
    });
  }

  private processSuite(suite: PlaywrightSuite, results: TestResult[], parentPath = ''): void {
    const currentPath = parentPath ? `${parentPath} > ${suite.title}` : suite.title;

    for (const test of suite.tests) {
      let duration = 0;
      if (test.results && test.results.length > 0) {
        duration = test.results[0].duration || 0;
      }

      const outcome: TestResult['outcome'] = test.ok ? 'passed' : 'failed';

      let error: string | undefined;
      if (!test.ok && test.error) {
        error = test.error.message;
        if (test.error.stack) {
          error += `\n\n${test.error.stack}`;
        }
        if (this.config.stripAnsiColors) {
          error = this.stripAnsiColors(error);
        }
      }

      results.push({
        testCase: this.normalizeTestCaseName(test.title, currentPath),
        outcome,
        duration: Math.round(duration),
        error,
        metadata: {
          framework: 'playwright',
          suite: currentPath,
          file: test.location?.file,
          line: test.location?.line,
        },
      });
    }

    if (suite.suites) {
      for (const nestedSuite of suite.suites) {
        this.processSuite(nestedSuite, results, currentPath);
      }
    }
  }

  private normalizeTestCaseName(name: string, suite: string): string {
    const normalized = name
      .replace(/[\s()[\]]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    const suitePrefix = suite
      .replace(/\s+/g, '-')
      .replace(/[>()[\]]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    return `${suitePrefix}-${normalized}`;
  }

  private stripAnsiColors(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}
