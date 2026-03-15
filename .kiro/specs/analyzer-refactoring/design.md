# Design Document: Analyzer Refactoring

## Overview

Esta refatoração técnica moderniza a arquitetura do EscapeKit MCP, substituindo lógica de detecção inline hardcoded nos analyzers por módulos especializados e reutilizáveis. O objetivo é melhorar a manutenibilidade, testabilidade e extensibilidade do código, mantendo toda a funcionalidade existente e compatibilidade de interface pública.

### Objetivos

1. **Modularização**: Extrair lógica de detecção inline para módulos especializados
2. **Reutilização**: Permitir que detectores sejam usados independentemente dos analyzers
3. **Testabilidade**: Facilitar testes unitários de cada componente isoladamente
4. **Manutenibilidade**: Reduzir duplicação de código e melhorar organização
5. **Compatibilidade**: Manter 100% de compatibilidade com a API pública existente

### Escopo

A refatoração afeta dois analyzers principais:

- **JavaScriptAnalyzer**: Refatorar para usar ImportDetector, MockApiDetector, WebGLDetector e SandboxDetector
- **CodeAnalyzer**: Refatorar para usar ConfidenceCalculator e SandboxDetector

Todos os detectores já existem e estão implementados. A refatoração consiste em integrar esses detectores nos analyzers e remover código duplicado.

## Architecture

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CodeAnalyzer                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - Inline confidence calculation                       │  │
│  │ - Inline sandbox detection                            │  │
│  │ - Orchestrates parsing and issue detection            │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              JavaScriptAnalyzer                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ - Inline import detection patterns              │  │  │
│  │  │ - Inline mock API detection patterns            │  │  │
│  │  │ - Inline WebGL detection patterns               │  │  │
│  │  │ - Inline AI Studio detection patterns           │  │  │
│  │  │ - Inline findPosition() helper                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CodeAnalyzer                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - Uses ConfidenceCalculator                           │  │
│  │ - Uses SandboxDetector                                │  │
│  │ - Orchestrates parsing and issue detection            │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              JavaScriptAnalyzer                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ - Uses ImportDetector                           │  │  │
│  │  │ - Uses MockApiDetector                          │  │  │
│  │  │ - Uses WebGLDetector                            │  │  │
│  │  │ - Uses SandboxDetector                          │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Detector Modules                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Import     │  │   MockApi    │  │    WebGL     │      │
│  │  Detector    │  │  Detector    │  │  Detector    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Sandbox    │  │  Confidence  │                        │
│  │  Detector    │  │  Calculator  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Dependency Injection**: Detectores são instanciados no construtor dos analyzers
2. **Single Responsibility**: Cada detector tem uma responsabilidade única e bem definida
3. **Interface Stability**: APIs públicas dos analyzers permanecem inalteradas
4. **Error Handling**: Uso consistente de classes de erro customizadas (ParseError, AnalysisError)
5. **Logging**: Logging apropriado em todos os níveis usando logger.child()

## Components and Interfaces

### JavaScriptAnalyzer (Refactored)

```typescript
export class JavaScriptAnalyzer extends BaseParser {
  private importDetector: ImportDetector;
  private mockApiDetector: MockApiDetector;
  private webglDetector: WebGLDetector;
  private sandboxDetector: SandboxDetector;
  private readonly logger = logger.child('JavaScriptAnalyzer');

  constructor() {
    super();
    this.importDetector = new ImportDetector();
    this.mockApiDetector = new MockApiDetector();
    this.webglDetector = new WebGLDetector();
    this.sandboxDetector = new SandboxDetector();
  }

  languageName(): string {
    return 'JavaScript/TypeScript';
  }

  parse(code: string): ParseResult {
    this.logger.debug('Starting parse operation');
    
    try {
      const imports = this.importDetector.detect(code);
      const mockApis = this.mockApiDetector.detect(code);
      const webglUsages = this.webglDetector.detect(code);

      this.logger.debug('Parse completed', {
        imports: imports.length,
        mockApis: mockApis.length,
        webglUsages: webglUsages.length,
      });

      return { imports, mockApis, webglUsages };
    } catch (error) {
      this.logger.error('Parse failed', { error });
      throw new ParseError('Failed to parse JavaScript code', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getPackageNames(imports: ImportStatement[]): string[] {
    return this.importDetector.getPackageNames(imports);
  }

  // Remove: detectAIStudioPattern() - delegated to SandboxDetector
  // Remove: extractImports() - delegated to ImportDetector
  // Remove: extractMockApis() - delegated to MockApiDetector
  // Remove: extractWebGLUsage() - delegated to WebGLDetector
  // Remove: findPosition() - now in detectors
  // Remove: All inline pattern constants
}
```

