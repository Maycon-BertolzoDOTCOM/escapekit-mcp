import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ContratoYAML } from '../../src/models/academic.js';
import { arbitraryContratoYAML } from '../academic/arbitraries.js';

const optionalString = fc.option(fc.string({ minLength: 1 }), { nil: undefined });

function arbitraryContratoWithOptionalFields(): fc.Arbitrary<ContratoYAML> {
  return fc.record({
    source: fc.record({
      title: fc.string({ minLength: 1 }),
      authors: fc.string({ minLength: 1 }),
      year: fc.integer({ min: 2000, max: 2030 }),
      doi: optionalString,
      url: optionalString,
    }),
    facts: fc.array(
      fc.record({
        id: fc.string({ minLength: 1 }),
        statement: fc.string(),
        type: fc.string(),
        relevance: fc.string(),
      }),
      { minLength: 1, maxLength: 5 }
    ),
    rules: fc.array(
      fc.record({
        id: fc.string({ minLength: 1 }),
        principle: fc.string(),
        derived_from: fc.array(fc.string()),
        action: fc.string(),
        detector_name: fc.option(
          fc.constantFrom(
            'SlopsquatDetector',
            'PostInstallDetector',
            'PolyfillInjector',
            'WebGLDetector',
            'ConfigUpdater',
            'DependencyValidator'
          ),
          { nil: undefined }
        ),
        paperRef: fc.option(
          fc.constantFrom(
            'IEEE-SP-2024',
            'CCS-2023',
            'ESEC-FSE-2024',
            'ICWE-2024',
            'ASE-2023-Config',
            'ASE-2023-Ghost',
            'ICSE-2024'
          ),
          { nil: undefined }
        ),
        priority: fc.constantFrom('high' as const, 'medium' as const, 'low' as const),
      }),
      { minLength: 1, maxLength: 5 }
    ),
    traceability: fc.option(
      fc.dictionary(
        fc.string({ minLength: 1 }),
        fc.record({
          implementation: fc.string(),
          tests: fc.string(),
          status: fc.constantFrom(
            'implemented' as const,
            'pending' as const,
            'not_applicable' as const
          ),
        })
      ),
      { nil: undefined }
    ),
  });
}

describe('Contracts YAML round-trip', () => {
  it('serializing to YAML and deserializing preserves contract source, facts, and rules', () => {
    fc.assert(
      fc.property(arbitraryContratoYAML(), contract => {
        const yamlStr = stringifyYaml(contract);
        const parsed = parseYaml(yamlStr) as ContratoYAML;

        expect(parsed.source.title).toEqual(contract.source.title);
        expect(parsed.source.authors).toEqual(contract.source.authors);
        expect(parsed.source.year).toEqual(contract.source.year);
        expect(parsed.facts.length).toEqual(contract.facts.length);
        expect(parsed.rules.length).toEqual(contract.rules.length);

        for (let i = 0; i < contract.facts.length; i++) {
          expect(parsed.facts[i].id).toEqual(contract.facts[i].id);
          expect(parsed.facts[i].statement).toEqual(contract.facts[i].statement);
          expect(parsed.facts[i].type).toEqual(contract.facts[i].type);
          expect(parsed.facts[i].relevance).toEqual(contract.facts[i].relevance);
        }

        for (let i = 0; i < contract.rules.length; i++) {
          expect(parsed.rules[i].id).toEqual(contract.rules[i].id);
          expect(parsed.rules[i].principle).toEqual(contract.rules[i].principle);
          expect(parsed.rules[i].action).toEqual(contract.rules[i].action);
          expect(parsed.rules[i].priority).toEqual(contract.rules[i].priority);
          expect(parsed.rules[i].derived_from).toEqual(contract.rules[i].derived_from);
          expect(parsed.rules[i].detector_name).toEqual(contract.rules[i].detector_name);
          expect(parsed.rules[i].paperRef).toEqual(contract.rules[i].paperRef);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip preserves traceability entries', () => {
    fc.assert(
      fc.property(arbitraryContratoYAML(), contract => {
        const yamlStr = stringifyYaml(contract);
        const parsed = parseYaml(yamlStr) as ContratoYAML;

        if (contract.traceability) {
          expect(parsed.traceability).toBeDefined();
          for (const [key, entry] of Object.entries(contract.traceability)) {
            expect(parsed.traceability![key]).toBeDefined();
            expect(parsed.traceability![key].implementation).toEqual(entry.implementation);
            expect(parsed.traceability![key].tests).toEqual(entry.tests);
            expect(parsed.traceability![key].status).toEqual(entry.status);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip preserves optional source fields (doi, url)', () => {
    fc.assert(
      fc.property(arbitraryContratoWithOptionalFields(), contract => {
        const yamlStr = stringifyYaml(contract);
        const parsed = parseYaml(yamlStr) as ContratoYAML;

        expect(parsed.source.doi).toEqual(contract.source.doi);
        expect(parsed.source.url).toEqual(contract.source.url);
      }),
      { numRuns: 50 }
    );
  });
});
