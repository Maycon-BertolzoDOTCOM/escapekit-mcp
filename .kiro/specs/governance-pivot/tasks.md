# Plano de Implementação: CodeMemória Governance Pivot

## Visão Geral

Implementação incremental da camada `src/governance/` que compõe o `ValidationEngine` existente com memória persistente (SQLite + Chroma opcional), verificação de compliance via contratos YAML e auditoria por cadeia de hashes imutável. Nenhum arquivo existente é modificado.

## Tarefas

- [x] 1. Verificar e instalar dependências
  - Verificar se `better-sqlite3`, `@types/better-sqlite3`, `uuid` e `@types/uuid` estão em `package.json`
  - Instalar dependências ausentes: `npm install better-sqlite3 uuid` e `npm install --save-dev @types/better-sqlite3 @types/uuid`
  - Verificar se `js-yaml` ou `yaml` já está disponível (usado pelo qwen-escapekit)
  - Confirmar que `fast-check` e `vitest` já estão presentes como devDependencies
  - _Requisitos: 7.1, 7.2_

- [x] 2. Criar módulo core: types, interfaces e errors
  - [x] 2.1 Criar `src/governance/types.ts` com todas as entidades tipadas
    - Definir `RiskLevel`, `GovernanceStrategy`, `CodeFingerprint`, `ComplianceStamp`, `AuditTrail`, `AuditEvent`, `GovernancePassport`, `GovernanceContext`, `GovernanceStackOptions`
    - Garantir que `complexity >= 0` e `score` em [0,1] são documentados nos comentários de tipo
    - _Requisitos: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.2 Criar `src/governance/interfaces.ts` com as quatro interfaces públicas
    - Definir `IGovernanceEngine`, `IHybridMemory`, `IComplianceChecker`, `IAuditLogger`
    - _Requisitos: 2.1, 3.1, 4.1, 5.1_
  - [x] 2.3 Criar `src/governance/errors.ts` com a hierarquia de erros
    - Implementar `GovernanceError`, `GovernanceValidationError`, `GovernanceInitError`, `AuditWriteError`, `DuplicatePassportError`
    - _Requisitos: 1.5, 1.6, 5.7, 6.6_

- [x] 3. Criar utilitários: hash e fingerprint
  - [x] 3.1 Criar `src/governance/utils/hash.ts`
    - Implementar `sha256(input: string): string` usando `crypto` nativo do Node.js
    - Implementar `chainHash(parentHash: string | null, timestamp: Date, action: string, actor: string, inputHash: string, resultHash: string): string` usando a fórmula `SHA-256(parentHash + "|" + timestamp.toISOString() + "|" + action + "|" + actor + "|" + inputHash + "|" + resultHash)`
    - _Requisitos: 5.3_
  - [x] 3.2 Criar `src/governance/utils/fingerprint.ts`
    - Implementar `computeFingerprint(code: string): CodeFingerprint` gerando hash SHA-256 do código, astSignature simplificada, lista de dependências detectadas e complexidade ciclomática estimada
    - Implementar `computeSimilarity(a: CodeFingerprint, b: CodeFingerprint): number` com a fórmula: `(1/3 * hashMatch) + (1/3 * jaccardDeps) + (1/3 * complexityScore)`
    - Garantir que `computeSimilarity` retorna valor em [0, 1]
    - _Requisitos: 3.5, 3.6_

