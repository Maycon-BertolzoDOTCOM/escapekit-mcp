import { describe, it, expect, vi } from 'vitest';
import { PRCommentBuilder } from '../src/PRCommentBuilder';
import { CheckResult } from '../src/CheckRunner';
import * as github from '@actions/github';
import * as crypto from 'crypto';

// Mock dependencies
vi.mock('@actions/github');
vi.mock('crypto');

describe('PRCommentBuilder', () => {
  it('should generate report hash', () => {
    const builder = new PRCommentBuilder();
    const mockResult = {
      passports: [{ riskLevel: 'high' }]
    } as CheckResult;
    
    vi.mocked(crypto.createHash).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('abc123')
    } as any);
    
    const hash = builder.generateReportHash(mockResult);
    expect(hash).toBe('abc123');
  });

  it('should render badge in comment', () => {
    const builder = new PRCommentBuilder();
    const mockResult = {
      riskLevel: 'high',
      fileResults: [],
      passports: []
    } as CheckResult;
    
    const comment = builder.buildComment(mockResult);
    expect(comment).toContain('![high risk]');
    expect(comment).toContain('Risk Level: HIGH');
  });
});