/**
 * Test Adapter Interface
 * Defines the contract for all test framework adapters
 */

export interface TestResult {
  testCase: string;
  outcome: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TestAdapter {
  /**
   * Load test results from a file or string
   * @param source - File path or raw content
   * @returns Parsed test results
   */
  load(source: string): Promise<TestResult[]>;

  /**
   * Get the framework name this adapter supports
   */
  getFrameworkName(): string;

  /**
   * Check if this adapter can handle the given source
   * @param source - File path or content to check
   */
  canHandle(source: string): boolean;
}

export interface AdapterConfig {
  includeSkipped?: boolean;
  includeTodo?: boolean;
  stripAnsiColors?: boolean;
  maxDuration?: number; // Maximum duration in ms, tests exceeding this are marked as failed
}