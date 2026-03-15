# Implementation Plan: Analyzer Refactoring

## Overview

Esta refatoração moderniza a arquitetura do EscapeKit MCP, substituindo lógica de detecção inline hardcoded nos analyzers por módulos especializados e reutilizáveis. A implementação será feita em fases incrementais, começando pela refatoração do JavaScriptAnalyzer, seguida pelo CodeAnalyzer, e finalizando com validação completa através de testes.

## Tasks

- [x] 1. Refatorar JavaScriptAnalyzer para usar detectores modulares
  - [x] 1.1 Adicionar instâncias dos detectores no construtor do JavaScriptAnalyzer
    - Instanciar ImportDetector, MockApiDetector, WebGLDetector e SandboxDetector
    - Adicionar logger.child('JavaScriptAnalyzer')
    - _Requirements: 1.1, 2.1, 3.1, 4.1_

  - [x] 1.2 Refatorar método parse() para delegar detecção aos detectores
    - Substituir extractImports() por ImportDetector.detect()
    - Substituir extractMockApis() por MockApiDetector.detect()
    - Substituir extractWebGLUsage() por WebGLDetector.detect()
    - Adicionar logging de debug no início e fim da operação
    - Adicionar logging do count de imports, mockApis e webglUsages detectados
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 3.2, 3.3, 8.1, 8.2_

  - [x] 1.3 Refatorar método getPackageNames() para usar ImportDetector
    - Delegar extração de package names para ImportDetector.getPackageNames()
    - _Requirements: 1.5_

  - [x] 1.4 Adicionar error handling com ParseError no método parse()
    - Envolver chamadas aos detectores em try-catch
    - Lançar ParseError com contexto detalhado (error message, operation, code length)
    - Adicionar logging de erro antes de lançar exceção
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 7.8, 8.5_

  - [x] 1.5 Remover código inline duplicado do JavaScriptAnalyzer
    - Remover método detectAIStudioPattern()
    - Remover método extractImports()
    - Remover método extractMockApis()
    - Remover método extractWebGLUsage()
    - Remover método findPosition()
    - Remover constantes ES6_IMPORT_PATTERN e COMMONJS_REQUIRE_PATTERN
    - Remover array MOCK_API_PATTERNS
    - Remover array WEBGL_PATTERNS
    - Remover array AI_STUDIO_PATTERNS
    - _Requirements: 1.4, 2.4, 3.4, 4.3, 4.4, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 1.6 Escrever testes unitários para JavaScriptAnalyzer refatorado
    - Testar detecção de ES6 imports
    - Testar detecção de CommonJS requires
    - Testar detecção de mock API calls
    - Testar detecção de WebGL usage
    - Testar error handling com código inválido
    - Testar getPackageNames() com diferentes tipos de imports

- [x] 2. Checkpoint - Validar refatoração do JavaScriptAnalyzer
  - Executar testes existentes do JavaScriptAnalyzer
  - Verificar que todos os testes passam sem modificação
  - Perguntar ao usuário se há dúvidas ou problemas

- [x] 3. Refatorar CodeAnalyzer para usar detectores modulares
  - [x] 3.1 Adicionar instâncias dos detectores no construtor do CodeAnalyzer
    - Instanciar ConfidenceCalculator e SandboxDetector
    - Adicionar logger.child('CodeAnalyzer')
    - _Requirements: 5.1, 6.1_

  - [x] 3.2 Refatorar método analyze() para usar SandboxDetector
    - Substituir detectSandboxType() por SandboxDetector.detect()
    - Adicionar logging de debug no início e fim da análise
    - Adicionar logging do sandbox type detectado
    - _Requirements: 6.2, 8.3, 8.4_

  - [x] 3.3 Refatorar método analyze() para usar ConfidenceCalculator
    - Substituir calculateConfidenceScore() por ConfidenceCalculator.calculate()
    - Usar confidenceMetrics.score como confidence score no AnalysisResult
    - Adicionar logging do confidence score calculado
    - _Requirements: 5.2, 5.3, 8.4_

  - [x] 3.4 Adicionar error handling com AnalysisError no método analyze()
    - Envolver toda a lógica de análise em try-catch
    - Lançar AnalysisError com contexto detalhado (error message, operation)
    - Adicionar logging de erro antes de lançar exceção
    - _Requirements: 7.5, 7.7, 7.8, 8.5_

  - [x] 3.5 Remover código inline duplicado do CodeAnalyzer
    - Remover método detectSandboxType()
    - Remover método calculateConfidenceScore()
    - _Requirements: 6.3, 6.4, 11.5, 11.6_

  - [ ]* 3.6 Escrever testes unitários para CodeAnalyzer refatorado
    - Testar detecção de sandbox type
    - Testar cálculo de confidence score
    - Testar error handling com código inválido
    - Testar clearCache()