- [x] 4. Implementar AuditLoggerAdapter
  - [x] 4.1 Criar `src/governance/adapters/AuditLoggerAdapter.ts`
    - Implementar `IAuditLogger` com os métodos `log()`, `getChain()` e `verifyIntegrity()`
    - Criar diretório `./audit-logs/` automaticamente se não existir
    - Persistir cada entrada como arquivo JSON individual com nome `{timestamp_iso8601_sanitizado}_{chainHash[:8]}.json`
    - `log()`: calcular `chainHash` via `chainHash()` de `utils/hash.ts`, usar `parentHash: null` na primeira entrada e `chainHash` da última entrada nas subsequentes
    - `getChain()`: ler todos os arquivos do diretório, filtrar por `passportId`, ordenar por `timestamp` crescente
    - `verifyIntegrity()`: recalcular `chainHash` de cada entrada e verificar sequência de `parentHash`
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_
  - [x]* 4.2 Escrever teste de propriedade P15: chainHash calculado corretamente
    - **Propriedade 15: chainHash calculado corretamente pela fórmula**
    - **Valida: Requisito 5.3**
    - Usar `fc.assert(fc.property(...), { numRuns: 100 })` em `tests/governance/AuditLoggerAdapter.test.ts`
  - [x]* 4.3 Escrever teste de propriedade P16: encadeamento correto de parentHash
    - **Propriedade 16: Encadeamento correto de parentHash**
    - **Valida: Requisito 5.5**
  - [x]* 4.4 Escrever teste de propriedade P17: integridade da cadeia de auditoria
    - **Propriedade 17: Integridade da cadeia — verifyIntegrity() retorna true para cadeias íntegras e false para adulteradas**
    - **Valida: Requisitos 5.6, 5.7, 8.5, 8.6**
  - [x]* 4.5 Escrever teste de propriedade P18: getChain() retorna N entradas em ordem cronológica
    - **Propriedade 18: getChain() retorna exatamente N entradas ordenadas por timestamp**
    - **Valida: Requisitos 5.9, 8.11**
  - [x]* 4.6 Escrever teste de propriedade P19: sensibilidade temporal do chainHash
    - **Propriedade 19: Dois eventos com mesmos dados mas timestamps diferentes produzem chainHashes distintos**
    - **Valida: Requisito 5.10**

- [x] 5. Checkpoint — AuditLoggerAdapter
  - Garantir que todos os testes do `AuditLoggerAdapter` passam. Perguntar ao usuário se há dúvidas antes de continuar.

- [x] 6. Implementar HybridMemoryAdapter
  - [x] 6.1 Criar `src/governance/adapters/HybridMemoryAdapter.ts`
    - Implementar `IHybridMemory` com os métodos `save()`, `recall()` e `getSuccessRate()`
    - Criar tabela SQLite `governance_passports` automaticamente na inicialização com `better-sqlite3`
    - `save()`: serializar `GovernancePassport` em JSON e inserir na tabela; lançar `DuplicatePassportError` em colisão de `passportId`
    - `recall()`: buscar por `fingerprint_hash` no SQLite, calcular similaridade via `computeSimilarity()`, filtrar por threshold
    - `getSuccessRate()`: contar passaportes com `riskLevel: "low"` sobre total com mesmo `fingerprint.hash`; retornar `0.0` se não houver registros
    - Inicializar Chroma opcionalmente: se `enableChroma` e `chromadb` disponível, usar para busca semântica; caso contrário, fallback silencioso para SQLite
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_
  - [x]* 6.2 Escrever teste de propriedade P8: recall() respeita threshold de similaridade
    - **Propriedade 8: recall(fingerprint, T) retorna apenas passaportes com similaridade >= T**
    - **Valida: Requisito 3.5**
    - Usar SQLite em memória (`:memory:`) para isolamento
  - [x]* 6.3 Escrever teste de propriedade P9: similaridade de fingerprint está em [0, 1]
    - **Propriedade 9: computeSimilarity() retorna valor em [0, 1] para qualquer par de CodeFingerprints**
    - **Valida: Requisito 3.6**
  - [x]* 6.4 Escrever teste de propriedade P10: getSuccessRate() retorna proporção correta em [0, 1]
    - **Propriedade 10: getSuccessRate() retorna proporção de passaportes com riskLevel "low" em [0, 1]**
    - **Valida: Requisitos 3.7, 8.9**
  - [x]* 6.5 Escrever teste de propriedade P11: round-trip JSON do GovernancePassport
    - **Propriedade 11: serializar e desserializar um GovernancePassport em JSON produz objeto equivalente**
    - **Valida: Requisitos 3.10, 8.4**
  - [x]* 6.6 Escrever teste de propriedade P20: round-trip de persistência de passaporte
    - **Propriedade 20: save(passport) seguido de recall(passport.codeFingerprint, 1.0) retorna array contendo o passaporte salvo**
    - **Valida: Requisito 8.7**

