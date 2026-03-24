# Plano de Implementação: Academic Paper Validation

## Overview

Implementação incremental do sistema de rastreabilidade acadêmica do EscapeKit: tipos → extensão do KnowledgeBase → contratos YAML → IssueEnricher → CoverageValidator → CLI → testes.

## Tasks

- [x] 1. Criar tipos base em `src/models/academic.ts`
  - Definir interfaces `AcademicReference`, `TraceabilityEntry`, `YAMLFact`, `YAMLRule`, `ContratoYAML`, `ContractCoverage`, `CoverageReport`, `PaperRegistryEntry`
  - _Requirements: 1.1, 5.3, 3.1_

- [x] 2. Estender `Issue` em `src/models/schemas.ts`
  - Adicionar campo opcional `academicReference?: AcademicReference` na interface `Issue`
  - Importar `AcademicReference` de `src/models/academic.ts`
  - _Requirements: 1.1_

- [x] 3. Estender `KnowledgeBase` em `src/resolvers/KnowledgeBase.ts`
  - [x] 3.1 Adicionar `Map<string, AcademicReference[]>` privado (`academicRefs`)
    - Coexistir com o `Map<string, PackageMapping>` existente sem quebrar nada
    - _Requirements: 2.1_
  - [x] 3.2 Implementar `loadPaperContracts(registryPath: string): Promise<void>`
    - Ler `registry.yaml`, iterar entradas, carregar cada `contractFile` com `yaml.parse`
    - Para cada `rule` com `paperRef` definido e `traceability[ruleId].status === 'implemented'`, inserir `AcademicReference` no mapa indexada por `detector_name`
    - Tratar erros graciosamente: arquivo não encontrado, YAML inválido, campos obrigatórios ausentes — logar warning e continuar
    - _Requirements: 2.2, 2.5, 2.7, 3.4, 5.2_
  - [x] 3.3 Implementar `getAcademicReference(issueType: string): AcademicReference[] | undefined`
    - Lookup simples no mapa `academicRefs`, retornar `undefined` sem exceção se não encontrado
    - _Requirements: 2.3, 1.8_
  - [x] 3.4 Implementar `loadContractsSync(contracts: ContratoYAML[]): void`
    - Método auxiliar para testes: recebe array de contratos em memória, constrói `academicRefs` sem I/O
    - Mesma lógica de filtragem de `loadPaperContracts` (paperRef + status implemented)
    - _Requirements: 8.1, 2.6_

- [x] 4. Criar contratos YAML na `knowledge-base/`
  - [x] 4.1 Criar `knowledge-base/registry.yaml`
    - Listar os 7 papers com campos: `paperId`, `title`, `venue`, `year`, `contractFile`, `detectors`
    - _Requirements: 3.1, 3.2_
  - [x] 4.2 Criar `knowledge-base/ieee-sp-2024.yaml`
    - Seções: `source`, `facts`, `patterns`, `rules`, `cases`, `traceability`
    - Pelo menos uma rule com `detector_name: SlopsquatDetector`, `paperRef: "IEEE-SP-2024"`, `traceability.status: implemented`
    - _Requirements: 7.1, 7.2, 5.6_
  - [x] 4.3 Criar `knowledge-base/ccs-2023.yaml`
    - Pelo menos uma rule com `detector_name: PostInstallDetector`, `paperRef: "CCS-2023"`, `traceability.status: implemented`
    - _Requirements: 7.1, 7.3, 5.6_
  - [x] 4.4 Criar `knowledge-base/esec-fse-2024.yaml`
    - Pelo menos uma rule com `detector_name: PolyfillInjector`, `paperRef: "ESEC-FSE-2024"`, `traceability.status: implemented`
    - _Requirements: 7.1, 7.4, 5.6_
  - [x] 4.5 Criar `knowledge-base/icwe-2024.yaml`
    - Pelo menos uma rule com `detector_name: WebGLDetector`, `paperRef: "ICWE-2024"`, `traceability.status: implemented`
    - _Requirements: 7.1, 7.5, 5.6_
  - [x] 4.6 Criar `knowledge-base/ase-2023-config.yaml`
    - Pelo menos uma rule com `detector_name: ConfigUpdater`, `paperRef: "ASE-2023-Config"`, `traceability.status: implemented`
    - _Requirements: 7.1, 7.6, 5.6_
  - [x] 4.7 Criar `knowledge-base/ase-2023-ghost.yaml`
    - Pelo menos uma rule com `detector_name: DependencyValidator`, `paperRef: "ASE-2023-Ghost"`, `traceability.status: implemented`
    - _Requirements: 7.1, 7.7, 5.6_
  - [x] 4.8 Criar `knowledge-base/icse-2024.yaml`
    - Fatos sobre características de código gerado por IA, rules mapeadas para detectores existentes com `paperRef: "ICSE-2024"`
    - _Requirements: 7.1, 7.8, 5.6_