- [x] 4. Checkpoint - Validar refatoração do CodeAnalyzer
  - Executar testes existentes do CodeAnalyzer
  - Verificar que todos os testes passam sem modificação
  - Perguntar ao usuário se há dúvidas ou problemas

- [x] 5. Validar compatibilidade com testes existentes
  - [x] 5.1 Executar suite completa de testes unitários
    - Rodar todos os testes unitários existentes
    - Verificar que nenhum teste falha
    - Documentar qualquer falha encontrada
    - _Requirements: 9.8, 10.6, 12.1_

  - [x] 5.2 Executar suite completa de testes de integração
    - Rodar todos os testes de integração existentes
    - Verificar que nenhum teste falha
    - Documentar qualquer falha encontrada
    - _Requirements: 10.7, 12.2_

  - [x] 5.3 Corrigir falhas de teste se necessário
    - Investigar root cause de qualquer falha
    - Corrigir código refatorado para passar nos testes
    - Re-executar testes para validar correções
    - _Requirements: 12.3, 12.5_

- [ ]* 6. Implementar testes de propriedade para validar equivalência comportamental
  - [ ]* 6.1 Escrever property test para Parse Result Equivalence
    - **Property 1: Parse Result Equivalence**
    - **Validates: Requirements 1.6, 2.5, 3.5, 10.1, 10.2, 10.3**
    - Usar fast-check para gerar código JavaScript aleatório
    - Comparar ParseResult do analyzer refatorado com o original
    - Validar que imports, mockApis e webglUsages são idênticos
    - Configurar mínimo de 100 iterações

  - [ ]* 6.2 Escrever property test para Sandbox Detection Equivalence
    - **Property 2: Sandbox Detection Equivalence**
    - **Validates: Requirements 4.5, 6.5, 10.4**
    - Usar fast-check para gerar código JavaScript aleatório
    - Comparar sandbox type detectado pelo analyzer refatorado com o original
    - Validar que o sandbox type é idêntico

  - [ ]* 6.3 Escrever property test para Confidence Score Tolerance
    - **Property 3: Confidence Score Tolerance**
    - **Validates: Requirements 5.5, 10.5**
    - Usar fast-check para gerar conjuntos de issues aleatórios
    - Comparar confidence score calculado pelo analyzer refatorado com o original
    - Validar que a diferença está dentro de ±0.05

  - [ ]* 6.4 Escrever property test para Error Context Completeness
    - **Property 5: Error Context Completeness**
    - **Validates: Requirements 7.8**
    - Gerar inputs inválidos que causam erros
    - Capturar erros lançados pelos analyzers
    - Validar que error context inclui informações relevantes (operation, error message)

- [x] 7. Checkpoint final - Validação completa
  - Executar todos os testes (unitários, integração, propriedades)
  - Verificar que test coverage não diminuiu
  - Verificar que não há regressões de performance
  - Perguntar ao usuário se há dúvidas ou se está pronto para finalizar

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requirements específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam equivalência comportamental universal
- Unit tests validam exemplos específicos e edge cases
- A refatoração mantém 100% de compatibilidade com a API pública existente
