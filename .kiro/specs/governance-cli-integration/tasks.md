# Plano de Implementação: governance-cli-integration

## Visão Geral

Integrar o `GovernanceEngine` ao CLI do EscapeKit, expor o `FederatedMemoryAdapter` na factory
`createGovernanceStack()`, adicionar o endpoint `GET /stats` ao servidor federado, expandir
`GovernanceContext.origin` com 6 novos valores e conectar o comando `validate` ao fluxo de
governança via flag `--govern`.

## Tarefas

- [x] 1. Expandir tipos e exports em `src/governance/types.ts`
  - Atualizar o tipo `GovernanceOrigin` adicionando os valores: `'antigravity' | 'gemini' | 'gpt' | 'mistral' | 'v0' | 'lovable'`
  - Atualizar `GovernanceContext.origin` para usar o tipo expandido (11 valores no total)
  - Adicionar o tipo exportado `GovernanceOrigin` como alias do union type
  - Adicionar a interface `FederatedServerConfig` com campos `url: string`, `epsilon?: number`, `noiseType?: NoiseType` e `sector?: string`
  - Adicionar o campo opcional `federatedServer?: FederatedServerConfig` em `GovernanceStackOptions`
  - _Requisitos: 4.1, 4.2, 2.3_

  - [x]* 1.1 Escrever teste de propriedade para GovernanceOrigin
    - **Propriedade P10: GovernanceContext.origin aceita todos os 11 valores sem erro de tipo**
    - **Valida: Requisito 4.1**

- [x] 2. Atualizar factory `createGovernanceStack()` em `src/governance/index.ts`
  - [x] 2.1 Instanciar `FederatedMemoryAdapter` quando `options.federatedServer?.url` estiver definida
    - Mapear `FederatedServerConfig` para `FederatedMemoryOptions` (herdar `sqlitePath` de `GovernanceStackOptions`)
    - Lançar `GovernanceInitError` se o servidor não estiver acessível durante a inicialização
    - Manter o comportamento atual com `HybridMemoryAdapter` quando `federatedServer` não for fornecido
    - _Requisitos: 2.1, 2.2, 2.4_

  - [x]* 2.2 Escrever teste de propriedade para createGovernanceStack com federatedServer
    - **Propriedade P5: createGovernanceStack com federatedServer.url → memory é FederatedMemoryAdapter**
    - **Valida: Requisito 2.1**

  - [x]* 2.3 Escrever teste de propriedade para createGovernanceStack sem federatedServer
    - **Propriedade P6: createGovernanceStack sem federatedServer → memory é HybridMemoryAdapter**
    - **Valida: Requisito 2.2**

  - [x] 2.4 Adicionar exports em `src/governance/index.ts`
    - Exportar `FederatedMemoryAdapter`, `FederatedMemoryOptions` e `FederatedPattern`
    - Exportar `GovernanceOrigin` e `FederatedServerConfig` de `types.ts`
    - _Requisitos: 2.5_

- [x] 3. Checkpoint — garantir que todos os testes existentes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 4. Adicionar endpoint `GET /stats` em `federated-server/main.py`
  - [x] 4.1 Adicionar modelos Pydantic `SectorCount` e `StatsResponse`
    - `SectorCount`: campos `sector: str` e `count: int`
    - `StatsResponse`: campos `total_patterns: int`, `patterns_by_rule_type: dict[str, int]`, `avg_success_rate: float` e `top_sectors: list[SectorCount]`
    - _Requisitos: 3.1_

  - [x] 4.2 Implementar endpoint `GET /stats`
    - Calcular `total_patterns` como `len(_store.get_all())`
    - Calcular `patterns_by_rule_type` agrupando por `meta["rule_type"]`
    - Calcular `avg_success_rate` como média de `meta["success_count"]` normalizada para [0, 1]
    - Calcular `top_sectors` ordenando setores por contagem decrescente, retornando no máximo 5
    - Retornar zeros/listas vazias quando não há padrões (REQ 3.2)
    - Capturar exceções internas e retornar HTTP 500 com `{"detail": "<mensagem>"}` (REQ 3.6)
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x]* 4.3 Escrever testes pytest+hypothesis para `GET /stats` em `federated-server/tests/test_stats.py`
    - **Propriedade P7: GET /stats com store vazio → zeros**
    - **Valida: Requisito 3.2**
    - **Propriedade P8: GET /stats → top_sectors ≤ 5 entradas**
    - **Valida: Requisito 3.4**
    - **Propriedade P9: GET /stats → avg_success_rate em [0, 1]**
    - **Valida: Requisito 3.3**

