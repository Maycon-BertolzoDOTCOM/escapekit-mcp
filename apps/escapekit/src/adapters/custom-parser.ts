/**
 * Custom Test Parser
 * Parses custom JSON test result formats and converts to Kiwi TCMS format
 */

import { TestAdapter, TestResult, AdapterConfig } from './index';

export interface CustomTestSchema {
  version: string;
  framework: string;
  tests: CustomTestCase[];
  metadata?: Record<string, unknown>;
}

export interface CustomTestCase {
  id?: string;
  name: string;
  suite?: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration?: number;
  error?: string;
  errorType?: string;
  stackTrace?: string;
  timestamp?: string;
}

export interface CustomParserConfig extends AdapterConfig {
  schema?: CustomTestSchema;
  transform?: (test: CustomTestCase, suite?: string) => TestResult;
  validateSchema?: boolean;
}

function isCustomTestSchema(data: unknown): data is CustomTestSchema {
  return (
    data !== null &&
    typeof data === 'object' &&
    'version' in data &&
    'framework' in data &&
    'tests' in data &&
    Array.isArray((data as CustomTestSchema).tests)
  );
}

export class CustomTestParser implements TestAdapter {
  private config: CustomParserConfig;
  private customSchema: CustomTestSchema | null = null;

  constructor(config: CustomParserConfig = {}) {
    this.config = {
      includeSkipped: true,
      includeTodo: true,
      stripAnsiColors: true,
      maxDuration: 60000,
      validateSchema: true,
      ...config,
    };

    if (this.config.schema) {
      this.customSchema = this.config.schema;
    }
  }

  getFrameworkName(): string {
    return this.customSchema?.framework || 'custom';
  }

  canHandle(source: string): boolean {
    return typeof source === 'string' && 
      (source.endsWith('.json') || source.startsWith('{') || source.startsWith('['));
  }

  async load(source: string): Promise<TestResult[]> {
    let data: unknown;

    try {
      if (source.endsWith('.json')) {
        const module = await import(source);
        data = module.default ?? module;
      } else {
        data = JSON.parse(source);
      }

      if (this.config.validateSchema !== false && !isCustomTestSchema(data)) {
        throw new Error('Invalid custom test schema');
      }

      return this.parseCustomResults(data as CustomTestSchema);
    } catch (error) {
      throw new Error(`Failed to parse custom JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseCustomResults(data: CustomTestSchema): TestResult[] {
    const framework = data.framework || this.getFrameworkName();
    const metadata = data.metadata || {};

    const results = data.tests.map(test => {
      const transformed = this.config.transform
        ? this.config.transform(test, test.suite)
        : this.defaultTransform(test, framework, metadata);

      return this.applyConfig(transformed);
    });

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

  private defaultTransform(
    test: CustomTestCase,
    framework: string,
    metadata: Record<string, unknown>
  ): TestResult {
    const duration = test.duration || 0;
    const maxDuration = this.config.maxDuration || 60000;
    const outcome = duration > maxDuration ? 'failed' : this.mapStatus(test.status);

    const result: TestResult = {
      testCase: this.normalizeTestCaseName(test.name, test.suite || framework),
      outcome,
      duration: Math.round(duration),
      metadata: {
        framework,
        suite: test.suite || framework,
        customId: test.id,
        isSkipped: test.status === 'skipped',
        customMetadata: metadata,
      },
    };

    if (outcome === 'failed') {
      let error = test.error || test.errorType || 'Test failed';
      if (test.stackTrace) {
        error += `\n\n${test.stackTrace}`;
      }
      if (this.config.stripAnsiColors) {
        error = this.stripAnsiColors(error);
      }
      result.error = error;
    }

    return result;
  }

  private applyConfig(result: TestResult): TestResult {
    const maxDuration = this.config.maxDuration || 60000;

    if (result.duration > maxDuration) {
      return {
        ...result,
        outcome: 'failed' as TestResult['outcome'],
      };
    }

    return result;
  }

  private mapStatus(status: string): TestResult['outcome'] {
    switch (status.toLowerCase()) {
      case 'passed':
      case 'success':
      case 'ok':
        return 'passed';
      case 'failed':
      case 'error':
      case 'fail':
        return 'failed';
      case 'skipped':
      case 'pending':
      case 'todo':
        return 'skipped';
      default:
        return 'failed';
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
      .replace(/[()[\]]+/g, '-')
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

/**
 * Helper function to create a custom test result object
 */
export function createCustomTestResult(
  framework: string,
  tests: CustomTestCase[],
  metadata?: Record<string, unknown>
): CustomTestSchema {
  return {
    version: '1.0',
    framework,
    tests,
    metadata,
  };
}

/**
 * Example custom transform function
 */
export function exampleTransform(
  test: CustomTestCase,
  suite?: string
): TestResult {
  const duration = test.duration || 0;
  const outcome = test.status === 'passed' ? 'passed' : 
                 test.status === 'skipped' ? 'skipped' : 'failed';

  return {
    testCase: `${suite ? suite + '-' : ''}${test.name.toLowerCase().replace(/\s+/g, '-')}`,
    outcome,
    duration: Math.round(duration),
    metadata: {
      framework: suite || 'custom',
      suite: suite || 'unknown',
      customId: test.id,
      timestamp: test.timestamp,
    },
  };
}