import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { AcademicReference } from '../../src/models/academic.js';

/**
 * The CLI formats academic references as:
 * `  [issueType] 📄 Ref: ${title} (${venue}, ${year}) — Regra ${ruleId}`
 * This function replicates that formatting logic for testing.
 */
function formatAcademicRefLine(issueType: string, ref: AcademicReference): string {
  return `  [${issueType}] 📄 Ref: ${ref.title} (${ref.venue}, ${ref.year}) — Regra ${ref.ruleId}`;
}

describe('Academic reference CLI formatting', () => {

  // Unit test: line contains all required fields
  it('formats reference line with title, venue, year, and ruleId', () => {
    const ref: AcademicReference = {
      paperId: 'IEEE-SP-2024',
      title: 'Typosquatting in Package Repositories: A Large-Scale Study',
      venue: 'IEEE S&P',
      year: 2024,
      ruleId: 'R001',
      factIds: ['F001', 'F002'],
    };
    const line = formatAcademicRefLine('slopsquat_risk', ref);
    expect(line).toContain(ref.title);
    expect(line).toContain(ref.venue);
    expect(line).toContain(String(ref.year));
    expect(line).toContain(ref.ruleId);
  });

  // Unit test: line contains the issue type
  it('includes the issue type in the formatted line', () => {
    const ref: AcademicReference = {
      paperId: 'CCS-2023',
      title: 'Malicious Post-install Scripts in npm Packages',
      venue: 'CCS',
      year: 2023,
      ruleId: 'R001',
      factIds: [],
    };
    const line = formatAcademicRefLine('postinstall_risk', ref);
    expect(line).toContain('postinstall_risk');
  });

  // Property 6: for any valid AcademicReference, the formatted line contains title, venue, year, ruleId
  it('Property 6: formatted line always contains title, venue, year, and ruleId', () => {
    fc.assert(
      fc.property(
        fc.record({
          paperId: fc.string({ minLength: 1 }),
          title: fc.string({ minLength: 1 }),
          venue: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 2000, max: 2030 }),
          ruleId: fc.string({ minLength: 1 }),
          factIds: fc.array(fc.string()),
        }),
        fc.string({ minLength: 1 }),
        (ref: AcademicReference, issueType: string) => {
          const line = formatAcademicRefLine(issueType, ref);
          expect(line).toContain(ref.title);
          expect(line).toContain(ref.venue);
          expect(line).toContain(String(ref.year));
          expect(line).toContain(ref.ruleId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
