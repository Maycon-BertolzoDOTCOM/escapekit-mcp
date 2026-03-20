/**
 * ValidationReporter - Composite reporter that delegates to multiple reporters
 *
 * @module validate/reporters/ValidationReporter
 */

import type { ValidationResult, Reporter } from '../types.js';
import { CLIReporter } from './CLIReporter.js';
import { JSONReporter } from './JSONReporter.js';

export class ValidationReporter implements Reporter {
  private reporters: Reporter[] = [];

  constructor(format: 'cli' | 'json' = 'cli') {
    if (format === 'cli') {
      this.reporters.push(new CLIReporter());
    } else if (format === 'json') {
      this.reporters.push(new JSONReporter());
    }
  }

  addReporter(reporter: Reporter): void {
    this.reporters.push(reporter);
  }

  async report(result: ValidationResult): Promise<void> {
    for (const reporter of this.reporters) {
      await reporter.report(result);
    }
  }
}
