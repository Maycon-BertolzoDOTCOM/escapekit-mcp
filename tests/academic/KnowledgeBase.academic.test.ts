import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase.js';
import { arbitraryContratoYAML } from './arbitraries.js';

describe('KnowledgeBase — academic extension', () => {

  // Unit test: concrete mapping SlopsquatDetector → IEEE-SP-2024
  it('maps SlopsquatDetector to IEEE-SP-2024 from real contracts', async () => {
    const kb = new KnowledgeBase();
    await kb.loadPaperContracts('knowledge-base/registry.yaml');
    const refs = kb.getAcademicReference('SlopsquatDetector');
    expect(refs).toBeDefined();
    expect(refs!.length).toBeGreaterThan(0);
    expect(refs![0].paperId).toBe('IEEE-SP-2024');
  });

  // Unit test: unknown issueType returns undefined without throwing
  it('returns undefined for unknown issueType', async () => {
    const kb = new KnowledgeBase();
    await kb.loadPaperContracts('knowledge-base/registry.yaml');
    expect(() => kb.getAcademicReference('nonexistent_type')).not.toThrow();
    expect(kb.getAcademicReference('nonexistent_type')).toBeUndefined();
  });

  // Unit test: invalid YAML does not throw
  it('does not throw when registry file does not exist', async () => {
    const kb = new KnowledgeBase();
    await expect(kb.loadPaperContracts('nonexistent/registry.yaml')).resolves.not.toThrow();
    expect(kb.getAcademicReference('SlopsquatDetector')).toBeUndefined();
  });

  // Unit test: empty contracts array initializes empty index
  it('loadContractsSync with empty array initializes empty index', () => {
    const kb = new KnowledgeBase();
    kb.loadContractsSync([]);
    expect(kb.getAcademicReference('SlopsquatDetector')).toBeUndefined();
  });

  // Unit test: loadContractsSync maps implemented rules with paperRef
  it('loadContractsSync maps implemented rules with paperRef to detector_name', () => {
    const kb = new KnowledgeBase();
    kb.loadContractsSync([{
      source: { title: 'Test Paper', authors: 'Test', year: 2024 },
      facts: [{ id: 'F001', statement: 'test', type: 'fact', relevance: 'security' }],
      rules: [{
        id: 'R001',
        principle: 'test',
        derived_from: ['F001'],
        action: 'implement_detector',
        detector_name: 'SlopsquatDetector',
        paperRef: 'IEEE-SP-2024',
        priority: 'high',
      }],
      traceability: {
        R001: { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' },
      },
    }]);
    const refs = kb.getAcademicReference('SlopsquatDetector');
    expect(refs).toBeDefined();
    expect(refs![0].paperId).toBe('IEEE-SP-2024');
    expect(refs![0].ruleId).toBe('R001');
  });

  // Unit test: pending rules are NOT indexed
  it('loadContractsSync does not index pending rules', () => {
    const kb = new KnowledgeBase();
    kb.loadContractsSync([{
      source: { title: 'Test Paper', authors: 'Test', year: 2024 },
      facts: [],
      rules: [{
        id: 'R001',
        principle: 'test',
        derived_from: [],
        action: 'implement_detector',
        detector_name: 'SlopsquatDetector',
        paperRef: 'IEEE-SP-2024',
        priority: 'high',
      }],
      traceability: {
        R001: { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'pending' },
      },
    }]);
    expect(kb.getAcademicReference('SlopsquatDetector')).toBeUndefined();
  });

  // Property 1: round-trip — implemented rules with paperRef appear in index
  it('Property 1: round-trip — implemented rules with paperRef appear in index', () => {
    fc.assert(
      fc.property(fc.array(arbitraryContratoYAML(), { minLength: 1, maxLength: 10 }), (contracts) => {
        const kb = new KnowledgeBase();
        kb.loadContractsSync(contracts);
        const implementedRules = contracts.flatMap(c =>
          c.rules.filter(r =>
            r.paperRef &&
            r.detector_name &&
            c.traceability?.[r.id]?.status === 'implemented'
          )
        );
        for (const rule of implementedRules) {
          const refs = kb.getAcademicReference(rule.detector_name!);
          expect(refs).toBeDefined();
          expect(refs!.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 2: only implemented rules with paperRef contribute to the index
  it('Property 2: only implemented rules with paperRef contribute to the index', () => {
    fc.assert(
      fc.property(fc.array(arbitraryContratoYAML(), { minLength: 1, maxLength: 10 }), (contracts) => {
        const kb = new KnowledgeBase();
        kb.loadContractsSync(contracts);
        // Rules without paperRef or without implemented status should NOT be indexed
        const nonContributingRules = contracts.flatMap(c =>
          c.rules.filter(r =>
            r.detector_name &&
            (!r.paperRef || c.traceability?.[r.id]?.status !== 'implemented')
          )
        );
        for (const rule of nonContributingRules) {
          // Check that this specific rule's detector is not indexed SOLELY because of this rule
          // (it might be indexed by another rule that IS implemented)
          // We verify by checking a fresh KB with only this contract
          const singleContract = contracts.find(c => c.rules.includes(rule))!;
          const otherImplemented = singleContract.rules.some(r =>
            r.detector_name === rule.detector_name &&
            r.paperRef &&
            singleContract.traceability?.[r.id]?.status === 'implemented'
          );
          if (!otherImplemented) {
            const kbSingle = new KnowledgeBase();
            kbSingle.loadContractsSync([singleContract]);
            // If no other implemented rule for this detector, it should not be indexed
            const refs = kbSingle.getAcademicReference(rule.detector_name!);
            // Only assert if this rule is the only one for this detector
            const allRulesForDetector = singleContract.rules.filter(r => r.detector_name === rule.detector_name);
            const anyImplemented = allRulesForDetector.some(r =>
              r.paperRef && singleContract.traceability?.[r.id]?.status === 'implemented'
            );
            if (!anyImplemented) {
              expect(refs).toBeUndefined();
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 5: determinism
  it('Property 5: deterministic output for same input', () => {
    fc.assert(
      fc.property(fc.array(arbitraryContratoYAML(), { minLength: 0, maxLength: 10 }), (contracts) => {
        const kb1 = new KnowledgeBase();
        kb1.loadContractsSync(contracts);
        const kb2 = new KnowledgeBase();
        kb2.loadContractsSync(contracts);

        const allDetectorNames = contracts.flatMap(c =>
          c.rules.map(r => r.detector_name).filter(Boolean)
        );
        for (const detectorName of allDetectorNames) {
          expect(kb1.getAcademicReference(detectorName!)).toEqual(
            kb2.getAcademicReference(detectorName!)
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
