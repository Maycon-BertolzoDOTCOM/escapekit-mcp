import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EscapeJsonWriter } from '../../src/generators/EscapeJsonWriter.js';
import type { AnalysisResult, Issue } from '../../src/models/schemas.js';
import type {
  DependencyResolution,
  CodeTransformation,
  TransformationRule,
} from '../../src/models/transformation.js';
import { ResolutionMethod, TransformationType } from '../../src/models/transformation.js';
import { FileSystemError } from '../../src/errors.js';

function createMockAnalysisResult(): AnalysisResult {
  return {
    analysisId: 'test-analysis-123',
    timestamp: new Date().toISOString(),
    language: 'typescript',
    summary: {
      totalIssues: 2,
      ghostImports: 1,
      mockApis: 1,
      unrealisticAssumptions: 0,
      securityRisks: 0,
      infiniteLoops: 0,
    },
    issues: [
      {
        id: 'issue-1',
        type: 'ghost_import',
        severity: 'error',
        location: { line: 10, column: 5, file: 'src/index.ts' },
        message: "Ghost import: 'fake-package'",
        description: "The import 'fake-package' does not exist on npm",
        autoFixable: true,
      },
      {
        id: 'issue-2',
        type: 'mock_api',
        severity: 'warning',
        location: { line: 20, column: 15, file: 'src/api.ts' },
        message: "Mock API: 'fakeApi'",
        description: "The API 'fakeApi' is mocked in tests but not implemented",
        autoFixable: true,
      },
    ],
    confidenceScore: 0.95,
  };
}

function createMockResolutions(): DependencyResolution[] {
  return [
    {
      originalImport: 'fake-package',
      resolvedPackage: 'real-package',
      version: '1.0.0',
      resolutionMethod: ResolutionMethod.KNOWLEDGE_BASE,
      confidence: 0.9,
      metadata: { validationStatus: 'VERIFIED' },
    },
  ];
}

function createMockTransformations(): CodeTransformation[] {
  return [
    {
      transformationId: 'transform-001',
      sourceCode: "import { fakeApi } from 'fake-package';",
      transformedCode: "import { realApi } from 'real-package';",
      appliedRules: [
        {
          ruleId: 'rule-001',
          ruleType: TransformationType.IMPORT_REPLACEMENT,
          sourcePattern: 'fake-package',
          targetPattern: 'real-package',
        } as TransformationRule,
      ],
      timestamp: new Date().toISOString(),
      metadata: {
        diff: "-import { fakeApi } from 'fake-package';\n+import { realApi } from 'real-package';",
        stats: { linesChanged: 1, importsReplaced: 1, polyfillsAdded: 0 },
      },
    },
  ];
}

