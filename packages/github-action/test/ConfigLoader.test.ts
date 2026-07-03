import { describe, it, expect, vi } from 'vitest';
import { ConfigLoader } from '../src/ConfigLoader';
import * as fs from 'fs';
import * as core from '@actions/core';

// Mock dependencies
vi.mock('fs');
vi.mock('@actions/core');

describe('ConfigLoader', () => {
  it('should return defaults when config file not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    const config = await ConfigLoader.load('nonexistent.yml');
    
    expect(config).toEqual({
      ignorePatterns: [],
      failureThreshold: 'high',
      contractIds: []
    });
    expect(core.warning).toHaveBeenCalled();
  });

  it('should parse valid config file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        ignorePatterns: ['**/test/**'],
        failureThreshold: 'critical',
        contractIds: ['contract1']
      })
    );
    
    const config = await ConfigLoader.load('codememoria.yml');
    
    expect(config).toEqual({
      ignorePatterns: ['**/test/**'],
      failureThreshold: 'critical',
      contractIds: ['contract1']
    });
  });

  it('should handle malformed config with defaults', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
    
    const config = await ConfigLoader.load('bad.yml');
    
    expect(config).toEqual({
      ignorePatterns: [],
      failureThreshold: 'high',
      contractIds: []
    });
    expect(core.warning).toHaveBeenCalled();
  });
});