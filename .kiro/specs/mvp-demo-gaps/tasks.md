# Implementation Plan: mvp-demo-gaps

## Overview

Implementação dos três gaps críticos para a demo enterprise do CodeMemória: comando `report generate`, detecção de secrets hardcoded em objetos literais, e detecção de SQL injection por template string. A ordem segue as dependências de tipos: schemas/types primeiro, depois detectores, depois integrações, depois CLI.

## Tasks

- [x] 1. Modificações de tipos base
  - [x] 1.1 Adicionar `'hardcoded_secret'` e `'sql_injection'` ao `IssueType` em `src/models/schemas.ts`
    - Estender a union type `IssueType` com os dois novos valores
    - _Requirements: 2.1, 3.1_
  - [x] 1.2 Adicionar `'hardcoded_secret'` ao `PatternType` em `src/security/types.ts`
    - Estender a union type `PatternType` com o novo valor
    - _Requirements: 2.1_

- [x] 2. Implementar `SqlInjectionDetector`
  - [x] 2.1 Criar `src/detectors/SqlInjectionDetector.ts` com classe `SqlInjectionDetector` e método `detect(code: string): Issue[]`
    - Pattern 1: template literal com keyword SQL + interpolação `${...}`
    - Pattern 2: concatenação com `+` onde um operando contém keyword SQL
    - Cada match gera `Issue` com `type: 'sql_injection'`, `severity: 'error'`, `location` (linha/coluna via split `\n`), e `suggestion` mencionando prepared statements
    - Retornar `[]` para `null`/`undefined` sem lançar exceção
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 2.2 Escrever testes unitários para `SqlInjectionDetector` em `tests/detectors/SqlInjectionDetector.test.ts`
    - Casos: cada keyword SQL via template literal, concatenação com `+`, query estática sem interpolação, código null/undefined
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 2.3 Escrever property test P8 — SQL injection via template literal
    - **Property 8: Detecção de SQL injection via template literal**
    - **Validates: Requirements 3.1, 3.4, 3.5**
    - Arquivo: `tests/detectors/SqlInjectionDetector.property.test.ts`
    - Arbitrários: `fc.constantFrom(...sqlKeywords)` + `fc.identifier()` para variável interpolada
  - [ ]* 2.4 Escrever property test P9 — SQL injection via concatenação
    - **Property 9: Detecção de SQL injection via concatenação**
    - **Validates: Requirements 3.2**
    - Arquivo: `tests/detectors/SqlInjectionDetector.property.test.ts`
    - Arbitrários: `fc.constantFrom(...sqlKeywords)` + `fc.identifier()` para variável concatenada
  - [ ]* 2.5 Escrever property test P10 — Sem falsos positivos SQL estático
    - **Property 10: Sem falsos positivos para SQL estático**
    - **Validates: Requirements 3.3**
    - Arquivo: `tests/detectors/SqlInjectionDetector.property.test.ts`
    - Arbitrários: `fc.constantFrom(...sqlKeywords)` sem interpolação nem concatenação com variável

- [x] 3. Estender `PatternMatcher` com detecção de secrets hardcoded
  - [x] 3.1 Adicionar dois novos `PatternDefinition` ao array `SUSPICIOUS_PATTERNS` em `src/security/PatternMatcher.ts`
    - Pattern 1 (weight 50): `/\b(stripeKey|apiKey|api_key|password|secret|token)\s*:\s*['"][^'"]+['"]/gi`
    - Pattern 2 (weight 50): `/['"]sk_(live|test)_[^'"]+['"]/gi`
    - _Requirements: 2.1, 2.2, 2.5_
  - [ ]* 3.2 Escrever property test P4 — Detecção de secret por nome de propriedade
    - **Property 4: Detecção de secret por nome de propriedade**
    - **Validates: Requirements 2.1, 2.5**
    - Arquivo: `tests/security/PatternMatcher.property.test.ts`
    - Arbitrários: `fc.constantFrom('stripeKey','apiKey','api_key','password','secret','token')` + `fc.string({ minLength: 1 })`
  - [ ]* 3.3 Escrever property test P5 — Detecção de secret por prefixo sk_
    - **Property 5: Detecção de secret por prefixo sk_live_/sk_test_**
    - **Validates: Requirements 2.2**
    - Arquivo: `tests/security/PatternMatcher.property.test.ts`
    - Arbitrários: `fc.constantFrom('sk_live_', 'sk_test_')` + `fc.string({ minLength: 1 })`
  - [ ]* 3.4 Escrever property test P6 — Sem falsos positivos para valores não-literais
    - **Property 6: Sem falsos positivos para valores não-literais**
    - **Validates: Requirements 2.3, 2.4**
    - Arquivo: `tests/security/PatternMatcher.property.test.ts`
    - Arbitrários: `fc.identifier()` para nome de variável (valor não-literal) e string vazia
  - [ ]* 3.5 Escrever property test P7 — Contagem exata de secrets hardcoded
    - **Property 7: Contagem exata de secrets hardcoded**
    - **Validates: Requirements 2.6**
    - Arquivo: `tests/security/PatternMatcher.property.test.ts`
    - Arbitrários: `fc.array(...)` de N secrets distintos

