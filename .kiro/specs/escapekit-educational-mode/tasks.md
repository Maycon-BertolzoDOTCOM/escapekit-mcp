# Plano de Implementação: EscapeKit Educational Mode

## Visão Geral

Implementação incremental do modo educacional do EscapeKit, partindo dos tipos e interfaces centrais, passando pelos componentes puros (`ExplanationGenerator`, `DashboardAggregator`, `EducationalLinkResolver`), templates Handlebars, `EducationalValidator`, persistência de contratos e extensão da CLI.

## Tarefas

- [ ] 1. Definir tipos e interfaces em `src/educational/types.ts`
  - Criar o arquivo `src/educational/types.ts` com todas as interfaces: `ExplanationReport`, `TransformationExplanation`, `ExplanationGeneratorOptions`, `DashboardStats`, `WeeklyTrend`, `TopImport`, `ConfidenceByMethod`, `EducationalLink`, `EducationalValidationResult`, `TransformationDistribution`
  - Exportar todos os tipos para uso pelos demais módulos
  - _Requisitos: 1.2, 2.1, 3.2, 4.1, 6.1, 6.2_

- [ ] 2. Implementar `ExplanationGenerator`
  - [ ] 2.1 Criar `src/educational/ExplanationGenerator.ts`
    - Implementar o método `generate(contract: EscapeContract, options?: ExplanationGeneratorOptions): string`
    - Mapear cada `TransformationType` para o template de frase correspondente (pt-BR)
    - Mapear cada `ResolutionMethod` para o texto descritivo correspondente
    - Incluir `metadata.reasoning` na explicação quando disponível
    - Adicionar aviso de baixa confiança quando `confidence < 0.7`
    - Retornar mensagem de ausência para contratos com zero transformações, sem lançar exceção
    - _Requisitos: 1.2, 1.3, 1.5, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.3, 6.5, 6.6_

  - [ ]* 2.2 Escrever testes de exemplo para `ExplanationGenerator`
    - Criar `tests/educational/ExplanationGenerator.test.ts`
    - Testar: contrato com zero transformações retorna mensagem de ausência
    - Testar: contrato com `IMPORT_REPLACEMENT` retorna frase no formato correto
    - Testar: `confidence < 0.7` inclui aviso de baixa confiança
    - Testar: `metadata.reasoning` preenchido aparece na saída
    - _Requisitos: 1.2, 1.3, 1.5, 2.5, 6.5_

  - [ ]* 2.3 Escrever testes de propriedade para `ExplanationGenerator`
    - Criar `tests/educational/ExplanationGenerator.pbt.test.ts` e `tests/fixtures/arbitraries.ts`
    - **Propriedade 1: ExplanationGenerator puro e determinístico**
    - **Valida: Requisitos 6.1, 6.6, 1.7**
    - **Propriedade 2: Cobertura de transformações no relatório**
    - **Valida: Requisitos 1.2, 1.4**
    - **Propriedade 3: Aviso de baixa confiança**
    - **Valida: Requisito 1.3**
    - **Propriedade 4: Imutabilidade do contrato**
    - **Valida: Requisito 1.7**
    - **Propriedade 5: Mapeamento de ResolutionMethod para texto**
    - **Valida: Requisitos 2.2, 2.3, 2.4**
    - **Propriedade 6: Inclusão de metadata.reasoning**
    - **Valida: Requisito 2.5**
    - **Propriedade 13: String não vazia para qualquer contrato válido**
    - **Valida: Requisitos 6.3, 6.5, 1.5**

