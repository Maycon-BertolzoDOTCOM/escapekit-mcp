import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CoverageValidator } from '../../src/academic/CoverageValidator.js';
import { arbitraryContratoYAML, arbitraryFullyImplementedContratoYAML } from './arbitraries.js';

describe('CoverageValidator', () => {

  // Unit test: empty array returns coveragePercentage: 0.0
  it('returns coveragePercentage 0.0 for empty contracts array', () => {
    const validator = new CoverageValidator();
    const report = validator.validate([]);
    expect(report.coveragePercentage).toBe(0.0);
    expect(report.totalRules).toBe(0);
    expect(report.totalFacts).toBe(0);
    expect(report.totalImplemented).toBe(0);
    expect(report.contracts).toHaveLength(0);
  });

  // Unit test: contract without traceability has zero coverage
  it('contract without traceability has zero coverage', () => {
    const validator = new CoverageValidator();
    const report = validator.validate([{
      source: { title: 'Test', authors: 'Test', year: 2024 },
      facts: [{ id: 'F001', statement: 'test', type: 'fact', relevance: 'security' }],
      rules: [{ id: 'R001', principle: 'test', derived_from: [], action: 'test', priority: 'high' }],
    }]);
    expect(report.coveragePercentage).toBe(0.0);
    expect(report.totalImplemented).toBe(0);
    expect(report.contracts[0].gaps).toContain('R001');
    expect(report.contracts[0].gaps).toContain('F001');
  });

  // Unit test: gaps are listed correctly
  it('lists gaps for rules and facts without traceability entries', () => {
    const validator = new CoverageValidator();
    const report = validator.validate([{
      source: { title: 'Test', authors: 'Test', year: 2024 },
      facts: [
        { id: 'F001', statement: 'test', type: 'fact', relevance: 'security' },
        { id: 'F002', statement: 'test2', type: 'fact', relevance: 'security' },
      ],
      rules: [
        { id: 'R001', principle: 'test', derived_from: [], action: 'test', priority: 'high' },
        { id: 'R002', principle: 'test2', derived_from: [], action: 'test', priority: 'medium' },
      ],
      traceability: {
        R001: { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' },
        F001: { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' },
      },
    }]);
    expect(report.contracts[0].gaps).toContain('R002');
    expect(report.contracts[0].gaps).toContain('F002');
    expect(report.contracts[0].gaps).not.toContain('R001');
    expect(report.contracts[0].gaps).not.toContain('F001');
  });

  // Unit test: fully implemented contract has 100% coverage
  it('fully implemented contract has 100% coverage', () => {
    const validator = new CoverageValidator();
    const report = validator.validate([{
      source: { title: 'Test', authors: 'Test', year: 2024 },
      facts: [{ id: 'F001', statement: 'test', type: 'fact', relevance: 'security' }],
      rules: [{ id: 'R001', principle: 'test', derived_from: [], action: 'test', priority: 'high' }],
      traceability: {
        R001: { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' },
        F001: { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' },
      },
    }]);
    expect(report.coveragePercentage).toBe(100.0);
    expect(report.contracts[0].gaps).toHaveLength(0);
  });

  // Property 3: coveragePercentage = (implemented / total) * 100
  it('Property 3: coveragePercentage = (implemented / total) * 100', () => {
    fc.assert(
      fc.property(fc.array(arbitraryContratoYAML(), { minLength: 1, maxLength: 10 }), (contracts) => {
        const validator = new CoverageValidator();
        const report = validator.validate(contracts);
        const total = report.totalRules + report.totalFacts;
        if (total === 0) {
          expect(report.coveragePercentage).toBe(0.0);
        } else {
          const expected = Math.round((report.totalImplemented / total) * 1000) / 10;
          expect(report.coveragePercentage).toBe(expected);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 4: all implemented → coveragePercentage === 100.0
  it('Property 4: all implemented → coveragePercentage === 100.0', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryFullyImplementedContratoYAML(), { minLength: 1, maxLength: 10 }),
        (contracts) => {
          const validator = new CoverageValidator();
          const report = validator.validate(contracts);
          expect(report.coveragePercentage).toBe(100.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 7: rules/facts without traceability appear as gaps
  it('Property 7: rules/facts without traceability appear as gaps', () => {
    fc.assert(
      fc.property(arbitraryContratoYAML(), (contract) => {
        const validator = new CoverageValidator();
        const report = validator.validate([contract]);
        const contractReport = report.contracts[0];

        const allIds = [
          ...contract.rules.map(r => r.id),
          ...contract.facts.map(f => f.id),
        ];
        const tracedIds = Object.keys(contract.traceability ?? {});
        const expectedGaps = allIds.filter(id => !tracedIds.includes(id));

        expect(contractReport.gaps).toEqual(expect.arrayContaining(expectedGaps));
        expect(contractReport.gaps.length).toBe(expectedGaps.length);
      }),
      { numRuns: 100 }
    );
  });
});
