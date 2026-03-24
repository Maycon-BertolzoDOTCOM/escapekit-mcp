# Implementation Plan

## Tasks

- [ ] 1. Renomear arquivo e verificar erros de tipo iniciais
  - Renomear `src/generators/EscapeJsonWriter.ts.disabled` → `src/generators/EscapeJsonWriter.ts`
  - Executar `getDiagnostics` em `src/generators/EscapeJsonWriter.ts` para identificar todos os erros de tipo
  - Documentar os erros encontrados antes de corrigir
  - Arquivo: `src/generators/EscapeJsonWriter.ts`

- [ ] 2. Corrigir erro de sintaxe em `buildValidations`
  - Verificar a assinatura do método `buildValidations` — o parâmetro `timestamp: string` deve estar corretamente separado por vírgula dos parâmetros anteriores
  - Corrigir qualquer erro de sintaxe ou tipo identificado pelo `getDiagnostics` na assinatura do método
  - Executar `getDiagnostics` novamente para confirmar que o erro foi resolvido
  - Arquivo: `src/generators/EscapeJsonWriter.ts`

- [ ] 3. Substituir `any` por `Issue` em `inferFixMethod`
  - Adicionar `Issue` ao import existente de `'../models/schemas.js'` (já importa `AnalysisResult`)
  - Alterar a assinatura de `inferFixMethod(issue: any)` para `inferFixMethod(issue: Issue)`
  - Ajustar os comparadores de `issue.type` de `'GHOST_IMPORT'`/`'MOCK_API'` para `'ghost_import'`/`'mock_api'` (valores corretos do `IssueType` de `schemas.ts`)
  - Remover a comparação com `'WEBGL_FALLBACK_NEEDED'` pois esse valor não existe em `IssueType` de `schemas.ts`
  - Verificar que `mapIssueType` também recebe os valores corretos de `issue.type` ao iterar `analysisResult.issues`
  - Executar `getDiagnostics` para confirmar zero erros e zero warnings de `no-explicit-any`
  - Arquivo: `src/generators/EscapeJsonWriter.ts`

- [ ] 4. Descomentar exportações em `src/generators/index.ts`
  - Remover o bloco de comentário `// Temporarily disabled due to type errors`
  - Descomentar `export { EscapeJsonWriter } from './EscapeJsonWriter.js';`
  - Descomentar `export type { EscapeJsonParams } from './EscapeJsonWriter.js';`
  - Executar `getDiagnostics` em `src/generators/index.ts` para confirmar que as exportações são válidas
  - Arquivo: `src/generators/index.ts`

- [ ] 5. Integrar `EscapeJsonWriter` no pipeline `generate.ts`
  - Adicionar bloco de geração do `escape.json` após a escrita do `escape-contract.json` em `generateEscapeKit`
  - Usar import dinâmico `await import('../generators/EscapeJsonWriter.js')` para evitar dependência circular
  - Instanciar `EscapeJsonWriter`, chamar `generate(params)` com `analysisResult`, `resolutions`, `transformations`, `originalCode` e `targetPlatform`
  - Chamar `writeToFile(escapeJson, join(projectPath, 'escape.json'))` e adicionar `'escape.json'` a `filesCreated`
  - Envolver em try/catch: se falhar, logar `warn` e continuar sem interromper o pipeline
  - Respeitar a flag `options.generateEscapeJson !== false` e `!dryRun` antes de gerar
  - Executar `getDiagnostics` em `src/tools/generate.ts` para confirmar zero erros
  - Arquivo: `src/tools/generate.ts`

- [ ] 6. Criar testes unitários para o EscapeJsonWriter
  - Criar `tests/generators/EscapeJsonWriter.test.ts`
  - Testar instanciação sem erros de runtime
  - Testar `generate(params)` com params mínimos válidos — não deve lançar exceção
  - Testar invariante `escapeId === params.analysisResult.analysisId`
  - Testar invariante `analysis.totalIssues === params.analysisResult.issues.length`
  - Testar invariante `transformations.totalTransformations === transformations.applied.length`
  - Testar `buildValidations` com `testResults.failed > 0` → `overallStatus: 'partial'`
  - Testar `buildValidations` com `testResults.failed === 0` → `overallStatus: 'passed'`
  - Testar `buildValidations` sem `testResults` → `overallStatus: 'pending'`, contadores zerados
  - Testar `inferFixMethod` para `'ghost_import'`, `'mock_api'` e tipo não mapeado
  - Testar `writeToFile` — arquivo criado é JSON válido parseável (round-trip)
  - Testar `writeToFile` com caminho inválido — deve lançar `FileSystemError`
  - Arquivo: `tests/generators/EscapeJsonWriter.test.ts`

- [ ] 7. Adicionar testes de propriedade (PBT) com fast-check
  - Adicionar bloco `describe('Correctness Properties')` ao arquivo de testes
  - Implementar `arbitraryIssue()` e `arbitraryEscapeJsonParams()` conforme design
  - P1: `generate(params)` não lança exceção para qualquer `EscapeJsonParams` válido
  - P2: `generate(params).escapeId === params.analysisResult.analysisId` para qualquer params
  - P3: `generate(params).analysis.totalIssues === params.analysisResult.issues.length` para qualquer params
  - P4: `generate(params).transformations.totalTransformations === applied.length` para qualquer params
  - P5: `writeToFile` + `readFile` + `JSON.parse` produz objeto com `escapeId` e `version` equivalentes (round-trip)
  - Arquivo: `tests/generators/EscapeJsonWriter.test.ts`

- [ ] 8. Verificar diagnósticos finais em todos os arquivos modificados
  - Executar `getDiagnostics` em `src/generators/EscapeJsonWriter.ts`
  - Executar `getDiagnostics` em `src/generators/index.ts`
  - Executar `getDiagnostics` em `src/tools/generate.ts`
  - Executar `getDiagnostics` em `tests/generators/EscapeJsonWriter.test.ts`
  - Corrigir quaisquer erros residuais antes de considerar a feature completa
