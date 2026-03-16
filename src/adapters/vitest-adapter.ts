/**
 * Vitest Test Adapter
 * Parses Vitest JSON output and converts to Kiwi TCMS format
 */

import { readFileSync } from 'fs';
import { TestAdapter, TestResult, AdapterConfig } from './index';

interface VitestTestFile {
  name: string;
  filepath: string;
  result: {
    state: 'pass' | 'fail' | 'skip' | 'todo' | 'run';
    duration?: number;
    error?: {
      message: string;
      stack: string;
    };
  };
  tests: VitestTestCase[];
}

interface VitestTestCase {
  name: string;
  filepath: string;
  result: {
    state: 'pass' | 'fail' | 'skip' | 'todo' | 'run';
    duration?: number;
    error?: {
      message: string;
      stack: string;
    };
  };
}

interface VitestOutput {
  testResults: VitestTestFile[];
}

export class VitestAdapter implements TestAdapter {
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
    return 'vitest';
  }

  canHandle(source: string): boolean {
    if (source.endsWith('.json')) {
      try {
        const content = readFileSync(source, 'utf-8');
        const parsed = JSON.parse(content);
        
        return (
          'testResults' in parsed ||
          'numFailedTestSuites' in parsed ||
          'numFailedTests' in parsed
        );
      } catch {
        return false;
      }
    }
    return false;
  }

  async load(source: string): Promise<TestResult[]> {
    let content: string;
    let data: VitestOutput;

    try {
      content = source.endsWith('.json') 
        ? readFileSync(source, 'utf-8')
        : source;
      
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse Vitest JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    const results: TestResult[] = [];

    if (data.testResults) {
      for (const testFile of data.testResults) {
        if (testFile.result && testFile.result.state !== 'run') {
          results.push(this.parseTestResult(testFile.name, testFile.result, testFile.filepath));
        }

        if (testFile.tests) {
          for (const test of testFile.tests) {
            if (test.result && test.result.state !== 'run') {
              results.push(this.parseTestResult(test.name, test.result, test.filepath));
            }
          }
        }
      }
    } else if ('numFailedTests' in data) {
      throw new Error('Vitest summary format not supported. Use --reporter=json for detailed results.');
    }

    return results.filter(result => {
      if (result.outcome === 'skipped' && !this.config.includeSkipped) {
        return false;
      }
      if (result.metadata?.isTodo && !this.config.includeTodo) {
        return false;
      }
      return true;
    });
  }

  private parseTestResult(
    name: string,
    result: VitestTestCase['result'],
    filepath: string
  ): TestResult {
    const outcome = this.mapStatus(result.state);
    const duration = result.duration || 0;

    const maxDuration = this.config.maxDuration || 60000;
    const finalOutcome = duration > maxDuration ? 'failed' : outcome;

    const testResult: TestResult = {
      testCase: this.normalizeTestCaseName(name, filepath),
      outcome: finalOutcome,
      duration: duration,
      metadata: {
        framework: 'vitest',
        filepath: filepath,
        originalStatus: result.state,
        isTodo: result.state === 'todo',
      },
    };

    if (result.error && (finalOutcome === 'failed' || outcome === 'failed')) {
      let errorMessage = result.error.message;
      if (this.config.stripAnsiColors) {
        errorMessage = this.stripAnsiColors(errorMessage);
      }

      testResult.error = `${errorMessage}\n\n${result.error.stack}`;
    }

    return testResult;
  }

  private mapStatus(status: VitestTestCase['result']['state']): TestResult['outcome'] {
    switch (status) {
      case 'pass':
        return 'passed';
      case 'fail':
        return 'failed';
      case 'skip':
      case 'todo':
        return 'skipped';
      case 'run':
      default:
        return 'skipped';
    }
  }

  private normalizeTestCaseName(name: string, filepath: string | undefined): string {
    const normalized = name
      .replace(/[\s\(\)\[\]]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    let filepathPrefix = '';
    if (filepath) {
      filepathPrefix = filepath
        .replace(/\//g, '-')
        .replace(/\.ts$/, '')
        .replace(/\.js$/, '')
        .split('-')
        .slice(-3)
        .join('-');
      filepathPrefix = `${filepathPrefix}-`;
    }

    return `${filepathPrefix}${normalized}`;
  }

  private stripAnsiColors(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}

export function generateVitestCommand(outputPath: string = 'vitest-results.json'): string {
  return `npx vitest run --reporter=json --output=${outputPath}`;
}
