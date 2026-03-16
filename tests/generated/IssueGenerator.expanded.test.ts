import { describe, it, expect } from 'vitest';
import { IssueGenerator } from '../../src/security/IssueGenerator';
// Mock data for createIssue
const mockScriptResult = {
  script: 'console.log("test"); fetch("https://example.com")',
  patterns: [
    { 
      type: 'network_request' as const, 
      pattern: 'fetch',
      match: 'fetch("https://example.com")', 
      position: { line: 10, column: 5 } 
    }
  ],
  riskScore: 75,
  severity: 'error' as const,
  context: { 
    scriptType: 'postinstall' as const,
    source: 'package.json' as const,
    packageName: 'test-package',
    publishDate: new Date() 
  }
};

const mockContext = {
  scriptType: 'postinstall' as const,
  source: 'package.json' as const,
  packageName: 'test-package'
};

describe('IssueGenerator (Expanded)', () => {
  describe('constructor', () => {
    it('should create issue generator with default config', () => {
      const generator = new IssueGenerator();
      expect(generator).toBeDefined();
      expect(typeof generator.createIssue).toBe('function');
    });
  });

  describe('createIssue', () => {
    it('should create basic issue with minimal parameters', () => {
      const generator = new IssueGenerator();
      const issue = generator.createIssue(mockScriptResult, mockContext);
      
      expect(issue).toBeDefined();
      expect(issue.type).toBe('postinstall_risk');
      expect(issue.severity).toBe('error');
      expect(typeof issue.message).toBe('string');
      expect(typeof issue.description).toBe('string');
      expect(typeof issue.suggestion).toBe('string');
    });

    it('should create issue with detailed description for different pattern types', () => {
      const generator = new IssueGenerator();
      
      const resultWithMultiplePatterns = {
        ...mockScriptResult,
        patterns: [
          { 
            type: 'network_request' as const, 
            pattern: 'fetch',
            match: 'fetch(...)', 
            position: { line: 5, column: 1 } 
          },
          { 
            type: 'env_access' as const, 
            pattern: 'process.env',
            match: 'process.env.KEY', 
            position: { line: 15, column: 3 } 
          }
        ]
      };
      
      const issue = generator.createIssue(resultWithMultiplePatterns, mockContext);
      
      expect(issue).toBeDefined();
      expect(issue.description).toContain('Network requests');
      expect(issue.description).toContain('Environment variable access');
      expect(issue.description).toContain('fetch(...)');
    });

    it('should handle different risk scores appropriately', () => {
      const generator = new IssueGenerator();
      
      const lowRiskIssue = generator.createIssue(
        { ...mockScriptResult, riskScore: 30, severity: 'info' as const },
        mockContext
      );
      
      const highRiskIssue = generator.createIssue(
        { ...mockScriptResult, riskScore: 85, severity: 'error' as const },
        mockContext
      );
      
      expect(lowRiskIssue.severity).toBe('info');
      expect(highRiskIssue.severity).toBe('error');
    });

    it('should include package context in message when available', () => {
      const generator = new IssueGenerator();
      
      const issueWithPackage = generator.createIssue(mockScriptResult, mockContext);
      const issueWithoutPackage = generator.createIssue(mockScriptResult, {
        source: 'package.json' as const
      });
      
      expect(issueWithPackage.message).toContain('package.json');
      expect(issueWithoutPackage.message).toContain('package.json');
    });

    it('should generate meaningful remediation suggestions', () => {
      const generator = new IssueGenerator();
      const issue = generator.createIssue(mockScriptResult, mockContext);
      
      expect(issue.suggestion).toBeDefined();
      expect(issue.suggestion.length).toBeGreaterThan(0);
      expect(issue.suggestion.toLowerCase()).toContain('review');
    });

    it('should handle legitimate build script flag', () => {
      const generator = new IssueGenerator();
      
      const regularIssue = generator.createIssue(mockScriptResult, mockContext);
      const legitimateIssue = generator.createIssue(mockScriptResult, mockContext, true);
      
      expect(regularIssue.description).not.toContain('legitimate build script');
      expect(legitimateIssue.description).toContain('legitimate build script');
    });

    it('should include publish date information when available', () => {
      const generator = new IssueGenerator();
      
      const issueWithDate = generator.createIssue(mockScriptResult, mockContext);
      const issueWithoutDate = generator.createIssue(
        { 
          ...mockScriptResult, 
          context: { 
            ...mockScriptResult.context, 
            publishDate: undefined 
          } 
        },
        mockContext
      );
      
      expect(issueWithDate.description.toLowerCase()).toContain('published');
      expect(issueWithoutDate.description).not.toContain('published');
    });
  });
});
