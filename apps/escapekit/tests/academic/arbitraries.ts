// tests/academic/arbitraries.ts — fast-check generators for property-based tests
import * as fc from 'fast-check';
import type { ContratoYAML } from '../../src/models/academic.js';

const paperIds = ['IEEE-SP-2024', 'CCS-2023', 'ESEC-FSE-2024', 'ICWE-2024', 'ASE-2023-Config', 'ASE-2023-Ghost', 'ICSE-2024'];
const detectorNames = ['SlopsquatDetector', 'PostInstallDetector', 'PolyfillInjector', 'WebGLDetector', 'ConfigUpdater', 'DependencyValidator'];
const statuses = ['implemented', 'pending', 'not_applicable'] as const;

export function arbitraryContratoYAML(): fc.Arbitrary<ContratoYAML> {
  return fc.record({
    source: fc.record({
      title: fc.string({ minLength: 1 }),
      authors: fc.string({ minLength: 1 }),
      year: fc.integer({ min: 2000, max: 2030 }),
    }),
    facts: fc.array(
      fc.record({ id: fc.string({ minLength: 1 }), statement: fc.string(), type: fc.string(), relevance: fc.string() }),
      { minLength: 1, maxLength: 5 }
    ),
    rules: fc.array(
      fc.record({
        id: fc.string({ minLength: 1 }),
        principle: fc.string(),
        derived_from: fc.array(fc.string()),
        action: fc.string(),
        detector_name: fc.option(fc.constantFrom(...detectorNames), { nil: undefined }),
        paperRef: fc.option(fc.constantFrom(...paperIds), { nil: undefined }),
        priority: fc.constantFrom('high' as const, 'medium' as const, 'low' as const),
      }),
      { minLength: 1, maxLength: 5 }
    ),
    traceability: fc.option(
      fc.dictionary(fc.string({ minLength: 1 }), fc.record({
        implementation: fc.string(),
        tests: fc.string(),
        status: fc.constantFrom(...statuses),
      })),
      { nil: undefined }
    ),
  });
}

export function arbitraryFullyImplementedContratoYAML(): fc.Arbitrary<ContratoYAML> {
  return arbitraryContratoYAML().map(contract => {
    const traceability: ContratoYAML['traceability'] = {};
    for (const rule of contract.rules) {
      traceability![rule.id] = { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' };
    }
    for (const fact of contract.facts) {
      traceability![fact.id] = { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' };
    }
    return { ...contract, traceability };
  });
}
