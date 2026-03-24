import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationEngine } from '../../src/validate/ValidationEngine.js';
import { logger } from '../../src/logger.js';

// Mock dependencies
vi.mock('../../src/logger.js');
vi.mock('../../src/validate/validators/BuildValidator.js', () => ({
  BuildValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({
      passed: false,
      installTime: 0,
      buildTime: 0,
      errors: [{ type: 'BUILD_ERROR', severity: 'error', message: 'Build failed' }],
      warnings: [],
    }),
  })),
}));

vi.mock('../../src/validate/validators/DependencyValidator.js', () => ({
  DependencyValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({
      passed: false,
      ghostPackages: [],
      outdatedPackages: [],
      vulnerabilities: [],
      missingPeerDeps: [],
    }),
  })),
}));

vi.mock('../../src/validate/auto-fix/AutoFixEngine.js', () => ({
  AutoFixEngine: vi.fn().mockImplementation(() => ({
    fix: vi.fn().mockImplementation((_, issues) => 
      issues.map(issue => ({
        issueType: issue.type,
        description: `Fixed ${issue.type}`,
        applied: true,
      }))
    ),
    canFix: vi.fn().mockReturnValue(true),
  })),
}));

describe('ValidationEngine iterative auto-fix', () => {
  let engine: ValidationEngine;
  
  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ValidationEngine();
  });

  it('should perform multiple iterations when issues remain', async () => {
    const mockBuildValidator = await import('../../src/validate/validators/BuildValidator.js');
    mockBuildValidator.BuildValidator.mockImplementation(() => ({
      validate: vi.fn()
        .mockResolvedValueOnce({
          passed: false,
          errors: [{ type: 'BUILD_ERROR', severity: 'error', message: 'First error' }],
        })
        .mockResolvedValueOnce({
          passed: false,
          errors: [{ type: 'BUILD_ERROR', severity: 'error', message: 'Second error' }],
        })
        .mockResolvedValueOnce({
          passed: true,
          errors: [],
        }),
    }));

    const result = await engine.validate('/test', { 
      autoFix: true,
      maxIterations: 3 
    });
    
    expect(result.iterationCount).toBe(2);
    expect(result.fixesApplied.length).toBe(2);
  });

  it('should stop when no progress is made', async () => {
    const mockAutoFixEngine = await import('../../src/validate/auto-fix/AutoFixEngine.js');
    mockAutoFixEngine.AutoFixEngine.mockImplementation(() => ({
      fix: vi.fn().mockResolvedValue([]), // No fixes applied
      canFix: vi.fn().mockReturnValue(true),
    }));

    const result = await engine.validate('/test', { 
      autoFix: true,
      maxIterations: 3 
    });
    
    expect(result.iterationCount).toBe(1);
    expect(result.fixesApplied.length).toBe(0);
  });

  it('should clamp maxIterations between 1 and 10', async () => {
    const mockAutoFixEngine = await import('../../src/validate/auto-fix/AutoFixEngine.js');
    const mockFix = mockAutoFixEngine.AutoFixEngine.prototype.fix;
    
    // Test min clamp
    await engine.validate('/test', { autoFix: true, maxIterations: 0 });
    expect(mockFix).toHaveBeenCalledTimes(1);
    
    // Test max clamp
    vi.clearAllMocks();
    await engine.validate('/test', { autoFix: true, maxIterations: 15 });
    expect(mockFix).toHaveBeenCalledTimes(10);
    
    // Test default
    vi.clearAllMocks();
    await engine.validate('/test', { autoFix: true });
    expect(mockFix).toHaveBeenCalledTimes(3);
  });

  it('should set iterationCount to 0 when autoFix is false', async () => {
    const result = await engine.validate('/test', { autoFix: false });
    expect(result.iterationCount).toBe(0);
  });

  it('should log iteration progress', async () => {
    await engine.validate('/test', { autoFix: true, maxIterations: 2 });
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ iteration: 1 }), 
      expect.stringContaining('Auto-fix iteration 1/2')
    );
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ iteration: 1 }), 
      expect.stringContaining('Iteration 1 complete')
    );
  });
});