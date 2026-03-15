# Requirements Document

## Introduction

Esta refatoração técnica visa modernizar a arquitetura do EscapeKit MCP, substituindo lógica de detecção inline hardcoded por módulos especializados e reutilizáveis. O objetivo é melhorar a manutenibilidade, testabilidade e extensibilidade do código, mantendo toda a funcionalidade existente.

## Glossary

- **JavaScriptAnalyzer**: Classe responsável por analisar código JavaScript/TypeScript e extrair informações sobre imports, APIs mock e uso de WebGL
- **CodeAnalyzer**: Classe orquestradora que coordena parsing, consultas ao NPM registry e detecção de issues
- **ImportDetector**: Módulo especializado para detectar e extrair import statements (ES6 e CommonJS)
- **MockApiDetector**: Módulo especializado para detectar chamadas a APIs mock (mockapi.io, jsonplaceholder, localhost)
- **WebGLDetector**: Módulo especializado para detectar uso de WebGL e bibliotecas gráficas
- **SandboxDetector**: Módulo especializado para detectar padrões de sandbox (AI Studio, Bolt.new, Replit)
- **ConfidenceCalculator**: Módulo especializado para calcular score de confiança baseado em issues detectadas
- **Issue**: Objeto representando um problema detectado no código
- **ParseResult**: Resultado do parsing contendo imports, mock APIs e WebGL usages
- **AnalysisResult**: Resultado completo da análise incluindo issues, summary e confidence score

## Requirements

### Requirement 1: Refatorar JavaScriptAnalyzer para usar ImportDetector

**User Story:** Como desenvolvedor do EscapeKit, eu quero que o JavaScriptAnalyzer use o ImportDetector modular, para que a lógica de detecção de imports seja reutilizável e testável independentemente.

#### Acceptance Criteria

1. THE JavaScriptAnalyzer SHALL instantiate an ImportDetector in its constructor
2. WHEN parsing code, THE JavaScriptAnalyzer SHALL delegate import detection to ImportDetector.detect()
3. THE JavaScriptAnalyzer SHALL convert ImportDetector results to ParseResult.imports format
4. THE JavaScriptAnalyzer SHALL remove all inline import detection patterns (ES6_IMPORT_PATTERN, COMMONJS_REQUIRE_PATTERN)
5. THE JavaScriptAnalyzer SHALL delegate package name extraction to ImportDetector.getPackageNames()
6. FOR ALL valid JavaScript code, THE refactored JavaScriptAnalyzer SHALL produce identical ParseResult.imports as the original implementation

### Requirement 2: Refatorar JavaScriptAnalyzer para usar MockApiDetector

**User Story:** Como desenvolvedor do EscapeKit, eu quero que o JavaScriptAnalyzer use o MockApiDetector modular, para que a lógica de detecção de APIs mock seja reutilizável e extensível.

#### Acceptance Criteria

1. THE JavaScriptAnalyzer SHALL instantiate a MockApiDetector in its constructor
2. WHEN parsing code, THE JavaScriptAnalyzer SHALL delegate mock API detection to MockApiDetector.detect()
3. THE JavaScriptAnalyzer SHALL convert MockApiDetector results to ParseResult.mockApis format
4. THE JavaScriptAnalyzer SHALL remove all inline mock API patterns (MOCK_API_PATTERNS array)
5. FOR ALL valid JavaScript code, THE refactored JavaScriptAnalyzer SHALL produce identical ParseResult.mockApis as the original implementation

### Requirement 3: Refatorar JavaScriptAnalyzer para usar WebGLDetector

**User Story:** Como desenvolvedor do EscapeKit, eu quero que o JavaScriptAnalyzer use o WebGLDetector modular, para que a lógica de detecção de WebGL seja reutilizável e extensível.

#### Acceptance Criteria

