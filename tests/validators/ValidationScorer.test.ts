import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationScorer, ValidationScoreInputs } from '../../src/validators/ValidationScorer.js';

describe('ValidationScorer', () => {
  let scorer: ValidationScorer;

  beforeEach(() => {
    scorer = new ValidationScorer();
  });

  const baseProjectResult = {
    valid: true,
    checks: [],
    summary: { total: 10, passed: 10, failed: 0 }
  };

  const baseRuntimeResult = {
    valid: true,
    installSuccess: true,
    bootSuccess: true,
    logs: []
  };

  const baseE2eResult = {
    valid: true,
    pageLoaded: true,
    jsErrors: [],
    consoleErrors: [],
    metrics: { loadTimeMs: 100, hasCanvas: true, hasWebGL: true }
  };

  it('calculates perfect score for thorough validation', () => {
    const inputs: ValidationScoreInputs = {
      validationLevel: 'thorough',
      projectResult: baseProjectResult,
      runtimeResult: baseRuntimeResult,
      e2eResult: baseE2eResult
    };

    const result = scorer.score(inputs);
    expect(result.overallScore).toBe(1.0);
    expect(result.readyForProduction).toBe(true);
    expect(result.recommendations).toHaveLength(0);
  });

  it('calculates 0.8 score for standard validation with perfect dependencies and sets readyForProduction', () => {
    const inputs: ValidationScoreInputs = {
      validationLevel: 'standard',
      projectResult: baseProjectResult,
      runtimeResult: baseRuntimeResult
    };

    const result = scorer.score(inputs);
    
    // Project static = 0.4
    // Install = 0.2
    // Boot = 0.2
    // Total = 0.8
    expect(result.overallScore).toBeCloseTo(0.8);
    expect(result.readyForProduction).toBe(true); // 0.8 passed static + runtime
    expect(result.recommendations.some(r => r.includes('Run thorough validation'))).toBe(true);
  });

  it('calculates 0.4 score for basic validation and is not ready for production', () => {
    const inputs: ValidationScoreInputs = {
      validationLevel: 'basic',
      projectResult: baseProjectResult
    };

    const result = scorer.score(inputs);
    
    // Project static = 0.4
    expect(result.overallScore).toBeCloseTo(0.4);
    expect(result.readyForProduction).toBe(false); // < 0.8
  });

  it('penalizes score if npm install fails', () => {
    const inputs: ValidationScoreInputs = {
      validationLevel: 'standard',
      projectResult: baseProjectResult,
      runtimeResult: {
        ...baseRuntimeResult,
        valid: false,
        installSuccess: false,
        bootSuccess: false,
        error: 'NPM ERR! 404'
      }
    };

    const result = scorer.score(inputs);
    
    // Project static = 0.4
    // Install = 0.0
    // Boot = 0.0
    expect(result.overallScore).toBeCloseTo(0.4);
    expect(result.readyForProduction).toBe(false);
    expect(result.recommendations.some(r => r.includes('Fix npm install failure'))).toBe(true);
  });

  it('penalizes score if dev server boot fails', () => {
    const inputs: ValidationScoreInputs = {
      validationLevel: 'standard',
      projectResult: baseProjectResult,
      runtimeResult: {
        ...baseRuntimeResult,
        valid: false,
        bootSuccess: false, // Install succeeded
        error: 'Port 3000 in use'
      }
    };

    const result = scorer.score(inputs);
    
    // Project static = 0.4
    // Install = 0.2
    // Boot = 0.0
    expect(result.overallScore).toBeCloseTo(0.6);
    expect(result.readyForProduction).toBe(false);
    expect(result.recommendations.some(r => r.includes('boot failure'))).toBe(true);
  });

  it('recommends investigation of console errors from E2E validation', () => {
    const inputs: ValidationScoreInputs = {
      validationLevel: 'thorough',
      projectResult: baseProjectResult,
      runtimeResult: baseRuntimeResult,
      e2eResult: {
        ...baseE2eResult,
        consoleErrors: ['Cannot load favicon.ico']
      }
    };

    const result = scorer.score(inputs);
    expect(result.overallScore).toBe(1.0); // Non-fatal console errors don't drag down the score
    expect(result.readyForProduction).toBe(true);
    expect(result.recommendations.some(r => r.includes('non-fatal browser console errors'))).toBe(true);
  });

  it('penalizes score for fatal E2E JS errors and marks unsafe', () => {
    const inputs: ValidationScoreInputs = {
      validationLevel: 'thorough',
      projectResult: baseProjectResult,
      runtimeResult: baseRuntimeResult,
      e2eResult: {
        ...baseE2eResult,
        valid: false,
        jsErrors: ['Uncaught TypeError']
      }
    };

    const result = scorer.score(inputs);
    expect(result.overallScore).toBeCloseTo(0.8); 
    expect(result.readyForProduction).toBe(false);
  });

});
