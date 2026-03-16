import { KiwiClient } from './lib/kiwi-client';
import { TestResultParser } from './lib/test-parser';
import { logger } from '../src/logger';

class KiwiIntegration {
  private client: KiwiClient;
  
  constructor(private config: {
    baseUrl: string;
    username: string;
    password: string;
  }) {
    this.client = new KiwiClient(config);
  }

  async importResults(testRunId: number, results: TestResult[]) {
    try {
      const parsed = TestResultParser.parse(results);
      await this.client.uploadResults(testRunId, parsed);
      logger.info(`Successfully imported ${parsed.length} test results`);
      return true;
    } catch (error) {
      logger.error('Failed to import test results', { error });
      return false;
    }
  }

  async createTestRun(name: string, planId: number) {
    return this.client.createTestRun(name, planId);
  }
}

// Helper types
interface TestResult {
  testCase: string;
  outcome: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}