1. THE JavaScriptAnalyzer SHALL instantiate a WebGLDetector in its constructor
2. WHEN parsing code, THE JavaScriptAnalyzer SHALL delegate WebGL detection to WebGLDetector.detect()
3. THE JavaScriptAnalyzer SHALL convert WebGLDetector results to ParseResult.webglUsages format
4. THE JavaScriptAnalyzer SHALL remove all inline WebGL patterns (WEBGL_PATTERNS array)
5. FOR ALL valid JavaScript code, THE refactored JavaScriptAnalyzer SHALL produce identical ParseResult.webglUsages as the original implementation

### Requirement 4: Refatorar JavaScriptAnalyzer para usar SandboxDetector

**User Story:** Como desenvolvedor do EscapeKit, eu quero que o JavaScriptAnalyzer use o SandboxDetector modular, para que a detecção de sandbox seja consistente e extensível.

#### Acceptance Criteria

1. THE JavaScriptAnalyzer SHALL instantiate a SandboxDetector in its constructor
2. THE JavaScriptAnalyzer SHALL delegate AI Studio pattern detection to SandboxDetector.isFromSandbox()
3. THE JavaScriptAnalyzer SHALL remove the detectAIStudioPattern() method
4. THE JavaScriptAnalyzer SHALL remove all inline AI Studio patterns (AI_STUDIO_PATTERNS array)
5. FOR ALL valid JavaScript code, THE refactored JavaScriptAnalyzer SHALL produce identical sandbox detection results as the original implementation

### Requirement 5: Refatorar CodeAnalyzer para usar ConfidenceCalculator

**User Story:** Como desenvolvedor do EscapeKit, eu quero que o CodeAnalyzer use o ConfidenceCalculator modular, para que o cálculo de confidence score seja consistente e configurável.

#### Acceptance Criteria

1. THE CodeAnalyzer SHALL instantiate a ConfidenceCalculator in its constructor
2. WHEN calculating confidence score, THE CodeAnalyzer SHALL delegate to ConfidenceCalculator.calculate()
3. THE CodeAnalyzer SHALL use ConfidenceMetrics.score from ConfidenceCalculator as the confidence score
4. THE CodeAnalyzer SHALL remove the calculateConfidenceScore() private method
5. FOR ALL valid analysis results, THE refactored CodeAnalyzer SHALL produce confidence scores within 0.05 of the original implementation

### Requirement 6: Refatorar CodeAnalyzer para usar SandboxDetector

**User Story:** Como desenvolvedor do EscapeKit, eu quero que o CodeAnalyzer use o SandboxDetector modular, para que a detecção de sandbox seja centralizada e consistente.

#### Acceptance Criteria

1. THE CodeAnalyzer SHALL instantiate a SandboxDetector in its constructor
2. WHEN detecting sandbox type, THE CodeAnalyzer SHALL delegate to SandboxDetector.detect()
3. THE CodeAnalyzer SHALL remove the detectSandboxType() private method
4. THE CodeAnalyzer SHALL remove all inline sandbox detection logic
5. FOR ALL valid JavaScript code, THE refactored CodeAnalyzer SHALL produce identical sandbox type detection as the original implementation

### Requirement 7: Atualizar error handling para usar classes de erro customizadas

**User Story:** Como desenvolvedor do EscapeKit, eu quero que os analyzers usem classes de erro customizadas, para que erros sejam mais descritivos e debugáveis.

#### Acceptance Criteria

1. WHEN ImportDetector.detect() fails, THE ImportDetector SHALL throw ParseError with context
2. WHEN MockApiDetector.detect() fails, THE MockApiDetector SHALL throw ParseError with context
3. WHEN WebGLDetector.detect() fails, THE WebGLDetector SHALL throw ParseError with context
4. WHEN SandboxDetector.detect() fails, THE SandboxDetector SHALL throw ParseError with context
5. WHEN ConfidenceCalculator.calculate() fails, THE ConfidenceCalculator SHALL throw AnalysisError with context
6. WHEN JavaScriptAnalyzer.parse() fails, THE JavaScriptAnalyzer SHALL throw ParseError with context
7. WHEN CodeAnalyzer.analyze() fails, THE CodeAnalyzer SHALL throw AnalysisError with context
8. FOR ALL error cases, THE error context SHALL include relevant debugging information (code snippet, line number, operation)