- [x] 7. Checkpoint — HybridMemoryAdapter
  - Garantir que todos os testes do `HybridMemoryAdapter` passam. Perguntar ao usuário se há dúvidas antes de continuar.

- [x] 8. Implementar ComplianceCheckerAdapter
  - [x] 8.1 Criar `src/governance/adapters/ComplianceCheckerAdapter.ts`
    - Implementar `IComplianceChecker` com os métodos `check()` e `loadContract()`
    - `loadContract()`: parsear YAML usando `js-yaml` ou `yaml`, registrar regras em memória; em caso de YAML inválido, logar aviso e ignorar o contrato
    - Carregar automaticamente todos os arquivos `.yaml` de `contractsDir` na inicialização
    - Se `contractsDir` não existir ou estiver vazio, logar aviso e `check()` retorna `[]`
    - `check()`: para cada contrato cujo `regulationId` corresponda a um dos `requirements`, avaliar cada `rule.principle` contra o código e gerar um `ComplianceStamp`
    - Calcular `score = cláusulas_satisfeitas / total_cláusulas`; não modificar nenhum arquivo em `./contracts/`
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_
  - [x]* 8.2 Escrever teste de propriedade P12: check() produz um ComplianceStamp por contrato avaliado
    - **Propriedade 12: check() produz exatamente um ComplianceStamp por contrato cujo regulationId corresponda aos requirements**
    - **Valida: Requisito 4.4**
  - [x]* 8.3 Escrever teste de propriedade P13: score é proporção de cláusulas satisfeitas
    - **Propriedade 13: score = K / N onde K é o número de cláusulas satisfeitas e N o total**
    - **Valida: Requisito 4.7**
  - [x]* 8.4 Escrever teste de propriedade P14: round-trip do parser YAML de contratos
    - **Propriedade 14: parsear → serializar → parsear novamente produz o mesmo conjunto de regras**
    - **Valida: Requisito 4.8**
  - [x]* 8.5 Escrever teste de propriedade P21: check() é idempotente
    - **Propriedade 21: chamar check(code, requirements) múltiplas vezes produz o mesmo resultado**
    - **Valida: Requisito 8.8**

- [x] 9. Checkpoint — ComplianceCheckerAdapter
  - Garantir que todos os testes do `ComplianceCheckerAdapter` passam. Perguntar ao usuário se há dúvidas antes de continuar.

- [x] 10. Implementar GovernanceEngine
  - [x] 10.1 Criar `src/governance/GovernanceEngine.ts`
    - Implementar `IGovernanceEngine` com os métodos `govern()` e `recallSimilar()`
    - Receber `IHybridMemory`, `IComplianceChecker`, `IAuditLogger` e instância do `ValidationEngine` via construtor (injeção de dependência)
    - Implementar as três estratégias: `fast` (só fingerprint + memória), `thorough` (completo), `compliance-first` (compliance antes, interrompe se score médio < 0.5)
    - Usar `thorough` como estratégia padrão quando `context.strategy` não for especificado
    - Calcular `riskLevel`: `critical` se ValidationResult tem issue com `severity: "error"`, `high` se tem warnings e compliance < 0.7, `medium` se tem warnings, `low` caso contrário
    - Calcular `estimatedRemediationCost = Math.round(issues.length * 0.5 * 10) / 10`
    - Gerar `passportId` com UUID v4; garantir unicidade dentro da sessão
    - Validar `ComplianceStamp.score` em [0,1] e `CodeFingerprint.complexity >= 0`; lançar `GovernanceValidationError` se inválido
    - Sempre registrar no `AuditLogger` após `govern()`, inclusive em caso de erro controlado
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 1.5, 1.6, 1.7_
  - [x]* 10.2 Escrever teste de propriedade P1: estrutura completa das entidades
    - **Propriedade 1: GovernancePassport gerado contém todos os campos obrigatórios com tipos corretos**
    - **Valida: Requisitos 1.1, 1.2, 1.3, 1.4**
    - Usar mocks de `IHybridMemory`, `IComplianceChecker` e `IAuditLogger` via injeção de dependência
  - [x]* 10.3 Escrever teste de propriedade P2: rejeição de campos inválidos
    - **Propriedade 2: GovernanceEngine rejeita ComplianceStamp com score fora de [0,1] e CodeFingerprint com complexity < 0**
    - **Valida: Requisitos 1.5, 1.6**
  - [x]* 10.4 Escrever teste de propriedade P3: unicidade de passportId
    - **Propriedade 3: N chamadas a govern() na mesma instância produzem N passportIds distintos**
    - **Valida: Requisito 1.7**
  - [x]* 10.5 Escrever teste de propriedade P4: mapeamento de riskLevel baseado em severidade
    - **Propriedade 4: riskLevel é "critical" se ValidationResult tem erro, "low" se tem apenas warnings**
    - **Valida: Requisitos 2.6, 2.7**
  - [x]* 10.6 Escrever teste de propriedade P5: govern() sempre registra no AuditLogger
    - **Propriedade 5: após govern(), AuditLogger recebe exatamente uma chamada log() com o passportId correspondente**
    - **Valida: Requisito 2.8**
  - [x]* 10.7 Escrever teste de propriedade P6: compliance-first interrompe com score médio baixo
    - **Propriedade 6: estratégia compliance-first não chama ValidationEngine quando score médio < 0.5**
    - **Valida: Requisito 2.4**
  - [x]* 10.8 Escrever teste de propriedade P7: fórmula de estimatedRemediationCost
    - **Propriedade 7: estimatedRemediationCost = Math.round(N * 0.5 * 10) / 10 para N issues**
    - **Valida: Requisito 2.10**