### CodeAnalyzer (Refactored)

```typescript
export class CodeAnalyzer {
  private registry: NPMRegistry;
  private jsAnalyzer: JavaScriptAnalyzer;
  private confidenceCalculator: ConfidenceCalculator;
  private sandboxDetector: SandboxDetector;
  private readonly logger = logger.child('CodeAnalyzer');

  constructor() {
    this.registry = new NPMRegistry();
    this.jsAnalyzer = new JavaScriptAnalyzer();
    this.confidenceCalculator = new ConfidenceCalculator();
    this.sandboxDetector = new SandboxDetector();
  }

  async analyze(code: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    this.logger.debug('Starting analysis', { options });

    try {
      const { sandboxType, language = 'javascript', checkNPMRegistry = true } = options;

      // Parse code
      const parseResult = this.jsAnalyzer.parse(code);

      // Detect sandbox type if not provided
      const detectedSandboxType = sandboxType || this.sandboxDetector.detect(code);

      // Identify ghost imports
      const ghostImports = await this.detectGhostImports(parseResult.imports, checkNPMRegistry);

      // Identify mock API issues
      const mockApiIssues = this.detectMockApiIssues(parseResult.mockApis);

      // Identify WebGL issues
      const webglIssues = this.detectWebGLIssues(parseResult.webglUsages);

      // Combine all issues
      const allIssues = [...ghostImports, ...mockApiIssues, ...webglIssues];

      // Calculate summary
      const summary = this.calculateSummary(allIssues);

      // Calculate confidence score using ConfidenceCalculator
      const confidenceMetrics = this.confidenceCalculator.calculate(allIssues);

      this.logger.debug('Analysis completed', {
        sandboxType: detectedSandboxType,
        totalIssues: allIssues.length,
        confidenceScore: confidenceMetrics.score,
      });

      return {
        analysisId: generateId('analysis'),
        timestamp: new Date().toISOString(),
        sandboxType: detectedSandboxType,
        language,
        summary,
        issues: allIssues,
        confidenceScore: confidenceMetrics.score,
      };
    } catch (error) {
      this.logger.error('Analysis failed', { error });
      throw new AnalysisError('Failed to analyze code', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  clearCache(): void {
    this.registry.clearCache();
  }

  // Remove: detectSandboxType() - delegated to SandboxDetector
  // Remove: calculateConfidenceScore() - delegated to ConfidenceCalculator
}
```

### Detector Interfaces

Todos os detectores já estão implementados com as seguintes interfaces:

#### ImportDetector

```typescript
interface ImportDetector {
  detect(code: string): ImportStatement[];
  getPackageNames(imports: ImportStatement[]): string[];
  getImportsByType(imports: ImportStatement[], type: ImportType): ImportStatement[];
  getRelativeImports(imports: ImportStatement[]): ImportStatement[];
  getExternalImports(imports: ImportStatement[]): ImportStatement[];
}
```

#### MockApiDetector

```typescript
interface MockApiDetector {
  detect(code: string): MockApiCall[];
  isMockApi(url: string): boolean;
  getMockApiType(url: string): string | null;
}
```

#### WebGLDetector

```typescript
interface WebGLDetector {
  detect(code: string): WebGLUsage[];
  usesThreeJs(code: string): boolean;
  usesWebGL(code: string): boolean;
  getWebGLTypes(code: string): string[];
  getFallbackRecommendations(code: string): string[];
}
```

#### SandboxDetector

```typescript
interface SandboxDetector {
  detect(code: string): SandboxType;
  detectAll(code: string): SandboxType[];
  isFromSandbox(code: string, sandboxType: SandboxType): boolean;
  getConfidence(code: string, sandboxType: SandboxType): number;
}
```

#### ConfidenceCalculator

```typescript
interface ConfidenceCalculator {
  calculate(issues: Issue[]): ConfidenceMetrics;
  getRecommendations(metrics: ConfidenceMetrics): string[];
  getDescription(metrics: ConfidenceMetrics): string;
}
```

## Data Models

### ParseResult

```typescript
interface ParseResult {
  imports: ImportStatement[];
  mockApis: MockApiCall[];
  webglUsages: WebGLUsage[];
}
```

Permanece inalterado. Os detectores retornam objetos compatíveis com esta interface.

