/**
 * Test result types
 */

export interface TestResult {
  testCase: string;
  outcome: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}