- [x] 5. Checkpoint — Verificar que o KnowledgeBase carrega os contratos corretamente
  - Garantir que todos os testes existentes continuam passando, perguntar ao usuário se houver dúvidas.

- [x] 6. Implementar `src/academic/IssueEnricher.ts`
  - Implementar funções puras `enrichIssue(issue, kb): Issue` e `enrichIssues(issues, kb): Issue[]`
  - `enrichIssue` chama `kb.getAcademicReference(issue.type)` e retorna `{ ...issue, academicReference: refs[0] }` se houver refs, ou a issue original caso contrário
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 7. Implementar `src/academic/CoverageValidator.ts`
  - [x] 7.1 Implementar `validate(contracts: ContratoYAML[]): CoverageReport`
    - Para cada contrato: contar `totalRules`, `totalFacts`, `implementedCount` (status implemented), `pendingCount`, `missingCount` (sem entrada traceability)
    - Calcular `gaps`: IDs de rules e facts sem entrada em `traceability`
    - Calcular `coveragePercentage = Math.round((totalImplemented / (totalRules + totalFacts)) * 1000) / 10`
    - Retornar `CoverageReport` com `generatedAt: new Date().toISOString()`
    - Para array vazio, retornar todos os totais zerados e `coveragePercentage: 0.0`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.8, 8.2_
  - [x] 7.2 Implementar `formatReport(report: CoverageReport): string`
    - Formato texto para saída no terminal, incluindo lista de gaps no formato `[PAPER_ID] [ID]: sem implementação registrada`
    - Exibir `"Cobertura completa: 100% dos fatos e regras possuem implementação registrada."` quando `coveragePercentage === 100.0`
    - _Requirements: 4.4, 4.6_
  - [x] 7.3 Implementar `formatMarkdown(report: CoverageReport): string`
    - Formato Markdown para gravação em arquivo via `--output`
    - _Requirements: 4.7_

- [x] 8. Estender CLI em `src/cli/index.ts` e `src/commands/audit.ts`
  - [x] 8.1 Adicionar flag `--academic` ao comando `validate` em `src/cli/index.ts`
    - Quando presente: chamar `kb.loadPaperContracts()`, depois `enrichIssues()`, exibir linha `  📄 Ref: <title> (<venue>, <year>) — Regra <ruleId>` após cada issue com `academicReference`
    - Sem a flag: comportamento inalterado (retrocompatível)
    - _Requirements: 6.1, 6.3, 6.4, 6.7_
  - [x] 8.2 Adicionar flag `--academic` ao comando `audit` em `src/commands/audit.ts`
    - Mesma lógica de enriquecimento e exibição do `validate`
    - _Requirements: 6.2, 6.3_
  - [x] 8.3 Adicionar suporte a `--academic --format json` no comando `validate`
    - Incluir campo `academicReference` completo no JSON de saída quando a flag estiver presente
    - _Requirements: 6.5_
  - [x] 8.4 Adicionar comando `coverage` em `src/cli/index.ts`
    - Ler `registry.yaml`, instanciar `CoverageValidator`, chamar `validate()`, exibir `formatReport()`
    - Suportar flag `--output <caminho>` para gravar `formatMarkdown()` no arquivo especificado
    - _Requirements: 4.1, 4.7_

