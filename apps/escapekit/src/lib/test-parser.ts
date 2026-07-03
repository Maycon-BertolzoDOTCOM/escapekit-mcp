import { TestResult } from './types';
import { logger } from '../logger';

function isRawResult(r: unknown): r is { name: string; status: string; duration?: number; error?: string } {
  return typeof r === 'object' && r !== null && 'name' in r && 'status' in r;
}

export class TestResultParser {
  static parse(results: unknown[]): TestResult[] {
    return results.map(result => {
      try {
        if (!isRawResult(result)) {
          throw new Error('Invalid test result format');
        }
        
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