### Requirement 8: Adicionar logging apropriado

**User Story:** Como desenvolvedor do EscapeKit, eu quero que os analyzers tenham logging apropriado, para que eu possa debugar e monitorar o comportamento do sistema.

#### Acceptance Criteria

1. THE JavaScriptAnalyzer SHALL log debug messages when starting and completing parse operations
2. THE JavaScriptAnalyzer SHALL log the count of detected imports, mock APIs, and WebGL usages
3. THE CodeAnalyzer SHALL log debug messages when starting and completing analysis operations
4. THE CodeAnalyzer SHALL log the detected sandbox type and confidence score
5. WHEN errors occur, THE analyzers SHALL log error messages with full context
6. THE logging SHALL use the existing logger.child() pattern for namespaced logging
7. THE logging SHALL NOT log sensitive information (API keys, user data)

### Requirement 9: Manter compatibilidade de interface pública

**User Story:** Como usuário do EscapeKit, eu quero que a refatoração não quebre a API pública, para que meu código existente continue funcionando sem modificações.

#### Acceptance Criteria

1. THE JavaScriptAnalyzer.parse() method signature SHALL remain unchanged
2. THE JavaScriptAnalyzer.languageName() method signature SHALL remain unchanged
3. THE JavaScriptAnalyzer.getPackageNames() method signature SHALL remain unchanged
4. THE CodeAnalyzer.analyze() method signature SHALL remain unchanged
5. THE CodeAnalyzer.clearCache() method signature SHALL remain unchanged
6. THE ParseResult interface SHALL remain unchanged
7. THE AnalysisResult interface SHALL remain unchanged
8. FOR ALL existing test cases, THE refactored code SHALL pass without modification

### Requirement 10: Preservar funcionalidade existente

**User Story:** Como usuário do EscapeKit, eu quero que toda funcionalidade existente continue funcionando, para que a refatoração não introduza regressões.

#### Acceptance Criteria

1. FOR ALL valid JavaScript code samples, THE refactored analyzers SHALL detect the same imports as the original
2. FOR ALL valid JavaScript code samples, THE refactored analyzers SHALL detect the same mock APIs as the original
3. FOR ALL valid JavaScript code samples, THE refactored analyzers SHALL detect the same WebGL usages as the original
4. FOR ALL valid JavaScript code samples, THE refactored analyzers SHALL detect the same sandbox type as the original
5. FOR ALL valid analysis results, THE refactored analyzers SHALL calculate confidence scores within acceptable tolerance (±0.05)
6. THE refactored code SHALL pass all existing unit tests
7. THE refactored code SHALL pass all existing integration tests

### Requirement 11: Remover código duplicado

**User Story:** Como desenvolvedor do EscapeKit, eu quero remover código duplicado, para que o codebase seja mais limpo e manutenível.

#### Acceptance Criteria

1. THE JavaScriptAnalyzer SHALL NOT contain inline pattern definitions for imports
2. THE JavaScriptAnalyzer SHALL NOT contain inline pattern definitions for mock APIs
3. THE JavaScriptAnalyzer SHALL NOT contain inline pattern definitions for WebGL
4. THE JavaScriptAnalyzer SHALL NOT contain inline pattern definitions for AI Studio
5. THE CodeAnalyzer SHALL NOT contain inline confidence score calculation logic
6. THE CodeAnalyzer SHALL NOT contain inline sandbox detection logic
7. THE findPosition() helper method SHALL be extracted to a shared utility if used by multiple classes

### Requirement 12: Validar refatoração com testes existentes

**User Story:** Como desenvolvedor do EscapeKit, eu quero validar a refatoração com testes existentes, para garantir que nenhuma funcionalidade foi quebrada.

#### Acceptance Criteria

1. WHEN running existing unit tests, THE refactored code SHALL pass all tests
2. WHEN running existing integration tests, THE refactored code SHALL pass all tests
3. IF any test fails, THE refactored code SHALL be corrected before completion
4. THE test coverage SHALL NOT decrease after refactoring
5. FOR ALL test failures, THE root cause SHALL be identified and documented
