import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GovernanceBridge } from '../src/GovernanceBridge';
import * as core from '@codememoria/core';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
vi.mock('@codememoria/core');
vi.mock('fs');
vi.mock('path');

describe('GovernanceBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    GovernanceBridge['cache'].clear();
  });

  it('should call createGovernanceStack with correct parameters', async () => {
    const mockPassport = { riskLevel: 'low', validations: [] };
    vi.mocked(core.createGovernanceStack).mockResolvedValue(mockPassport);
    vi.mocked(fs.readFileSync).mockReturnValue('test code');
    
    const filePath = '/test/file.ts';
    const result = await GovernanceBridge.analyzeFile(filePath);
    
    expect(core.createGovernanceStack).toHaveBeenCalledWith({
      code: 'test code',
      filePath,
      // Verify all expected parameters are passed
    });
    expect(result).toEqual(mockPassport);
  });

  it('should cache results', async () => {
    const mockPassport = { riskLevel: 'medium', validations: [] };
    vi.mocked(core.createGovernanceStack).mockResolvedValue(mockPassport);
    vi.mocked(fs.readFileSync).mockReturnValue('test code');
    
    const filePath = '/test/file.ts';
    await GovernanceBridge.analyzeFile(filePath);
    await GovernanceBridge.analyzeFile(filePath);
    
    // Should only call createGovernanceStack once due to caching
    expect(core.createGovernanceStack).toHaveBeenCalledTimes(1);
  });

  it('should handle errors', async () => {
    vi.mocked(core.createGovernanceStack).mockRejectedValue(new Error('Test error'));
    vi.mocked(fs.readFileSync).mockReturnValue('test code');
    
    await expect(GovernanceBridge.analyzeFile('/test/file.ts'))
      .rejects.toThrow('Governance analysis failed: Test error');
  });
});