- [ ] 3. Implementar `DashboardAggregator`
  - [ ] 3.1 Criar `src/educational/DashboardAggregator.ts`
    - Implementar o método `aggregate(contracts: EscapeContract[]): DashboardStats`
    - Calcular `totalExecutions`, `totalCorrections`, `distributionByType`, `topImports` (top 5), `confidenceByMethod`, `weeklyTrend`
    - Calcular tendência semanal comparando semana atual com semana anterior
    - Retornar stats com zeros e `weeklyTrend.direction = 'STABLE'` para array vazio
    - Ignorar silenciosamente contratos malformados sem lançar exceção
    - _Requisitos: 3.2, 3.3, 3.8, 6.2, 6.4_

  - [ ]* 3.2 Escrever testes de exemplo para `DashboardAggregator`
    - Criar `tests/educational/DashboardAggregator.test.ts`
    - Testar: array vazio retorna stats com zeros e `STABLE`
    - Testar: array com N contratos retorna `totalExecutions === N`
    - Testar: JSON inválido misturado não lança exceção
    - _Requisitos: 3.2, 3.3, 3.8, 6.4_

  - [ ]* 3.3 Escrever testes de propriedade para `DashboardAggregator`
    - Criar `tests/educational/DashboardAggregator.pbt.test.ts`
    - **Propriedade 7: DashboardAggregator puro e totalExecutions correto**
    - **Valida: Requisitos 6.2, 6.4, 3.2**
    - **Propriedade 8: Campos obrigatórios do DashboardStats**
    - **Valida: Requisitos 3.2, 3.3**
    - **Propriedade 9: Robustez com entradas inválidas**
    - **Valida: Requisito 3.8**

- [ ] 4. Checkpoint — garantir que todos os testes dos componentes puros passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [ ] 5. Implementar `EducationalLinkResolver`
  - [ ] 5.1 Criar `src/educational/EducationalLinkResolver.ts`
    - Implementar o método `resolve(resolution: DependencyResolution, transformationType: TransformationType): EducationalLink[]`
    - Gerar link npm para `IMPORT_REPLACEMENT` com `resolvedPackage` não vazio
    - Detectar correções TypeScript via `resolvedPackage` contendo `typescript` ou `@types/`, ou `appliedRules` com tag `typescript`
    - Detectar Web APIs via padrões em `originalImport` ou `resolvedPackage` (`webgl`, `canvas`, `fetch`, `indexeddb`, etc.)
    - Omitir link npm quando `resolvedPackage` for vazio, sem lançar exceção
    - _Requisitos: 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.2 Escrever testes de exemplo para `EducationalLinkResolver`
    - Criar `tests/educational/EducationalLinkResolver.test.ts`
    - Testar: `IMPORT_REPLACEMENT` para `axios` retorna `https://www.npmjs.com/package/axios`
    - Testar: `resolvedPackage` vazio não lança exceção e omite link npm
    - Testar: pacote `@types/node` retorna link TypeScript docs
    - _Requisitos: 4.3, 4.4, 4.5_

  - [ ]* 5.3 Escrever testes de propriedade para `EducationalLinkResolver`
    - Criar testes no arquivo `tests/educational/EducationalLinkResolver.test.ts` ou arquivo PBT dedicado
    - **Propriedade 10: Links educacionais corretos por tipo de correção**
    - **Valida: Requisitos 4.3, 4.4, 4.5**

- [ ] 6. Criar templates Handlebars
  - [ ] 6.1 Criar `templates/explanation.md.hbs`
    - Implementar template com: cabeçalho (data/hora, contractId), lista de transformações com explicação, aviso de baixa confiança, reasoning e links educacionais por transformação, seção de resumo com `totalCorrections` e `lowConfidenceCount`
    - _Requisitos: 1.4, 2.7, 4.6_

  - [ ] 6.2 Criar `templates/dashboard.md.hbs`
    - Implementar template Markdown com: total de execuções, total de correções, distribuição por tipo, top 5 imports, média de confiança por método, tendência semanal
    - _Requisitos: 3.2, 3.3, 3.5_

  - [ ] 6.3 Criar `templates/dashboard.html.hbs`
    - Implementar template HTML equivalente ao `dashboard.md.hbs`
    - _Requisitos: 3.4_

