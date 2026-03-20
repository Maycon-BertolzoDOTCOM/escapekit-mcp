/**
 * Kiwi TCMS Integration Module
 * Uses REST API client for all operations
 */

import { KiwiClient, KiwiClientConfig } from '../src/lib/kiwi-client';
import { TestResult } from '../src/adapters/index';
import { getLogger } from '../scripts/kiwi-logger';

const logger = getLogger();

export interface IntegrationConfig extends KiwiClientConfig {
  defaultPlanId?: number;
  defaultProduct?: string;
  testRunTemplate?: string;
}

export class KiwiIntegration {
  private client: KiwiClient;

  constructor(private config: IntegrationConfig) {
    this.client = new KiwiClient(config);
  }

  async connect(): Promise<boolean> {
    return this.client.authenticate();
  }

  async importResults(testRunId: number, results: TestResult[]): Promise<boolean> {
    try {
      const statusMap = await this.client.getStatusMap();
      let success = 0;

      for (const result of results) {
        try {
          const testCase = await this.client.findTestCase(result.testCase);
          if (!testCase) {
            logger.warn(`Test case not found: ${result.testCase}`);
            continue;
          }

          const statusId = statusMap[result.outcome] || statusMap['skipped'];
          await this.client.addTestExecution({
            case: testCase.id,
            run: testRunId,
            build: 1,
            status: statusId,
            comment: result.error || '',
          });
          success++;
        } catch (err: any) {
          logger.error(`Failed to upload ${result.testCase}: ${err.message}`);
        }
      }

      logger.info(`Imported ${success}/${results.length} test results`);
      return success > 0;
    } catch (error) {
      logger.error('Failed to import test results', { error });
      return false;
    }
  }

  async createTestRun(summary: string, planId: number): Promise<{ id: number }> {
    return this.client.createTestRun({
      summary,
      plan: planId,
      build: 1,
    });
  }

  getClient(): KiwiClient {
    return this.client;
  }
}
