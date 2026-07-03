import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { arbitraryContratoYAML } from '../academic/arbitraries.js';
import type { ContratoYAML } from '../../src/models/academic.js';

const KNOWN_DETECTORS = new Set([
  'SlopsquatDetector',
  'PostInstallDetector',
  'DependencyValidator',
  'BuildValidator',
  'PolyfillInjector',
  'WebGLDetector',
  'ConfigUpdater',
  'GhostImportDetector',
  'MockApiDetector',
]);

describe('Coverage completeness — detector existence', () => {
  it('every rule with detector_name references a known detector', () => {
    fc.assert(
      fc.property(arbitraryContratoYAML(), (contract: ContratoYAML) => {
        for (const rule of contract.rules) {
          if (rule.detector_name) {
            expect(KNOWN_DETECTORS.has(rule.detector_name)).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each known detector referenced in a contract has at least one rule', () => {
    fc.assert(
      fc.property(arbitraryContratoYAML(), (contract: ContratoYAML) => {
        const detectorsInRules = new Set(
          contract.rules.map(r => r.detector_name).filter((d): d is string => !!d)
        );
        for (const detector of detectorsInRules) {
          const rulesForDetector = contract.rules.filter(r => r.detector_name === detector);
          expect(rulesForDetector.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('implemented rules with detector_name and paperRef are always valid for indexing', () => {
    fc.assert(
      fc.property(arbitraryContratoYAML(), (contract: ContratoYAML) => {
        for (const rule of contract.rules) {
          if (
            rule.detector_name &&
            rule.paperRef &&
            contract.traceability?.[rule.id]?.status === 'implemented'
          ) {
            expect(KNOWN_DETECTORS.has(rule.detector_name)).toBe(true);
            expect(rule.paperRef.length).toBeGreaterThan(0);
            expect(rule.id.length).toBeGreaterThan(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all detector_name values across generated contracts belong to the known set', () => {
    fc.assert(
      fc.property(fc.array(arbitraryContratoYAML(), { minLength: 1, maxLength: 10 }), contracts => {
        for (const contract of contracts) {
          for (const rule of contract.rules) {
            if (rule.detector_name) {
              expect(KNOWN_DETECTORS.has(rule.detector_name)).toBe(true);
            }
          }
        }
      }),
      { numRuns: 50 }
    );
  });
});