### ImportStatement

```typescript
interface ImportStatement {
  type: 'es6' | 'commonjs';
  source: string;
  line: number;
  column: number;
  isRelative: boolean;
}
```

Compatível entre BaseParser e ImportDetector.

### MockApiCall

```typescript
interface MockApiCall {
  function: string;
  endpoint: string;
  line: number;
  column: number;
}
```

Compatível entre BaseParser e MockApiDetector.

### WebGLUsage

```typescript
interface WebGLUsage {
  type: string; // 'threejs' | 'webgl' | 'canvas' | etc.
  line: number;
  column: number;
}
```

Compatível entre BaseParser e WebGLDetector. Note que o tipo em BaseParser é mais restrito ('threejs' | 'webgl' | 'canvas'), mas WebGLDetector usa string para permitir extensibilidade.

### ConfidenceMetrics

```typescript
interface ConfidenceMetrics {
  score: number;
  criticalIssues: number;
  errorIssues: number;
  warningIssues: number;
  breakdown: Record<IssueType, number>;
  level: 'critical' | 'low' | 'medium' | 'high' | 'excellent';
}
```

Retornado por ConfidenceCalculator. CodeAnalyzer usa apenas o campo `score` para manter compatibilidade com AnalysisResult.

### Error Context

```typescript
interface ErrorContext {
  error?: string;
  code?: string;
  line?: number;
  operation?: string;
}
```

Usado para fornecer contexto detalhado em ParseError e AnalysisError.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties. Many criteria were about code structure or implementation details, which are not testable as properties. The key testable properties focus on behavioral equivalence between the original and refactored implementations.

**Redundancy Analysis:**

- Properties 10.1-10.7 and 12.1-12.2 are redundant with properties 1.6, 2.5, 3.5, 5.5, 6.5, and 9.8
- These redundant properties all validate the same core requirement: the refactored code must behave identically to the original
- I will consolidate these into a single comprehensive property that validates complete behavioral equivalence
- Error handling properties (7.1-7.7) are specific examples that should be tested as unit tests, not properties
- Property 7.8 about error context is a valid property that applies across all error cases

**Final Properties:**

1. **Parse Result Equivalence**: For any valid JavaScript code, the refactored JavaScriptAnalyzer must produce identical parse results (imports, mockApis, webglUsages) as the original
2. **Sandbox Detection Equivalence**: For any valid JavaScript code, the refactored CodeAnalyzer must detect the same sandbox type as the original
3. **Confidence Score Tolerance**: For any analysis result, the refactored CodeAnalyzer must produce confidence scores within ±0.05 of the original
4. **Test Suite Compatibility**: All existing unit and integration tests must pass without modification
5. **Error Context Completeness**: For any error case, the error context must include relevant debugging information

### Property 1: Parse Result Equivalence

*For any* valid JavaScript code sample, when parsed by the refactored JavaScriptAnalyzer, the resulting ParseResult (imports, mockApis, webglUsages) should be identical to the ParseResult produced by the original JavaScriptAnalyzer implementation.

**Validates: Requirements 1.6, 2.5, 3.5, 10.1, 10.2, 10.3**

**Rationale**: This property ensures that the refactoring maintains complete functional equivalence for all parsing operations. By testing with a wide variety of JavaScript code samples, we verify that the delegation to detector modules produces identical results to the original inline implementation.

### Property 2: Sandbox Detection Equivalence

*For any* valid JavaScript code sample, when analyzed by the refactored CodeAnalyzer, the detected sandbox type should be identical to the sandbox type detected by the original CodeAnalyzer implementation.

**Validates: Requirements 4.5, 6.5, 10.4**

**Rationale**: This property ensures that sandbox detection behavior is preserved when moving from inline detection logic to the SandboxDetector module. Sandbox type detection is critical for the analysis workflow, so maintaining exact equivalence is essential.

### Property 3: Confidence Score Tolerance

*For any* set of detected issues, when the refactored CodeAnalyzer calculates a confidence score, the score should be within ±0.05 of the confidence score calculated by the original CodeAnalyzer implementation.

**Validates: Requirements 5.5, 10.5**

**Rationale**: This property allows for minor numerical differences in confidence score calculation while ensuring functional equivalence. The ±0.05 tolerance accounts for potential floating-point arithmetic differences or minor algorithmic variations, while still validating that the overall confidence assessment remains consistent.

### Property 4: Test Suite Compatibility

*For all* existing unit tests and integration tests in the test suite, the refactored code should pass without requiring any modifications to the tests themselves.

