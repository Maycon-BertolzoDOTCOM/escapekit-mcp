/**
 * JSONReporter - Outputs validation results as JSON
 *
 * Suitable for CI/CD pipelines and programmatic consumption.
 *
 * @module validate/reporters/JSONReporter
 */

import type { ValidationResult, Reporter } from '../types.js';

export class JSONReporter implements Reporter {
  private readonly output: 'stdout' | 'return';

  constructor(output: 'stdout' | 'return' = 'stdout') {
    this.output = output;
  }

  async report(result: ValidationResult): Promise<void> {
    const json = JSON.stringify(result, null, 2);

    if (this.output === 'stdout') {
      process.stdout.write(json + '\n');
    }
    // If 'return', the caller retrieves the result via the engine's return value
  }

  format(result: ValidationResult): string {
    return JSON.stringify(result, null, 2);
  }
}
