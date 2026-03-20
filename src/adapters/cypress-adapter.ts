/**
 * Cypress Test Results Adapter
 * Converte resultados de testes Cypress para formato interno
 */

import { readFileSync } from 'fs';
import { TestAdapter, TestResult, AdapterConfig } from './index';

interface CypressTest {
  title: string[];
  state: 'passed' | 'failed' | 'pending';
  body?: string;
  error?: {
    message: string;
    stack?: string;
  };
  timings?: {
    duration: number;
  };
  attempts?: Array<{
    state: string;
    error?: { message: string };
    duration: number;
  }>;
}

interface CypressSuite {
  uuid: string;
  title: string;
  tests: CypressTest[];
  suites?: CypressSuite[];
}

interface CypressOutput {
  browserName?: string;
  browserVersion?: string;
  config?: any;
  results: Array<{
    suite: CypressSuite;
    tests: CypressTest[];
    stats: {
      suites: number;
      tests: number;
      passed: number;
      failed: number;
      pending: number;
      skipped: number;
      duration: number;
    };
    reporterStats?: any;
  }>;
}

export class CypressAdapter implements TestAdapter {
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
    return 'cypress';
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
      return (
        data.browserName !== undefined ||
        (data.results !== undefined && Array.isArray(data.results))
      );
    } catch {
      return false;
    }
  }

  async load(source: string): Promise<TestResult[]> {
    let data: CypressOutput;

    try {
      const content = source.endsWith('.json') ? readFileSync(source, 'utf-8') : source;
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to parse Cypress JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const results: TestResult[] = [];

    if (!data.results || !Array.isArray(data.results)) {
      return results;
    }

    for (const result of data.results) {
      if (result.suite) {
        this.processSuite(result.suite, results);
      }
    }

    return results.filter(result => {
      if (result.outcome === 'skipped' && !this.config.includeSkipped) {
        return false;
      }
      return true;
    });
  }

  private processSuite(suite: CypressSuite, results: TestResult[]): void {
    for (const test of suite.tests) {
      const errorMessage = test.error?.message || test.attempts?.[0]?.error?.message;

      let error: string | undefined;
      if (errorMessage) {
        error = this.config.stripAnsiColors ? this.stripAnsiColors(errorMessage) : errorMessage;
        if (test.error?.stack) {
          error += `\n\n${test.error.stack}`;
        }
      }

      results.push({
        testCase: this.normalizeTestCaseName(test.title.join(' > '), suite.title),
        outcome: this.mapState(test.state),
        duration: test.timings?.duration || test.attempts?.[0]?.duration || 0,
        error,
        metadata: {
          framework: 'cypress',
          suite: suite.title,
          titleParts: test.title,
        },
      });
    }

    if (suite.suites) {
      for (const nestedSuite of suite.suites) {
        this.processSuite(nestedSuite, results);
      }
    }
  }

  private mapState(state: string): TestResult['outcome'] {
    switch (state) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'skipped':
      default:
        return 'skipped';
    }
  }

  private normalizeTestCaseName(name: string, suite: string): string {
    const normalized = name
      .replace(/\s*>\s*/g, '-')
      .replace(/[\s\(\)\[\]]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    const suitePrefix = suite
      .replace(/\s+/g, '-')
      .replace(/[\(\)\[\]]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    return `${suitePrefix}-${normalized}`;
  }

  private stripAnsiColors(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}