- [x] 4. Integrar `SqlInjectionDetector` ao `CodeAnalyzer`
  - [x] 4.1 Modificar `src/analyzers/CodeAnalyzer.ts` para instanciar `SqlInjectionDetector` no construtor e chamar `detect()` no método `analyze()`
    - Adicionar import de `SqlInjectionDetector`
    - Instanciar no construtor: `this.sqlDetector = new SqlInjectionDetector()`
    - Chamar `this.sqlDetector.detect(code)` dentro do bloco try/catch existente e concatenar ao array de issues
    - Garantir que `calculateSummary` conta `'hardcoded_secret'` e `'sql_injection'` em `summary.securityRisks`
    - _Requirements: 3.6_
  - [ ]* 4.2 Escrever property test P11 — Contagem exata de SQL injections no CodeAnalyzer
    - **Property 11: Contagem exata de SQL injections no CodeAnalyzer**
    - **Validates: Requirements 3.6, 3.7**
    - Arquivo: `tests/analyzers/CodeAnalyzer.property.test.ts`
    - Arbitrários: `fc.array(...)` de N template literals SQL com interpolação

- [x] 5. Checkpoint — Verificar testes dos detectores
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar `ReportGenerator`
  - [x] 6.1 Criar `src/reports/ReportGenerator.ts` com interfaces `ComplianceIssue`, `NormativeRef`, `ComplianceReport` e classe `ReportGenerator` com método `generate(analysis: AnalysisResult): ComplianceReport`
    - Mapear `analysis.issues` para `ComplianceIssue[]` adicionando `normativeRefs` conforme tabela do design
    - Montar objeto parcial sem `integrityHash`, serializar com `JSON.stringify(partial, null, 2)`
    - Calcular `sha256(serialized)` via `src/governance/utils/hash.ts`
    - Retornar objeto completo com `integrityHash`
    - _Requirements: 1.2, 1.6, 1.7, 1.8_
  - [ ]* 6.2 Escrever testes unitários para `ReportGenerator` em `tests/reports/ReportGenerator.test.ts`
    - Casos: 0 issues, 1 issue de cada tipo com normativeRefs corretas, verificação de campos obrigatórios, campo `reportVersion: "1.0"`
    - _Requirements: 1.2, 1.7_
  - [ ]* 6.3 Escrever property test P1 — Report structure invariant
    - **Property 1: Report structure invariant**
    - **Validates: Requirements 1.2, 1.6, 1.7**
    - Arquivo: `tests/reports/ReportGenerator.property.test.ts`
    - Arbitrários: `fc.record({ analysisId: fc.string(), issues: fc.array(...) })`
  - [ ]* 6.4 Escrever property test P2 — Integrity hash round-trip
    - **Property 2: Integrity hash round-trip**
    - **Validates: Requirements 1.8**
    - Arquivo: `tests/reports/ReportGenerator.property.test.ts`
    - Arbitrários: mesmo de P1
  - [ ]* 6.5 Escrever property test P3 — Write-to-file round-trip
    - **Property 3: Write-to-file round-trip**
    - **Validates: Requirements 1.4**
    - Arquivo: `tests/reports/ReportGenerator.property.test.ts`
    - Arbitrários: mesmo de P1 + path temporário via `os.tmpdir()`

- [x] 7. Adicionar subcomando `report generate` ao CLI
  - [x] 7.1 Modificar `src/cli/index.ts` para registrar o comando `report` com subcomando `generate`
    - Argumento `<analysis_file>`, opções `--output <path>` e `--format <format>` (default `'json'`)
    - Ler e validar o arquivo JSON de análise; em caso de erro exibir mensagem descritiva e `process.exit(1)`
    - Chamar `ReportGenerator.generate(analysisResult)`
    - Se `--output` fornecido: gravar arquivo e exibir confirmação no stdout
    - Se `--output` não fornecido: imprimir JSON no stdout
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

- [x] 8. Checkpoint final — Garantir que todos os testes passam
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia os requisitos específicos para rastreabilidade
- Os três gaps são independentes entre si; tasks 1–4 (tipos + detectores) podem ser executadas em paralelo com task 6 (ReportGenerator) se desejado
- Property tests usam `fast-check` com `numRuns: 100` e `verbose: true`
- Tag format nos arquivos de teste: `// Feature: mvp-demo-gaps, Property N: <property_text>`
