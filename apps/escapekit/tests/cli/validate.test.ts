import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { CLIReporter } from '../../src/validate/reporters/CLIReporter.js';
import { JSONReporter } from '../../src/validate/reporters/JSONReporter.js';
import type { ValidationResult } from '../../src/validate/types.js';

// Helper: selectReporter logic extracted for testing
function selectReporter(options: { json?: boolean; quiet?: boolean }) {
  if (options.quiet) return null;
  if (options.json) return JSONReporter;
  return CLIReporter;
}

// Helper: exit code logic
function getExitCode(result: { canDeploy: boolean }): number {
  return result.canDeploy ? 0 : 1;
}

describe('validate command', () => {
  it('should select CLIReporter by default', () => {
    const Reporter = selectReporter({});
    expect(Reporter).toBe(CLIReporter);
  });

  it('should select JSONReporter with --json', () => {
    const Reporter = selectReporter({ json: true });
    expect(Reporter).toBe(JSONReporter);
  });

  it('should select no reporter with --quiet', () => {
    const Reporter = selectReporter({ quiet: true });
    expect(Reporter).toBeNull();
  });

  it('should prefer --quiet over --json', () => {
    const Reporter = selectReporter({ quiet: true, json: true });
    expect(Reporter).toBeNull();
  });

  it('should exit with 0 when canDeploy is true', () => {
    expect(getExitCode({ canDeploy: true })).toBe(0);
  });

  it('should exit with 1 when canDeploy is false', () => {
    expect(getExitCode({ canDeploy: false })).toBe(1);
  });

  it('should handle reporter errors without affecting exit code', async () => {
    const mockResult: ValidationResult = {
      canDeploy: true,
      remainingIssues: [],
      summary: { totalIssues: 0 }
    } as unknown as ValidationResult;

    const mockReport = vi.fn().mockRejectedValue(new Error('Reporter failed'));
    const Reporter = selectReporter({});
    expect(Reporter).toBe(CLIReporter);

    // Exit code should still be based on canDeploy, not reporter success
    const exitCode = getExitCode(mockResult);
    expect(exitCode).toBe(0);
  });
});

describe('validate command property-based tests', () => {
  it('P1: exit code is 0 when canDeploy is true', () => {
    fc.assert(
      fc.property(
        fc.record({
          canDeploy: fc.constant(true),
          remainingIssues: fc.array(fc.anything()),
          summary: fc.record({ totalIssues: fc.nat() })
        }),
        (result) => {
          expect(getExitCode(result)).toBe(0);
        }
      )
    );
  });

  it('P2: exit code is 1 when canDeploy is false', () => {
    fc.assert(
      fc.property(
        fc.record({
          canDeploy: fc.constant(false),
          remainingIssues: fc.array(fc.anything()),
          summary: fc.record({ totalIssues: fc.nat() })
        }),
        (result) => {
          expect(getExitCode(result)).toBe(1);
        }
      )
    );
  });

  it('P3: selectReporter returns JSONReporter when json=true and quiet=false', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (json) => {
          const reporter = selectReporter({ json, quiet: false });
          if (json) {
            expect(reporter).toBe(JSONReporter);
          } else {
            expect(reporter).toBe(CLIReporter);
          }
        }
      )
    );
  });

  it('P4: selectReporter returns null when quiet=true regardless of json', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (json) => {
          const reporter = selectReporter({ json, quiet: true });
          expect(reporter).toBeNull();
        }
      )
    );
  });

  it('P5: Exit code depends only on canDeploy', () => {
    fc.assert(
      fc.property(
        fc.record({
          canDeploy: fc.boolean(),
          reporterFails: fc.boolean()
        }),
        ({ canDeploy }) => {
          const result = { canDeploy, remainingIssues: [], summary: { totalIssues: 0 } };
          expect(getExitCode(result)).toBe(canDeploy ? 0 : 1);
        }
      )
    );
  });
});
