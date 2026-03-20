/**
 * Jest Test Results Adapter
 * Converte resultados de testes Jest para formato interno
 */

import { readFileSync } from 'fs';
import { TestAdapter, TestResult, AdapterConfig } from './index';

interface JestTestResult {
  title: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped' | 'todo';
  message?: string;
  line?: number;
  column?: number;
}

interface JestSuite {
  name: string;
  suites?: JestSuite[];
  tests: JestTestResult[];
  perfStats?: {
    start: number;
    end: number;
    duration: number;
  };
}

interface JestOutput {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  testResults: JestSuite[];
  coverage?: Record<string, unknown>;
}

export class JestAdapter implements TestAdapter {
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
    return 'jest';
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
        data.numTotalTests !== undefined &&
        data.testResults !== undefined &&
        Array.isArray(data.testResults)
      );
    } catch {
      return false;
    }
  }

  async load(source: string): Promise<TestResult[]> {
    let data: JestOutput;

    try {
      const content = source.endsWith('.json') ? readFileSync(source, 'utf-8') : source;
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to parse Jest JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const results: TestResult[] = [];

    if (!data.testResults || !Array.isArray(data.testResults)) {
      return results;
    }

    for (const suite of data.testResults) {
      this.processSuite(suite, results);
    }

    return results.filter(result => {
      if (result.outcome === 'skipped' && !this.config.includeSkipped) {
        return false;
      }
      return true;
    });
  }

  private processSuite(suite: JestSuite, results: TestResult[]): void {
    const duration = suite.perfStats ? suite.perfStats.end - suite.perfStats.start : 0;

    for (const test of suite.tests) {
      const outcome = this.mapStatus(test.status);
      const testDuration = duration / Math.max(suite.tests.length, 1);

      const testResult: TestResult = {
        testCase: this.normalizeTestCaseName(test.title, suite.name),
        outcome,
        duration: Math.round(testDuration),
        metadata: {
          framework: 'jest',
          suite: suite.name,
        },
      };

      if (outcome === 'failed' && test.message) {
        if (this.config.stripAnsiColors) {
          testResult.error = this.stripAnsiColors(test.message);
        } else {
          testResult.error = test.message;
        }
      }

      results.push(testResult);
    }

    if (suite.suites) {
      for (const nestedSuite of suite.suites) {
        this.processSuite(nestedSuite, results);
      }
    }
  }

  private mapStatus(status: string): TestResult['outcome'] {
    switch (status) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'skipped':
      case 'todo':
      default:
        return 'skipped';
    }
  }

  private normalizeTestCaseName(name: string, suite: string): string {
    const normalized = name
      .replace(/[\s\(\)\[\]]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    const suitePrefix = suite
      .replace(/\s+/g, '-')
      .replace(/[()\[\]]+/g, '-')
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