- [x] 5. Adicionar comando `govern` em `src/cli/index.ts`
  - [x] 5.1 Implementar funções auxiliares
    - `readCodeInput(file?: string): Promise<string>` — lê arquivo ou stdin; lança erro com `process.exit(1)` se arquivo não encontrado (REQ 1.2)
    - `parseOrigin(value: string): GovernanceOrigin` — valida contra os 11 valores; lança erro com mensagem do REQ 4.5 e `process.exit(1)` se inválido
    - `parseStrategy(value: string): GovernanceStrategy` — valida contra `fast | thorough | compliance-first`; lança erro com mensagem do REQ 1.7 e `process.exit(1)` se inválido
    - `buildGovernContext(code: string, opts: object): GovernanceContext` — monta o contexto com defaults (`actor: "cli"`, `origin: "unknown"`, `projectId: basename(cwd)`)
    - `printPassportSummary(passport: GovernancePassport): void` — exibe `passportId`, `riskLevel`, `memoryEnriched`, contagem de `complianceStamps`, contagem de `auditTrail` e `estimatedRemediationCost`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.13, 1.14, 1.15, 4.4, 4.5_

  - [x] 5.2 Registrar o comando `govern` no programa Commander
    - `.argument('[file]', ...)` para o arquivo de entrada
    - Flags: `--output <format>`, `--strategy <valor>`, `--requirements <ids>`, `--federated`, `--server-url <url>`, `--project-id <id>`, `--actor <nome>`, `--origin <valor>`
    - Quando `--output json`: serializar `GovernancePassport` completo em stdout (REQ 1.5)
    - Quando `--federated`: inicializar pilha com `FederatedMemoryAdapter`; usar `http://localhost:8000` se `--server-url` omitido (REQ 1.9, 1.10, 1.11)
    - Capturar exceções do `GovernanceEngine.govern()` e encerrar com código 1 (REQ 1.12)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15_

- [x] 6. Adicionar flag `--govern` ao comando `validate` em `src/cli/index.ts`
  - [x] 6.1 Implementar `collectProjectCode(projectPath: string): Promise<string>`
    - Varrer o diretório raiz do projeto em busca de arquivos `.ts`, `.js`, `.tsx` e `.jsx`
    - Concatenar o conteúdo de todos os arquivos encontrados
    - Retornar string não-vazia se houver ao menos um arquivo (REQ 5.5)
    - _Requisitos: 5.5_

  - [x] 6.2 Adicionar flag `--govern` e flags relacionadas ao comando `validate`
    - Adicionar `.option('--govern', ...)`, `--strategy`, `--requirements` ao comando existente
    - Após a validação, se `--govern` fornecido: chamar `GovernanceEngine.govern()` com o código coletado
    - Exibir `GovernancePassport` no formato do REQ 1.4 (ou incluir sob `"governancePassport"` no JSON)
    - Se `GovernanceEngine.govern()` lançar exceção: exibir como aviso e usar o exit code da validação (REQ 5.6)
    - Repassar `--strategy` e `--requirements` ao `GovernanceEngine` (REQ 5.7, 5.8)
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 7. Checkpoint — garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 8. Escrever testes PBT TypeScript em `tests/governance/governance-cli-integration.test.ts`
  - [x]* 8.1 Propriedade P1 — govern com arquivo inexistente → exit 1
    - **Propriedade P1: govern com arquivo inexistente → exit 1**
    - **Valida: Requisito 1.2**

  - [x]* 8.2 Propriedade P2 — govern com --strategy inválida → exit 1 com mensagem
    - **Propriedade P2: govern com --strategy inválida → exit 1 com mensagem**
    - **Valida: Requisito 1.7**

  - [x]* 8.3 Propriedade P3 — govern com --origin inválida → exit 1 com mensagem
    - **Propriedade P3: govern com --origin inválida → exit 1 com mensagem**
    - **Valida: Requisito 4.5**

  - [x]* 8.4 Propriedade P4 — govern com --output json → stdout é JSON válido com GovernancePassport
    - **Propriedade P4: govern com --output json → stdout é JSON válido com GovernancePassport**
    - **Valida: Requisito 1.5**

  - [ ]* 8.5 Propriedade P11 — validate --govern com servidor indisponível → exit code da validação
    - **Propriedade P11: validate --govern com servidor indisponível → exit code da validação**
    - **Valida: Requisito 5.6**

  - [x]* 8.6 Propriedade P12 — collectProjectCode → string não-vazia para projeto com .ts/.js
    - **Propriedade P12: collectProjectCode → string não-vazia para projeto com .ts/.js**
    - **Valida: Requisito 5.5**

  - [x]* 8.7 Propriedade P13 — govern sem --federated → sem chamadas HTTP ao servidor
    - **Propriedade P13: govern sem --federated → sem chamadas HTTP ao servidor**
    - **Valida: Requisito 1.9 (negativo)**

- [x] 9. Checkpoint final — garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Os checkpoints garantem validação incremental entre as fases
- P1–P4, P10–P13 são cobertos pelos testes TypeScript com fast-check
- P5–P6 são cobertos pelos testes TypeScript de integração da factory
- P7–P9 são cobertos pelos testes Python com pytest+hypothesis
