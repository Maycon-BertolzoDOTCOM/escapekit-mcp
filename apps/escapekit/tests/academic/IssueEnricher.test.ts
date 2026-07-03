import { describe, it, expect } from 'vitest';
import { enrichIssue, enrichIssues } from '../../src/academic/IssueEnricher.js';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase.js';
import type { Issue } from '../../src/models/schemas.js';

function makeIssue(type: Issue['type']): Issue {
  return {
    id: 'test-id',
    type,
    severity: 'warning',
    location: { line: 1 },
    message: 'test message',
    description: 'test description',
    autoFixable: false,
  };
}

function makeKBWithRef(detectorName: string): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.loadContractsSync([{
    source: { title: 'Test Paper', authors: 'Test', year: 2024 },
    facts: [],
    rules: [{
      id: 'R001',
      principle: 'test',
      derived_from: [],
      action: 'test',
      detector_name: detectorName,
      paperRef: 'IEEE-SP-2024',
      priority: 'high',
    }],
    traceability: {
      R001: { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' },
    },
  }]);
  return kb;
}

describe('IssueEnricher', () => {

  it('enrichIssue attaches academicReference when detector_name matches issue.type', () => {
    const kb = makeKBWithRef('slopsquat_risk');
    const issue = makeIssue('slopsquat_risk');
    const enriched = enrichIssue(issue, kb);
    expect(enriched.academicReference).toBeDefined();
    expect(enriched.academicReference!.paperId).toBe('IEEE-SP-2024');
    expect(enriched.academicReference!.ruleId).toBe('R001');
  });

  it('enrichIssue returns original issue unchanged when type has no reference', () => {
    const kb = new KnowledgeBase();
    kb.loadContractsSync([]);
    const issue = makeIssue('ghost_import');
    const enriched = enrichIssue(issue, kb);
    expect(enriched).toBe(issue); // same reference — not mutated
    expect(enriched.academicReference).toBeUndefined();
  });

  it('enrichIssue does not mutate the original issue', () => {
    const kb = makeKBWithRef('slopsquat_risk');
    const issue = makeIssue('slopsquat_risk');
    const enriched = enrichIssue(issue, kb);
    expect(enriched).not.toBe(issue); // new object
    expect(issue.academicReference).toBeUndefined(); // original unchanged
  });

  it('enrichIssues processes the full array', () => {
    const kb = makeKBWithRef('slopsquat_risk');
    const issues: Issue[] = [
      makeIssue('slopsquat_risk'),
      makeIssue('ghost_import'),
      makeIssue('slopsquat_risk'),
    ];
    const enriched = enrichIssues(issues, kb);
    expect(enriched).toHaveLength(3);
    expect(enriched[0].academicReference).toBeDefined();
    expect(enriched[1].academicReference).toBeUndefined();
    expect(enriched[2].academicReference).toBeDefined();
  });

  it('enrichIssues returns a new array (does not mutate input)', () => {
    const kb = makeKBWithRef('slopsquat_risk');
    const issues: Issue[] = [makeIssue('slopsquat_risk')];
    const enriched = enrichIssues(issues, kb);
    expect(enriched).not.toBe(issues);
  });
});