**Validates: Requirements 9.8, 10.6, 10.7, 12.1, 12.2**

**Rationale**: This property validates that the public API and behavior of the analyzers remain completely unchanged. If all existing tests pass without modification, it demonstrates that the refactoring successfully maintains backward compatibility and functional equivalence.

### Property 5: Error Context Completeness

*For any* error thrown by the refactored analyzers or detectors, the error context should include relevant debugging information such as the operation being performed, the code snippet (if applicable), and any relevant parameters.

**Validates: Requirements 7.8**

**Rationale**: This property ensures that error handling improvements are consistently applied across all components. Good error context is essential for debugging and maintaining the system, so we verify that all errors provide useful information.

## Error Handling

### Error Types

The refactored code uses custom error classes from `src/errors.ts`:

- **ParseError**: Thrown when code parsing fails in JavaScriptAnalyzer or any detector
- **AnalysisError**: Thrown when analysis fails in CodeAnalyzer or ConfidenceCalculator

### Error Context

All errors include a context object with relevant debugging information:

```typescript
{
  error: string;           // Original error message
  operation?: string;      // Operation being performed
  code?: string;           // Code snippet (truncated if long)
  line?: number;           // Line number where error occurred
  detector?: string;       // Detector that failed
}
```

### Error Handling Strategy

1. **Detector Level**: Each detector catches internal errors and wraps them in ParseError with context
2. **Analyzer Level**: JavaScriptAnalyzer catches detector errors and re-throws with additional context
3. **Orchestrator Level**: CodeAnalyzer catches all errors and wraps them in AnalysisError with full context
4. **Logging**: All errors are logged with full context before being thrown
5. **Graceful Degradation**: Where possible, detectors return empty arrays instead of throwing for non-critical failures

### Example Error Handling

```typescript
// In JavaScriptAnalyzer
parse(code: string): ParseResult {
  this.logger.debug('Starting parse operation');
  
  try {
    const imports = this.importDetector.detect(code);
    const mockApis = this.mockApiDetector.detect(code);
    const webglUsages = this.webglDetector.detect(code);

    return { imports, mockApis, webglUsages };
  } catch (error) {
    this.logger.error('Parse failed', { error });
    throw new ParseError('Failed to parse JavaScript code', {
      error: error instanceof Error ? error.message : String(error),
      operation: 'parse',
      codeLength: code.length,
    });
  }
}
```

## Testing Strategy

### Dual Testing Approach

The refactoring will be validated using both unit tests and property-based tests:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property Tests**: Verify universal properties across all inputs

### Unit Testing

Unit tests focus on:

1. **Specific Examples**: Test known code samples with expected results
2. **Edge Cases**: Empty code, malformed syntax, edge patterns
3. **Error Conditions**: Invalid inputs, network failures, timeout scenarios
4. **Integration Points**: Interaction between analyzers and detectors
5. **API Compatibility**: Verify method signatures and return types

**Example Unit Tests:**

```typescript
describe('JavaScriptAnalyzer Refactoring', () => {
  it('should detect ES6 imports correctly', () => {
    const code = 'import React from "react";';
    const result = analyzer.parse(code);
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe('react');
  });

  it('should detect mock API calls', () => {
    const code = 'fetch("https://mockapi.io/api/users")';
    const result = analyzer.parse(code);
    expect(result.mockApis).toHaveLength(1);
  });

  it('should throw ParseError on invalid code', () => {
    expect(() => analyzer.parse(null as any)).toThrow(ParseError);
  });
});
```

### Property-Based Testing

Property tests focus on:

1. **Parse Result Equivalence**: Compare refactored vs original for many code samples
2. **Sandbox Detection Equivalence**: Verify sandbox detection across diverse inputs
3. **Confidence Score Tolerance**: Validate confidence scores within acceptable range
4. **Error Context Completeness**: Verify all errors have proper context

**Property Test Configuration:**

- Library: fast-check (JavaScript/TypeScript property-based testing library)
- Minimum iterations: 100 per property test
- Tag format: **Feature: analyzer-refactoring, Property {number}: {property_text}**

**Example Property Test:**