- [ ] 7. Implementar `EducationalValidator`
  - [ ] 7.1 Criar `src/educational/EducationalValidator.ts`
    - Implementar a classe com injeção de dependências: `ValidationEngine`, `ExplanationGenerator`, `EducationalLinkResolver`, `EscapeContractWriter`, `TemplateEngine`
    - Implementar `validate(projectPath, options)`: executar nível `thorough` via `ValidationEngine`, gerar relatório via `ExplanationGenerator` com `includeEducationalLinks: true`, resolver links via `EducationalLinkResolver`, salvar contrato e relatório
    - Retornar `EducationalValidationResult` com todos os campos preenchidos
    - _Requisitos: 4.1, 4.2, 4.6, 4.7, 4.8_

  - [ ]* 7.2 Escrever testes de integração para `EducationalValidator`
    - Criar `tests/educational/EducationalValidator.test.ts`
    - Testar orquestração completa com mocks de `ValidationEngine` e `EscapeContractWriter`
    - Testar que `summary` contém `correctionsApplied`, `educationalLinksGenerated` e `reportPath`
    - **Propriedade 11: Cobertura de links educacionais por transformação**
    - **Valida: Requisito 4.2**
    - _Requisitos: 4.1, 4.2, 4.7, 4.8_

- [ ] 8. Estender `EscapeContractWriter` para persistência em `.escapekit/contracts/`
  - Modificar (ou estender via composição) `EscapeContractWriter` para salvar contratos em `.escapekit/contracts/<contractId>.json`
  - Criar o diretório `.escapekit/contracts/` automaticamente se não existir
  - Registrar no log o caminho do arquivo gerado após cada gravação
  - Em caso de falha de escrita, registrar o erro no log e continuar sem interromper o fluxo principal
  - Garantir que o schema do contrato não é alterado (compatibilidade retroativa)
  - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9. Estender a CLI com `--explain`, `dashboard` e `--level educational`
  - [ ] 9.1 Adicionar flag `--explain` ao comando `validate`
    - Após a validação, instanciar `ExplanationGenerator` e gerar o relatório
    - Salvar em `.escapekit/explanation.md` por padrão, ou no caminho de `--output` se especificado
    - Exibir mensagem `"Nenhuma correção foi necessária — nada a explicar."` quando não houver transformações, sem gerar arquivo
    - Salvar contrato em `.escapekit/contracts/<contractId>.json`
    - _Requisitos: 1.1, 1.5, 1.6, 5.1_

  - [ ] 9.2 Adicionar comando `escapekit dashboard`
    - Ler todos os arquivos JSON em `.escapekit/contracts/` (ou `--contracts-dir`)
    - Instanciar `DashboardAggregator` e chamar `aggregate()`
    - Renderizar via `TemplateEngine`: `dashboard.md` por padrão, `dashboard.html` com `--format html`
    - Gravar no caminho de `--output` se especificado
    - Exibir `"Nenhum histórico encontrado. Execute o EscapeKit em um projeto primeiro."` e encerrar com código 0 se não houver contratos
    - _Requisitos: 3.1, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 9.3 Adicionar nível `educational` ao `--level`
    - Registrar `educational` como valor válido do `--level`
    - Delegar para `EducationalValidator.validate()` quando `--level educational` for usado
    - Exibir no terminal: número de correções aplicadas, número de links educacionais gerados e caminho do relatório
    - _Requisitos: 4.1, 4.7_

- [ ] 10. Checkpoint final — garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Os componentes `ExplanationGenerator` e `DashboardAggregator` são funções puras — implementar e testar antes de qualquer integração com I/O
- Os testes de propriedade usam **fast-check** (já presente no projeto) com mínimo de 100 iterações cada
- O arquivo `tests/fixtures/arbitraries.ts` deve ser criado junto com os primeiros testes de propriedade (tarefa 2.3) e reutilizado nas demais
- Nenhum schema existente (`EscapeContract`, `DependencyResolution`, `CodeTransformation`) deve ser modificado
