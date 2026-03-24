/**
 * IssueEnricher — Attaches academic paper references to Issues.
 *
 * Pure utility functions (no state). Each function takes an Issue and a
 * KnowledgeBase and returns the Issue with `academicReference` populated
 * if a matching reference exists.
 *
 * @module academic/IssueEnricher
 */

import type { Issue } from '../models/schemas.js';
import type { KnowledgeBase } from '../resolvers/KnowledgeBase.js';

/**
 * Enrich a single Issue with its academic reference, if available.
 *
 * Looks up `issue.type` in the KnowledgeBase. If one or more references are
 * found, attaches the first one as `academicReference`. Returns the original
 * issue unchanged if no reference is found.
 *
 * @param issue - The issue to enrich
 * @param kb    - KnowledgeBase with loaded paper contracts
 * @returns     The issue, possibly with `academicReference` set
 */
export function enrichIssue(issue: Issue, kb: KnowledgeBase): Issue {
  // Try looking up by detector name first, then by issue type
  const lookupKey = issue.detector || issue.type;
  const refs = kb.getAcademicReference(lookupKey);
  if (!refs || refs.length === 0) return issue;
  return { ...issue, academicReference: refs[0] };
}

/**
 * Enrich an array of Issues with their academic references.
 *
 * Applies `enrichIssue` to every element. Issues without a matching
 * reference are returned unchanged.
 *
 * @param issues - Array of issues to enrich
 * @param kb     - KnowledgeBase with loaded paper contracts
 * @returns      New array with enriched issues
 */
export function enrichIssues(issues: Issue[], kb: KnowledgeBase): Issue[] {
  return issues.map(i => enrichIssue(i, kb));
}