describe('EscapeJsonWriter', () => {
  const writer = new EscapeJsonWriter();
  const analysisResult = createMockAnalysisResult();
  const resolutions = createMockResolutions();
  const transformations = createMockTransformations();

  // ─── instantiation ────────────────────────────────────────────────────

  it('should instantiate without errors', () => {
    expect(() => new EscapeJsonWriter()).not.toThrow();
  });

  // ─── basic generation ─────────────────────────────────────────────────

  it('should generate with minimal valid params', () => {
    const params = {
      analysisResult,
      resolutions: [],
      transformations: [],
    };
    const result = writer.generate(params);
    expect(result).toBeDefined();
    expect(result.version).toBe('1.0');
  });

  it('should maintain escapeId === analysisId', () => {
    const escapeJson = writer.generate({ analysisResult, resolutions, transformations });
    expect(escapeJson.escapeId).toBe(analysisResult.analysisId);
  });

  it('should match totalIssues with analysisResult', () => {
    const escapeJson = writer.generate({ analysisResult, resolutions, transformations });
    expect(escapeJson.analysis.totalIssues).toBe(analysisResult.summary.totalIssues);
  });

  it('should match transformations count with resolutions + transformations', () => {
    const escapeJson = writer.generate({ analysisResult, resolutions, transformations });
    // 1 resolution + 1 transformation = 2 applied
    expect(escapeJson.transformations.totalTransformations).toBe(
      resolutions.length + transformations.length
    );
  });

  // ─── validations ──────────────────────────────────────────────────────

  it('should handle buildValidations with testResults (partial)', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions,
      transformations,
      testResults: {
        total: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        passRate: 0.8,
        framework: 'vitest',
        executedAt: new Date().toISOString(),
      },
    });
    expect(escapeJson.validations.overallStatus).toBe('partial');
    expect(escapeJson.validations.totalValidations).toBe(10);
    expect(escapeJson.validations.passedValidations).toBe(8);
    expect(escapeJson.validations.failedValidations).toBe(2);
  });

  it('should handle buildValidations without testResults (pending)', () => {
    const escapeJson = writer.generate({ analysisResult, resolutions, transformations });
    expect(escapeJson.validations.overallStatus).toBe('pending');
  });

  it('should set overallStatus to passed when all tests pass', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
      testResults: {
        total: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        passRate: 1.0,
        framework: 'vitest',
        executedAt: new Date().toISOString(),
      },
    });
    expect(escapeJson.validations.overallStatus).toBe('passed');
  });

  it('should include kiwiTestRunId when provided', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
      kiwiTestRunId: 42,
    });
    expect(escapeJson.validations.kiwiTestRunId).toBe(42);
  });

  // ─── provenance ───────────────────────────────────────────────────────

  it('should build provenance with source hash from originalCode', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
      originalCode: 'const x = 1;',
    });
    expect(escapeJson.provenance.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should build provenance with empty hash when no originalCode', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.provenance.sourceHash).toBe('');
  });

  it('should build file records from originalFiles', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
      originalFiles: [
        { path: 'src/index.ts', size: 100, language: 'typescript' },
        { path: 'src/config.json', size: 50 },
        { path: 'tests/index.test.ts', size: 200 },
      ],
    });
    expect(escapeJson.provenance.files).toHaveLength(3);
    expect(escapeJson.provenance.files[0].type).toBe('source');
    expect(escapeJson.provenance.files[1].type).toBe('config');
    expect(escapeJson.provenance.files[2].type).toBe('test');
  });

  it('should use sandboxType from analysisResult', () => {
    const result = { ...analysisResult, sandboxType: 'replit' };
    const escapeJson = writer.generate({
      analysisResult: result,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.provenance.sandbox).toBe('replit');
  });

  // ─── analysis config ──────────────────────────────────────────────────

  it('should use custom targetPlatform and targetRuntime', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
      targetPlatform: 'vercel',
      targetRuntime: 'edge',
    });
    expect(escapeJson.analysis.config.targetPlatform).toBe('vercel');
    expect(escapeJson.analysis.config.targetRuntime).toBe('edge');
  });

  it('should use custom toolVersion', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
      toolVersion: '2.5.0',
    });
    expect(escapeJson.analysis.escapeKitVersion).toBe('2.5.0');
  });

  it('should use customMirrors flag', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
      useChineseMirrors: true,
    });
    expect(escapeJson.analysis.config.useChineseMirrors).toBe(true);
    expect(escapeJson.sovereignty.chineseMirrors).toBe(true);
    expect(escapeJson.sovereignty.compliant).toBe(true);
    expect(escapeJson.sovereignty.complianceScore).toBe(100);
  });

  // ─── issue conversion ─────────────────────────────────────────────────

  it('should convert issues correctly', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.analysis.issues).toHaveLength(2);
    expect(escapeJson.analysis.issues[0].type).toBe('GHOST_IMPORT');
    expect(escapeJson.analysis.issues[0].filePath).toBe('src/index.ts');
    expect(escapeJson.analysis.issues[0].line).toBe(10);
    expect(escapeJson.analysis.issues[0].column).toBe(5);
    expect(escapeJson.analysis.issues[1].type).toBe('MOCK_API');
  });

  it('should handle issues with missing location', () => {
    const result = {
      ...analysisResult,
      issues: [
        {
          ...analysisResult.issues[0],
          location: { line: 0 },
        },
      ],
    };
    const escapeJson = writer.generate({
      analysisResult: result,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.analysis.issues[0].filePath).toBe('');
    expect(escapeJson.analysis.issues[0].line).toBe(0);
  });

  it('should map all issue types correctly', () => {
    const result = {
      ...analysisResult,
      issues: [
        { ...analysisResult.issues[0], type: 'ghost_import' as const },
        { ...analysisResult.issues[0], type: 'mock_api' as const },
        { ...analysisResult.issues[0], type: 'unrealistic_assumption' as const },
        { ...analysisResult.issues[0], type: 'security_risk' as const },
        { ...analysisResult.issues[0], type: 'infinite_loop' as const },
        { ...analysisResult.issues[0], type: 'postinstall_risk' as const },
        { ...analysisResult.issues[0], type: 'slopsquat_risk' as const },
        { ...analysisResult.issues[0], type: 'unicode_risk' as const },
      ],
    };
    const escapeJson = writer.generate({
      analysisResult: result,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.analysis.issues[0].type).toBe('GHOST_IMPORT');
    expect(escapeJson.analysis.issues[1].type).toBe('MOCK_API');
    expect(escapeJson.analysis.issues[2].type).toBe('UNREALISTIC_ASSUMPTION');
    expect(escapeJson.analysis.issues[3].type).toBe('SECURITY_RISK');
    expect(escapeJson.analysis.issues[4].type).toBe('CODE_QUALITY');
    expect(escapeJson.analysis.issues[5].type).toBe('SECURITY_RISK');
    expect(escapeJson.analysis.issues[6].type).toBe('SECURITY_RISK');
    expect(escapeJson.analysis.issues[7].type).toBe('CODE_QUALITY');
  });

  // ─── issue breakdown ──────────────────────────────────────────────────

  it('should calculate issue breakdown correctly', () => {
    const result = {
      ...analysisResult,
      summary: {
        totalIssues: 5,
        ghostImports: 2,
        mockApis: 1,
        unrealisticAssumptions: 1,
        securityRisks: 1,
        infiniteLoops: 0,
      },
      issues: [
        { ...analysisResult.issues[0], type: 'ghost_import' as const },
        { ...analysisResult.issues[0], type: 'ghost_import' as const },
        { ...analysisResult.issues[0], type: 'mock_api' as const },
        { ...analysisResult.issues[0], type: 'unrealistic_assumption' as const },
        { ...analysisResult.issues[0], type: 'security_risk' as const },
      ],
    };
    const escapeJson = writer.generate({
      analysisResult: result,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.analysis.issueBreakdown.ghostImports).toBe(2);
    expect(escapeJson.analysis.issueBreakdown.mockApis).toBe(1);
    expect(escapeJson.analysis.issueBreakdown.unrealisticAssumptions).toBe(1);
    expect(escapeJson.analysis.issueBreakdown.securityRisks).toBe(1);
  });

  // ─── transformation breakdown ─────────────────────────────────────────

  it('should calculate transformation breakdown', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions,
      transformations,
    });
    // 1 resolution → IMPORT_REPLACEMENT, 1 transformation → IMPORT_REPLACEMENT
    expect(escapeJson.transformations.breakdown.importReplacements).toBe(2);
    expect(escapeJson.transformations.totalTransformations).toBe(2);
  });

  it('should map all transformation types', () => {
    const ruleTypes = [
      'IMPORT_REPLACEMENT',
      'API_REPLACEMENT',
      'POLYFILL_ADDITION',
      'FALLBACK_IMPLEMENTATION',
      'VERSION_UPDATE',
      'DEPENDENCY_ADDITION',
      'CONFIG_GENERATION',
      'CODE_REFACTORING',
    ];
    const transforms: CodeTransformation[] = ruleTypes.map((rt, i) => ({
      transformationId: `t-${i}`,
      sourceCode: 'a',
      transformedCode: 'b',
      appliedRules: [
        { ruleId: `r-${i}`, ruleType: rt as any, sourcePattern: '', targetPattern: '' },
      ],
      timestamp: new Date().toISOString(),
    }));

    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: transforms,
    });

    expect(escapeJson.transformations.totalTransformations).toBe(ruleTypes.length);
    expect(escapeJson.transformations.breakdown.importReplacements).toBe(1);
    expect(escapeJson.transformations.breakdown.apiReplacements).toBe(1);
    expect(escapeJson.transformations.breakdown.polyfillAdditions).toBe(1);
    expect(escapeJson.transformations.breakdown.fallbackImplementations).toBe(1);
    expect(escapeJson.transformations.breakdown.versionUpdates).toBe(1);
    expect(escapeJson.transformations.breakdown.dependencyAdditions).toBe(1);
    expect(escapeJson.transformations.breakdown.configGenerations).toBe(1);
    expect(escapeJson.transformations.breakdown.codeRefactorings).toBe(1);
  });

  // ─── deployment ───────────────────────────────────────────────────────

  it('should set deployment status to not_deployed', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.deployment.status).toBe('not_deployed');
  });

  // ─── sovereignty ──────────────────────────────────────────────────────

  it('should build sovereignty section with defaults', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.sovereignty.compliant).toBe(false);
    expect(escapeJson.sovereignty.complianceScore).toBe(0);
    expect(escapeJson.sovereignty.chineseMirrors).toBe(false);
  });

  // ─── metadata ─────────────────────────────────────────────────────────

  it('should include custom metadata', () => {
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: [],
      metadata: { projectName: 'my-project', author: 'test' },
    });
    expect(escapeJson.metadata.projectName).toBe('my-project');
    expect(escapeJson.metadata.author).toBe('test');
  });

  // ─── writeToFile ──────────────────────────────────────────────────────

  it('should write valid JSON file', async () => {
    const escapeJson = writer.generate({ analysisResult, resolutions, transformations });
    const tempPath = '/tmp/escape-test-write.json';

    await expect(writer.writeToFile(escapeJson, tempPath)).resolves.not.toThrow();

    const { readFile, unlink } = await import('fs/promises');
    const content = await readFile(tempPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.escapeId).toBe(escapeJson.escapeId);

    await unlink(tempPath);
  });

  it('should throw FileSystemError on invalid path', async () => {
    const escapeJson = writer.generate({ analysisResult, resolutions, transformations });
    await expect(writer.writeToFile(escapeJson, '/invalid/path/escape.json')).rejects.toThrow(
      FileSystemError
    );
  });

  // ─── empty issues/resolutions ─────────────────────────────────────────

  it('should handle empty issues array', () => {
    const result = { ...analysisResult, issues: [] };
    const escapeJson = writer.generate({
      analysisResult: result,
      resolutions: [],
      transformations: [],
    });
    expect(escapeJson.analysis.issues).toHaveLength(0);
    expect(escapeJson.analysis.issueBreakdown.ghostImports).toBe(0);
  });

  it('should handle transformation with no appliedRules', () => {
    const transforms: CodeTransformation[] = [
      {
        transformationId: 't-1',
        sourceCode: 'a',
        transformedCode: 'b',
        appliedRules: [],
        timestamp: new Date().toISOString(),
      },
    ];
    const escapeJson = writer.generate({
      analysisResult,
      resolutions: [],
      transformations: transforms,
    });
    expect(escapeJson.transformations.totalTransformations).toBe(1);
  });

  // ─── Correctness Properties (fast-check) ──────────────────────────────

  describe('Correctness Properties', () => {
    const arbitraryIssue = (): fc.Arbitrary<Issue> =>
      fc.record({
        id: fc.uuid(),
        type: fc.constantFrom(
          'ghost_import',
          'mock_api',
          'unrealistic_assumption',
          'security_risk',
          'infinite_loop'
        ),
        severity: fc.constantFrom('error', 'warning', 'info'),
        location: fc.record({
          line: fc.nat({ max: 1000 }),
          column: fc.option(fc.nat({ max: 200 }), { nil: undefined }),
          file: fc.option(fc.string(), { nil: undefined }),
        }),
        message: fc.string(),
        description: fc.string(),
        autoFixable: fc.boolean(),
      });

    const arbitraryEscapeJsonParams = () =>
      fc.record({
        analysisResult: fc.record({
          analysisId: fc.uuid(),
          timestamp: fc.integer({min: 0, max: 4102444800000}).map(t => new Date(t).toISOString()),
          language: fc.constant('typescript'),
          summary: fc.record({
            totalIssues: fc.nat({ max: 100 }),
            ghostImports: fc.nat({ max: 50 }),
            mockApis: fc.nat({ max: 50 }),
            unrealisticAssumptions: fc.nat({ max: 50 }),
            securityRisks: fc.nat({ max: 50 }),
            infiniteLoops: fc.nat({ max: 50 }),
          }),
          issues: fc.array(arbitraryIssue(), { maxLength: 20 }),
          confidenceScore: fc.float({ min: 0, max: 1, noNaN: true }),
        }),
        resolutions: fc.array(
          fc.record({
            originalImport: fc.string(),
            resolvedPackage: fc.string(),
            version: fc.string(),
            resolutionMethod: fc.constant(ResolutionMethod.KNOWLEDGE_BASE),
            confidence: fc.float({ min: 0, max: 1, noNaN: true }),
          }),
          { maxLength: 10 }
        ),
        transformations: fc.array(
          fc.record({
            transformationId: fc.string(),
            sourceCode: fc.string(),
            transformedCode: fc.string(),
            appliedRules: fc.array(
              fc.record({
                ruleId: fc.string(),
                ruleType: fc.constant(TransformationType.IMPORT_REPLACEMENT),
                sourcePattern: fc.string(),
                targetPattern: fc.string(),
              }),
              { maxLength: 5 }
            ),
            timestamp: fc.integer({min: 0, max: 4102444800000}).map(t => new Date(t).toISOString()),
          }),
          { maxLength: 10 }
        ),
      });

    it('should generate without throwing for any valid params', () => {
      fc.assert(
        fc.property(arbitraryEscapeJsonParams(), params => {
          expect(() => writer.generate(params)).not.toThrow();
        }),
        { numRuns: 50 }
      );
    });

    it('should maintain escapeId === analysisId for any params', () => {
      fc.assert(
        fc.property(arbitraryEscapeJsonParams(), params => {
          const escapeJson = writer.generate(params);
          expect(escapeJson.escapeId).toBe(params.analysisResult.analysisId);
        }),
        { numRuns: 50 }
      );
    });

    it('should match totalIssues with analysisResult for any params', () => {
      fc.assert(
        fc.property(arbitraryEscapeJsonParams(), params => {
          const escapeJson = writer.generate(params);
          expect(escapeJson.analysis.totalIssues).toBe(params.analysisResult.summary.totalIssues);
        }),
        { numRuns: 50 }
      );
    });

    it('should match transformations count for any params', () => {
      fc.assert(
        fc.property(arbitraryEscapeJsonParams(), params => {
          const escapeJson = writer.generate(params);
          const expectedCount = params.resolutions.length + params.transformations.length;
          expect(escapeJson.transformations.totalTransformations).toBe(expectedCount);
        }),
        { numRuns: 50 }
      );
    });
  });
});