```typescript
import fc from 'fast-check';

describe('Property: Parse Result Equivalence', () => {
  it('should produce identical parse results for any valid JavaScript code', () => {
    // Feature: analyzer-refactoring, Property 1: Parse Result Equivalence
    
    fc.assert(
      fc.property(
        fc.string(), // Generate random JavaScript code
        (code) => {
          const originalResult = originalAnalyzer.parse(code);
          const refactoredResult = refactoredAnalyzer.parse(code);
          
          expect(refactoredResult.imports).toEqual(originalResult.imports);
          expect(refactoredResult.mockApis).toEqual(originalResult.mockApis);
          expect(refactoredResult.webglUsages).toEqual(originalResult.webglUsages);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Coverage Requirements

- Maintain or improve existing test coverage (currently >80%)
- All new error handling paths must be covered
- All detector integrations must be tested
- All public API methods must have tests

### Validation Process

1. **Run Existing Tests**: Verify all existing tests pass with refactored code
2. **Run Property Tests**: Validate behavioral equivalence properties
3. **Run Integration Tests**: Verify end-to-end functionality
4. **Manual Testing**: Test with real-world code samples
5. **Performance Testing**: Ensure no performance regression

## Implementation Plan

### Phase 1: JavaScriptAnalyzer Refactoring

1. Add detector instances to constructor
2. Replace extractImports() with ImportDetector.detect()
3. Replace extractMockApis() with MockApiDetector.detect()
4. Replace extractWebGLUsage() with WebGLDetector.detect()
5. Remove detectAIStudioPattern() method
6. Remove all inline pattern constants
7. Remove findPosition() helper (now in detectors)
8. Add error handling with ParseError
9. Add logging with logger.child()
10. Run tests and verify equivalence

### Phase 2: CodeAnalyzer Refactoring

1. Add ConfidenceCalculator and SandboxDetector to constructor
2. Replace detectSandboxType() with SandboxDetector.detect()
3. Replace calculateConfidenceScore() with ConfidenceCalculator.calculate()
4. Update analyze() to use confidenceMetrics.score
5. Add error handling with AnalysisError
6. Add logging with logger.child()
7. Run tests and verify equivalence

### Phase 3: Testing and Validation

1. Run all existing unit tests
2. Run all existing integration tests
3. Implement property-based tests for equivalence
4. Test error handling scenarios
5. Validate logging output
6. Performance benchmarking
7. Code review and cleanup

### Phase 4: Documentation and Cleanup

1. Update inline documentation
2. Update README if needed
3. Remove commented-out code
4. Final code review
5. Merge to main branch

## Migration Strategy

### Backward Compatibility

The refactoring maintains 100% backward compatibility:

- All public method signatures remain unchanged
- All return types remain unchanged
- All interfaces remain unchanged
- All existing tests pass without modification

### Rollback Plan

If issues are discovered after deployment:

1. Revert to previous commit (refactoring is isolated)
2. Investigate root cause
3. Fix issues in a new branch
4. Re-validate with full test suite
5. Re-deploy

### Monitoring

After deployment, monitor:

- Error rates (should remain unchanged)
- Performance metrics (should remain unchanged)
- Test coverage (should remain ≥80%)
- User-reported issues (should be zero)

## Performance Considerations

### Expected Performance Impact

The refactoring should have minimal performance impact:

- **Detector instantiation**: One-time cost in constructor (negligible)
- **Method delegation**: Minimal overhead (single function call)
- **Pattern matching**: Identical to original (same regex patterns)
- **Memory usage**: Slightly higher (detector instances), but negligible

### Performance Testing

Benchmark the following operations:

1. Parse 1000 lines of JavaScript code
2. Analyze code with 50 imports
3. Detect sandbox type in 100 code samples
4. Calculate confidence score for 100 issue sets

Expected results: <5% performance difference from original implementation.

## Security Considerations

### No Security Impact

The refactoring does not change any security-related functionality:

- No changes to input validation
- No changes to error handling security
- No changes to logging (still no sensitive data)
- No new external dependencies

### Security Best Practices

The refactored code maintains existing security practices:

- Input sanitization in detectors
- No eval() or dynamic code execution
- No logging of sensitive information
- Proper error context without exposing internals

## Conclusion

This refactoring modernizes the EscapeKit MCP analyzer architecture by replacing inline detection logic with modular, reusable detector components. The design ensures:

1. **Complete Functional Equivalence**: All behavior is preserved
2. **Improved Maintainability**: Code is more organized and testable
3. **Better Extensibility**: New detectors can be easily added
4. **Backward Compatibility**: No breaking changes to public API
5. **Comprehensive Testing**: Property-based tests validate equivalence

The refactoring is low-risk due to comprehensive testing and the isolated nature of the changes. All existing functionality is preserved while improving code quality and maintainability.
