import { TestResult } from './types';
import { logger } from '../logger';

export class TestResultParser {
  static parse(results: any[]): TestResult[] {
    return results.map(result => {
      try {
        return {
          testCase: this.normalizeCaseName(result.name),
          outcome: this.mapOutcome(result.status),
          duration: result.duration || 0,
          error: result.error || undefined
        };
      } catch (error) {
        logger.warn('Failed to parse test result', { result, error });
        return null;
      }
    }).filter(Boolean) as TestResult[];
  }

  private static normalizeCaseName(name: string) {
    return name.replace(/\s+/g, '-').toLowerCase();
  }

  private static mapOutcome(status: string): TestResult['outcome'] {
    switch (status.toLowerCase()) {
      case 'passed': return 'passed';
      case 'failed': return 'failed';
      default: return 'skipped';
    }
  }
}