- [x] 9. Atualizar `scripts/paper-to-contract.sh`
  - Adicionar geração do campo `paperRef` em cada `rule` gerada
  - Adicionar seção `traceability` com `status: pending` para cada fato e regra gerado
  - _Requirements: 5.5_

- [x] 10. Checkpoint — Garantir que todos os testes existentes passam e a CLI funciona
  - Executar suite de testes existente, perguntar ao usuário se houver dúvidas.

- [x] 11. Criar geradores fast-check em `tests/academic/arbitraries.ts`
  - Implementar `arbitraryContratoYAML()` e `arbitraryFullyImplementedContratoYAML()` conforme design
  - _Requirements: 8.8_

- [x] 12. Criar testes para a extensão do KnowledgeBase em `tests/academic/KnowledgeBase.academic.test.ts`
  - [x] 12.1 Unit tests: mapeamento concreto `slopsquat_risk → IEEE-SP-2024`, issueType desconhecido retorna `undefined`, YAML inválido não lança exceção, registry vazio inicializa índice vazio
    - _Requirements: 1.2, 1.8, 2.5, 2.7_
  - [ ]* 12.2 Property test — Property 1: TraceabilityIndex round-trip
    - **Property 1: TraceabilityIndex round-trip**
    - **Validates: Requirements 2.3, 2.4, 8.3**
  - [ ]* 12.3 Property test — Property 2: apenas regras implementadas com paperRef no índice
    - **Property 2: Apenas regras implementadas com paperRef contribuem para o índice**
    - **Validates: Requirements 5.7, 1.9**
  - [ ]* 12.4 Property test — Property 5: determinismo do TraceabilityIndex
    - **Property 5: Determinismo do TraceabilityIndex**
    - **Validates: Requirements 2.6, 8.5**

- [x] 13. Criar testes para o CoverageValidator em `tests/academic/CoverageValidator.test.ts`
  - [x] 13.1 Unit tests: contrato sem traceability tem cobertura zero, array vazio retorna `coveragePercentage: 0.0`, gaps listados corretamente
    - _Requirements: 4.2, 4.3, 5.4_
  - [ ]* 13.2 Property test — Property 3: cálculo do coveragePercentage
    - **Property 3: Cálculo do coveragePercentage**
    - **Validates: Requirements 4.5**
  - [ ]* 13.3 Property test — Property 4: todos implementados → 100%
    - **Property 4: Cobertura total quando todos implementados**
    - **Validates: Requirements 4.6, 8.4**
  - [ ]* 13.4 Property test — Property 7: detecção de lacunas
    - **Property 7: Detecção de lacunas**
    - **Validates: Requirements 4.3**

- [x] 14. Criar testes para o IssueEnricher em `tests/academic/IssueEnricher.test.ts`
  - Unit tests: issue com ref conhecida recebe `academicReference`, issue com tipo desconhecido retorna inalterada, `enrichIssues` processa array completo
  - _Requirements: 1.2, 1.8, 8.7_

- [x] 15. Criar testes de formatação em `tests/academic/formatters.test.ts`
  - Unit tests para a linha de referência acadêmica na CLI: contém `title`, `venue`, `year`, `ruleId`
  - [ ]* 15.1 Property test — Property 6: formatação da linha de referência acadêmica
    - **Property 6: Formatação da linha de referência acadêmica**
    - **Validates: Requirements 6.1**

- [x] 16. Checkpoint final — Todos os testes passando
  - Garantir que todos os testes (existentes e novos) passam, perguntar ao usuário se houver dúvidas.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- `loadContractsSync` é exclusivo para testes — não expor na interface pública de produção
- Os contratos YAML devem refletir o estado real de implementação dos detectores existentes
- A flag `--academic` é estritamente aditiva: sem ela, nenhum comportamento existente muda
