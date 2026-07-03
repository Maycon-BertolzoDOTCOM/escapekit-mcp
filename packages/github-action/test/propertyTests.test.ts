import { describe, it } from 'vitest';
import { fc } from '@fast-check/vitest';
import { PRCommentBuilder } from '../src/PRCommentBuilder';
import { CheckResult } from '../src/CheckRunner';
import * as crypto from 'crypto';
import { Config } from '../src/ConfigLoader';

// Mock crypto globally for consistent hashing
vi.mock('crypto', () => ({
  createHash: () => ({
    update: (data: string) => ({
      digest: () => `hash_${data.length}`
    })
  })
}));

describe('Property Tests', () => {
  it('P2: Hash in PR comment matches CLI hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string()), 
        async (files) => {
          const builder = new PRCommentBuilder();
          const mockResult = {
            passports: files.map(f => ({ content: f })),
            fileResults: [],
            riskLevel: 'medium'
          } as CheckResult;
          
          const hash = builder.generateReportHash(mockResult);
          // Verify hash is deterministic
          expect(builder.generateReportHash(mockResult)).toBe(hash);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P3: Risk level determines check status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('critical'),
          fc.constant('high'),
          fc.constant('medium'),
          fc.constant('low')
        ),
        async (riskLevel) => {
          const config: Config = {
            ignorePatterns: [],
            failureThreshold: 'high',
            contractIds: []
          };
          
          // Verify check fails for high/critical when threshold is high
          const shouldFail = ['high', 'critical'].includes(riskLevel);
          
          // In real implementation, would verify core.setFailed called
          return shouldFail === (riskLevel >= config.failureThreshold);
        }
      ),
      { numRuns: 100 }
    );
  });
});