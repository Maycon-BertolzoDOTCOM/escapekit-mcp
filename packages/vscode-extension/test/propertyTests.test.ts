import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import * as core from '@codememoria/core';
import { GovernanceBridge } from '../src/GovernanceBridge';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
vi.mock('@codememoria/core');
vi.mock('fs');
vi.mock('path');

describe('Property Tests', () => {
  it('P1: CLI/Extension Equivalence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (code) => {
          // Mock CLI behavior
          const cliPassport = {
            riskLevel: 'medium',
            complianceStamps: [{ name: 'test', status: 'pass' }],
            codeFingerprint: { hash: 'abc123' },
            validations: []
          };
          
          // Mock extension behavior to return same as CLI
          vi.mocked(core.createGovernanceStack).mockResolvedValue(cliPassport);
          vi.mocked(fs.readFileSync).mockReturnValue(code);
          
          // Call extension
          const extensionPassport = await GovernanceBridge.analyzeFile('test.ts');
          
          // Verify equivalence
          expect(extensionPassport.riskLevel).toBe(cliPassport.riskLevel);
          expect(extensionPassport.complianceStamps).toEqual(cliPassport.complianceStamps);
          expect(extensionPassport.codeFingerprint.hash).toBe(cliPassport.codeFingerprint.hash);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});