/**
 * Vitest Test Adapter
 * Parses Vitest JSON output and converts to Kiwi TCMS format
 */

import { readFileSync } from 'fs';
import { TestAdapter, TestResult, AdapterConfig } from './index';

interface VitestTestFile {
  name: string;
  filepath: string;
  result?: {
    state: 'pass' | 'fail' | 'skip' | 'todo' | 'run';
    duration?: number;
    error?: {
      message: string;
      stack: string;
    };
  };
  tests?: VitestTestCase[];
  assertionResults?: VitestAssertionResult[];
}

interface VitestTestCase {
  name: string;
  filepath: string;
  result?: {
    state: 'pass' | 'fail' | 'skip' | 'todo' | 'run';
    duration?: number;
    error?: {
      message: string;
      stack: string;
    };
  };
}

interface VitestAssertionResult {
  ancestorTitles: string[];
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
  title: string;
  duration?: number;
  failureMessages?: string[];
  meta?: Record<string, unknown>;
  tags?: string[];
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
    let content: string = "";
    let data: VitestOutput;

    try {
      content = source.endsWith('.json') 
        ? readFileSync(source, 'utf-8')
        : source;
      
      // Debug logging
      console.log(`\n🔍 VitestAdapter debugging:`);
      console.log(`   Source: ${source}`);
      console.log(`   Content length: ${content.length}`);
      
      data = JSON.parse(content);
      
      console.log(`   ✓ JSON parsed successfully`);
      console.log(`   Keys: ${Object.keys(data).join(', ')}`);
      console.log(`   Test results count: ${data.testResults?.length || 0}`);
    } catch (error: unknown) {
      console.error(`\n✗ VitestAdapter parsing error:`);
      console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`);
      
      if (error instanceof SyntaxError) {
        const match = error.message.match(/at position (\d+)/);
        if (match) {
          const pos = parseInt(match[1]);
          console.error(`   Error position: ${pos}`);
          console.error(`   Context: ${content.substring(Math.max(0, pos - 50), Math.min(content.length, pos + 50))}`);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse Vitest JSON: ${errorMessage}`);
    }

    const results: TestResult[] = [];

    if (data.testResults && data.testResults.length > 0) {
      console.log(`   Processing ${data.testResults.length} test files...`);
      
      for (const testFile of data.testResults) {
        // Process assertionResults (newer Vitest format)
        if (testFile.assertionResults && testFile.assertionResults.length > 0) {
          for (const assertion of testFile.assertionResults) {
            const result = this.parseAssertionResult(assertion, testFile.filepath);
            if (result) {
              results.push(result);
            }
          }
        }
        
        // Process result (older Vitest format)
        else if (testFile.result && testFile.result.state !== 'run') {
          results.push(this.parseTestResult(testFile.name, testFile.result, testFile.filepath));
        }

        // Process tests array (older Vitest format)
        else if (testFile.tests && testFile.tests.length > 0) {
          for (const test of testFile.tests) {
            if (test.result && test.result.state !== 'run') {
              results.push(this.parseTestResult(test.name, test.result, test.filepath));
            }
          }
        }
      }
      
      console.log(`   ✓ Generated ${results.length} test results`);
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

  private parseAssertionResult(
    assertion: VitestAssertionResult,
    filepath: string
  ): TestResult | null {
    const outcome = this.mapStatus(assertion.status);
    const duration = assertion.duration || 0;

    const maxDuration = this.config.maxDuration || 60000;
    const finalOutcome = duration > maxDuration ? 'failed' : outcome;

    const testResult: TestResult = {
      testCase: this.normalizeTestCaseName(assertion.fullName || assertion.title, filepath),
      outcome: finalOutcome,
      duration: duration,
      metadata: {
        framework: 'vitest',
        filepath: filepath,
        originalStatus: assertion.status,
        isTodo: assertion.status === 'todo',
        ancestorTitles: assertion.ancestorTitles,
      },
    };

    if (assertion.failureMessages && assertion.failureMessages.length > 0) {
      let errorMessage = assertion.failureMessages.join('\n\n');
      if (this.config.stripAnsiColors) {
        errorMessage = this.stripAnsiColors(errorMessage);
      }
      testResult.error = errorMessage;
    }

    return testResult;
  }

  private parseTestResult(
    name: string,
    result: VitestTestCase['result'],
    filepath: string
  ): TestResult {
    const outcome = this.mapStatus(result?.state ?? 'skip');
    const duration = result?.duration ?? 0;

    const maxDuration = this.config.maxDuration || 60000;
    const finalOutcome = duration > maxDuration ? 'failed' : outcome;

    const testResult: TestResult = {
      testCase: this.normalizeTestCaseName(name, filepath),
      outcome: finalOutcome,
      duration: duration,
      metadata: {
        framework: 'vitest',
        filepath: filepath,
        originalStatus: result?.state ?? 'skip',
        isTodo: result?.state === 'todo',
      },
    };

    if (result?.error && (finalOutcome === 'failed' || outcome === 'failed')) {
      let errorMessage = result?.error?.message ?? 'Test failed';
      if (this.config.stripAnsiColors) {
        errorMessage = this.stripAnsiColors(errorMessage);
      }

      const errorStack = result?.error?.stack ?? '';
      testResult.error = `${errorMessage}${errorStack ? `\n\n${errorStack}` : ''}`;
    }

    return testResult;
  }

  private mapStatus(status: VitestAssertionResult['status'] | 'pass' | 'fail' | 'skip' | 'todo' | 'run'): TestResult['outcome'] {
    switch (status) {
      case 'passed':
      case 'pass':
        return 'passed';
      case 'failed':
      case 'fail':
        return 'failed';
      case 'skipped':
      case 'skip':
      case 'pending':
      case 'todo':
        return 'skipped';
      default:
        return 'skipped';
    }
  }

  private normalizeTestCaseName(name: string, filepath: string | undefined): string {
    const normalized = name
      .replace(/[\s()[]+/g, '-')
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
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}

export function generateVitestCommand(outputPath: string = 'vitest-results.json'): string {
  return `npx vitest run --reporter=json --output=${outputPath}`;
}