- [x] 11. Checkpoint — GovernanceEngine
  - Garantir que todos os testes do `GovernanceEngine` passam. Perguntar ao usuário se há dúvidas antes de continuar.

- [x] 12. Criar factory e exportações públicas
  - [x] 12.1 Criar `src/governance/index.ts` com a factory `createGovernanceStack()`
    - Implementar `createGovernanceStack(options?: GovernanceStackOptions)` retornando `{ engine, memory, compliance, audit }`
    - Inicializar adaptadores na ordem: `AuditLoggerAdapter` → `HybridMemoryAdapter` → `ComplianceCheckerAdapter` → `GovernanceEngine`
    - Usar valores padrão: `sqlitePath: './governance.db'`, `contractsDir: './contracts'`, `auditLogsDir: './audit-logs'`, `enableChroma: false`
    - Se `enableChroma: true`, tentar inicializar Chroma; em caso de falha, logar aviso e continuar com SQLite
    - Se qualquer adaptador falhar, lançar `GovernanceInitError` indicando qual componente falhou
    - Exportar apenas: `createGovernanceStack`, interfaces públicas (`IGovernanceEngine`, `IHybridMemory`, `IComplianceChecker`, `IAuditLogger`) e tipos de entidade — sem reexportar internals
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.4_

- [x] 13. Escrever testes de integração
  - [x] 13.1 Criar `tests/governance/integration.test.ts` com testes de integração via `createGovernanceStack()`
    - Usar SQLite em memória (`:memory:`) e diretório temporário para audit-logs
    - Testar fluxo completo: `govern()` com cada estratégia, verificar `GovernancePassport` resultante
    - Testar que `ValidationEngine` existente é composto sem modificação
    - Testar que remoção hipotética de `src/governance/` não afeta o `ValidationEngine`
    - _Requisitos: 7.1, 7.2, 7.3, 7.5_
  - [x]* 13.2 Escrever teste de propriedade P22: createGovernanceStack() é idempotente
    - **Propriedade 22: múltiplas chamadas a createGovernanceStack() com os mesmos parâmetros retornam pilhas funcionalmente equivalentes sem estado compartilhado**
    - **Valida: Requisito 6.7**

- [x] 14. Checkpoint final — Garantir que todos os testes passam
  - Executar `vitest --run tests/governance/` e confirmar que todos os testes passam
  - Verificar que nenhum arquivo fora de `src/governance/` foi modificado
  - Perguntar ao usuário se há ajustes antes de concluir.
