# Documento de Requisitos

## Introdução

O EscapeKit já possui um `ValidationEngine` funcional (validação de código, dependências, WebGL, segurança) e um pipeline `qwen-escapekit` que transforma papers acadêmicos em contratos YAML executáveis (Paper-to-Contract). O nicho original de "escape de sandbox" está em extinção; os ativos reais do projeto são a rastreabilidade acadêmica, a plataforma de validação e a soberania tecnológica.

Esta feature implementa a camada **CodeMemória Governance** — um pivot estratégico que reposiciona o EscapeKit como plataforma de **governança de código gerado por IA**: validar, proteger e auditar código com rastreabilidade acadêmica e compliance soberano.

A nova camada é adicionada **sem modificar nenhum arquivo existente**. Ela compõe (encapsula) os componentes atuais e estende suas funcionalidades a partir de `src/governance/`.

Os componentes centrais são:
- `GovernanceEngine` — orquestrador principal
- `HybridMemoryAdapter` — memória SQLite + Chroma (Chroma opcional)
- `ComplianceCheckerAdapter` — carrega contratos YAML do `qwen-escapekit`
- `AuditLoggerAdapter` — cadeia de hashes imutável em JSON
- `createGovernanceStack()` — factory de inicialização

## Glossário

- **EscapeKit**: Ferramenta existente de validação e correção automática de código gerado por IA.
- **ValidationEngine**: Componente existente do EscapeKit que orquestra detectores e fixers.
- **GovernanceEngine**: Novo orquestrador da camada de governança que compõe o `ValidationEngine` com memória, compliance e auditoria.
- **GovernancePassport**: Documento imutável gerado para cada execução de governança, contendo fingerprint, validações, selos de compliance, trilha de auditoria, nível de risco e custo estimado de remediação.
- **CodeFingerprint**: Estrutura que identifica unicamente um trecho de código por hash SHA-256, assinatura AST, dependências e complexidade ciclomática.
- **ComplianceStamp**: Selo de conformidade emitido após verificação de um contrato YAML, contendo regulationId, cláusulas verificadas, score e metadados de verificação.
- **AuditTrail**: Entrada imutável na cadeia de auditoria, contendo hash da cadeia, hash do pai, timestamp, ação, ator, hash da entrada e hash do resultado.
- **HybridMemory**: Camada de memória que combina SQLite (persistência estruturada) com Chroma (busca vetorial semântica opcional).
- **ComplianceChecker**: Componente que carrega contratos YAML gerados pelo `qwen-escapekit` e verifica conformidade do código.
- **AuditLogger**: Componente que mantém uma cadeia de hashes imutável para rastreabilidade de todas as ações de governança.
- **GovernanceContext**: Estrutura de entrada do `GovernanceEngine` contendo código-fonte, origem (copilot/claude/bolt/cursor/unknown), projectId, requisitos de compliance, estratégia e ator.
- **Contrato_YAML**: Arquivo YAML em `./contracts/` gerado pelo `qwen-escapekit`, representando regras de compliance derivadas de papers acadêmicos.
- **RiskLevel**: Classificação de risco do código analisado: `low`, `medium`, `high` ou `critical`.
- **Estratégia**: Modo de execução do `GovernanceEngine`: `fast` (só fingerprint + memória), `thorough` (validação completa) ou `compliance-first` (compliance antes de validação).
- **Ator**: Identificador do agente que solicitou a governança (usuário, sistema CI, integração externa).
- **ChainHash**: Hash SHA-256 que encadeia entradas consecutivas do `AuditLogger`, garantindo imutabilidade.
- **SQLite**: Banco de dados relacional embutido usado pelo `HybridMemoryAdapter` para persistência estruturada (dependência `better-sqlite3`).
- **Chroma**: Banco de dados vetorial opcional usado pelo `HybridMemoryAdapter` para busca semântica por similaridade.

---

## Requisitos

### Requisito 1: Entidades Centrais da Camada de Governança

**User Story:** Como desenvolvedor que integra o EscapeKit, quero que a camada de governança defina entidades bem tipadas para fingerprint, compliance, auditoria e passaporte, para que eu possa rastrear e auditar código gerado por IA de forma estruturada.

#### Critérios de Aceitação

1. THE `CodeFingerprint` SHALL conter os campos: `hash` (string SHA-256 do código-fonte), `astSignature` (string derivada da estrutura AST), `dependencies` (string[]) e `complexity` (número inteiro não negativo representando complexidade ciclomática).
2. THE `ComplianceStamp` SHALL conter os campos: `regulationId` (string), `clauses` (string[]), `score` (número entre 0 e 1 inclusive), `verifiedAt` (Date) e `verifiedBy` (string identificando o componente verificador).
3. THE `AuditTrail` SHALL conter os campos: `chainHash` (string SHA-256), `parentHash` (string SHA-256 ou `null` para a primeira entrada), `timestamp` (Date), `action` (string), `actor` (string), `inputHash` (string SHA-256) e `resultHash` (string SHA-256).
4. THE `GovernancePassport` SHALL conter os campos: `passportId` (string UUID v4), `codeFingerprint` (CodeFingerprint), `validations` (array de resultados do ValidationEngine), `complianceStamps` (ComplianceStamp[]), `auditTrail` (AuditTrail[]), `memoryEnriched` (boolean), `riskLevel` (RiskLevel) e `estimatedRemediationCost` (número não negativo em horas).
5. IF o campo `score` de um `ComplianceStamp` for menor que 0 ou maior que 1, THEN THE `GovernanceEngine` SHALL rejeitar o stamp com erro de validação.
6. IF o campo `complexity` de um `CodeFingerprint` for negativo, THEN THE `GovernanceEngine` SHALL rejeitar o fingerprint com erro de validação.
7. FOR ALL `GovernancePassport`s gerados, THE `GovernanceEngine` SHALL garantir que `passportId` é único e nunca reutilizado dentro da mesma sessão.

---

### Requisito 2: GovernanceEngine — Orquestrador Principal

**User Story:** Como desenvolvedor, quero um orquestrador que coordene validação, memória, compliance e auditoria em uma única chamada, para que eu possa governar código gerado por IA sem precisar integrar cada componente manualmente.

#### Critérios de Aceitação

1. THE `GovernanceEngine` SHALL implementar a interface `IGovernanceEngine` com os métodos `govern(context: GovernanceContext): Promise<GovernancePassport>` e `recallSimilar(fingerprint: CodeFingerprint): Promise<GovernancePassport[]>`.
2. WHEN o método `govern()` é chamado com estratégia `fast`, THE `GovernanceEngine` SHALL executar apenas fingerprinting e consulta à memória, omitindo validação completa e verificação de compliance.
3. WHEN o método `govern()` é chamado com estratégia `thorough`, THE `GovernanceEngine` SHALL executar fingerprinting, consulta à memória, validação completa via `ValidationEngine` e verificação de compliance.
4. WHEN o método `govern()` é chamado com estratégia `compliance-first`, THE `GovernanceEngine` SHALL executar compliance antes da validação e interromper a execução se o score médio de compliance for inferior a 0.5.
5. THE `GovernanceEngine` SHALL compor o `ValidationEngine` existente sem modificar nenhum arquivo do EscapeKit original.
6. WHEN o `ValidationEngine` retornar erros críticos, THE `GovernanceEngine` SHALL atribuir `riskLevel: "critical"` ao `GovernancePassport` resultante.
7. WHEN o `ValidationEngine` retornar apenas avisos sem erros, THE `GovernanceEngine` SHALL atribuir `riskLevel: "low"` ao `GovernancePassport` resultante.
8. THE `GovernanceEngine` SHALL registrar uma entrada no `AuditLogger` para cada chamada de `govern()`, independentemente do resultado.
9. IF o `GovernanceContext` não especificar `strategy`, THEN THE `GovernanceEngine` SHALL usar `thorough` como estratégia padrão.
10. THE `GovernanceEngine` SHALL calcular `estimatedRemediationCost` com base no número de issues retornadas pelo `ValidationEngine`, usando a fórmula: `issues.length * 0.5` horas, arredondado para uma casa decimal.

---

### Requisito 3: HybridMemoryAdapter — Memória Persistente com Fallback

**User Story:** Como desenvolvedor, quero que a camada de governança memorize passaportes anteriores e recupere casos similares por fingerprint, para que o sistema aprenda com execuções passadas e evite reprocessamento desnecessário.

#### Critérios de Aceitação

1. THE `HybridMemoryAdapter` SHALL implementar a interface `IHybridMemory` com os métodos `save(passport: GovernancePassport): Promise<void>`, `recall(fingerprint: CodeFingerprint, threshold: number): Promise<GovernancePassport[]>` e `getSuccessRate(fingerprint: CodeFingerprint): Promise<number>`.
2. THE `HybridMemoryAdapter` SHALL usar `better-sqlite3` como backend primário de persistência, armazenando passaportes serializados em JSON em uma tabela `governance_passports`.
3. WHERE o `chromadb` estiver disponível no ambiente, THE `HybridMemoryAdapter` SHALL usar Chroma para busca semântica por similaridade de fingerprint, complementando a busca exata do SQLite.
4. IF o `chromadb` não estiver disponível ou falhar na inicialização, THEN THE `HybridMemoryAdapter` SHALL operar exclusivamente com SQLite, sem lançar exceção e sem degradar a funcionalidade principal.
5. WHEN o método `recall()` é chamado com um `threshold` entre 0 e 1, THE `HybridMemoryAdapter` SHALL retornar apenas passaportes com similaridade de fingerprint igual ou superior ao threshold.
6. THE `HybridMemoryAdapter` SHALL calcular similaridade de fingerprint comparando `hash` (correspondência exata vale 1.0), `dependencies` (coeficiente de Jaccard) e `complexity` (diferença normalizada), com pesos iguais de 1/3 cada.
7. WHEN o método `getSuccessRate()` é chamado, THE `HybridMemoryAdapter` SHALL retornar a proporção de passaportes com `riskLevel: "low"` sobre o total de passaportes com o mesmo `hash` de fingerprint.
8. IF não houver passaportes anteriores para um dado fingerprint, THEN THE `HybridMemoryAdapter` SHALL retornar `0.0` para `getSuccessRate()` e um array vazio para `recall()`.
9. THE `HybridMemoryAdapter` SHALL criar a tabela SQLite automaticamente na primeira inicialização, sem exigir migração manual.
10. FOR ALL passaportes salvos e recuperados, THE `HybridMemoryAdapter` SHALL garantir que a serialização e desserialização JSON preserva todos os campos do `GovernancePassport` (propriedade round-trip).

---

### Requisito 4: ComplianceCheckerAdapter — Verificação via Contratos YAML

**User Story:** Como desenvolvedor, quero que a camada de governança verifique o código contra contratos YAML gerados pelo qwen-escapekit, para que eu possa garantir conformidade com regulações derivadas de papers acadêmicos.

#### Critérios de Aceitação

1. THE `ComplianceCheckerAdapter` SHALL implementar a interface `IComplianceChecker` com os métodos `check(code: string, requirements: string[]): Promise<ComplianceStamp[]>` e `loadContract(contractPath: string): Promise<void>`.
2. THE `ComplianceCheckerAdapter` SHALL carregar contratos YAML do diretório `./contracts/` na inicialização, usando o mesmo formato de contrato gerado pelo `qwen-escapekit`.
3. WHEN o método `loadContract()` é chamado com um caminho válido, THE `ComplianceCheckerAdapter` SHALL parsear o YAML e registrar as regras do contrato em memória para uso nas verificações subsequentes.
4. WHEN o método `check()` é chamado, THE `ComplianceCheckerAdapter` SHALL avaliar o código contra cada regra dos contratos carregados que corresponda aos `requirements` fornecidos, gerando um `ComplianceStamp` por contrato avaliado.
5. IF um arquivo YAML em `./contracts/` contiver sintaxe inválida, THEN THE `ComplianceCheckerAdapter` SHALL registrar um aviso no log e ignorar aquele contrato, sem interromper a inicialização.
6. IF o diretório `./contracts/` não existir ou estiver vazio, THEN THE `ComplianceCheckerAdapter` SHALL retornar um array vazio em `check()` e registrar um aviso no log.
7. THE `ComplianceCheckerAdapter` SHALL calcular o `score` de cada `ComplianceStamp` como a proporção de cláusulas satisfeitas sobre o total de cláusulas do contrato avaliado.
8. FOR ALL contratos carregados e verificados, THE `ComplianceCheckerAdapter` SHALL garantir que parsear um contrato, serializar e parsear novamente produz o mesmo conjunto de regras (propriedade round-trip do parser YAML).
9. THE `ComplianceCheckerAdapter` SHALL não modificar nenhum arquivo do diretório `./contracts/` durante a verificação.

---

### Requisito 5: AuditLoggerAdapter — Cadeia de Hashes Imutável

**User Story:** Como desenvolvedor ou auditor, quero que todas as ações de governança sejam registradas em uma cadeia de hashes imutável, para que eu possa verificar a integridade do histórico de auditoria e detectar adulterações.

#### Critérios de Aceitação

1. THE `AuditLoggerAdapter` SHALL implementar a interface `IAuditLogger` com os métodos `log(event: AuditEvent): Promise<AuditTrail>`, `getChain(passportId: string): Promise<AuditTrail[]>` e `verifyIntegrity(passportId: string): Promise<boolean>`.
2. THE `AuditLoggerAdapter` SHALL persistir cada entrada de auditoria em um arquivo JSON individual, com nome no formato `{timestamp_iso8601}_{chainHash_primeiros8chars}.json`, no diretório `./audit-logs/`.
3. THE `AuditLoggerAdapter` SHALL calcular o `chainHash` de cada entrada como SHA-256 de `(parentHash + timestamp.toISOString() + action + actor + inputHash + resultHash)`.
4. WHEN o método `log()` é chamado pela primeira vez para um `passportId`, THE `AuditLoggerAdapter` SHALL criar a primeira entrada com `parentHash: null`.
5. WHEN o método `log()` é chamado para um `passportId` com entradas anteriores, THE `AuditLoggerAdapter` SHALL usar o `chainHash` da última entrada como `parentHash` da nova entrada.
6. WHEN o método `verifyIntegrity()` é chamado, THE `AuditLoggerAdapter` SHALL recalcular o `chainHash` de cada entrada da cadeia e retornar `true` somente se todos os hashes corresponderem e a sequência de `parentHash` estiver íntegra.
7. IF qualquer entrada da cadeia tiver sido adulterada (hash recalculado diferente do armazenado), THEN THE `AuditLoggerAdapter` SHALL retornar `false` em `verifyIntegrity()` sem lançar exceção.
8. THE `AuditLoggerAdapter` SHALL criar o diretório `./audit-logs/` automaticamente se não existir.
9. FOR ALL cadeias de auditoria com N entradas, THE `AuditLoggerAdapter` SHALL garantir que `getChain()` retorna exatamente N entradas ordenadas cronologicamente por `timestamp`.
10. THE `AuditLoggerAdapter` SHALL garantir que dois eventos com os mesmos dados de entrada produzem `chainHash`s diferentes se tiverem `timestamp`s diferentes (sensibilidade temporal).

---

### Requisito 6: Factory createGovernanceStack — Inicialização Simplificada

**User Story:** Como desenvolvedor, quero uma factory que inicialize toda a pilha de governança com uma única chamada, para que eu possa integrar a camada de governança sem precisar instanciar e conectar cada componente manualmente.

#### Critérios de Aceitação

1. THE `createGovernanceStack()` SHALL ser uma função exportada de `src/governance/index.ts` que retorna um objeto contendo `{ engine: IGovernanceEngine, memory: IHybridMemory, compliance: IComplianceChecker, audit: IAuditLogger }`.
2. THE `createGovernanceStack()` SHALL aceitar um parâmetro opcional `GovernanceStackOptions` com os campos: `sqlitePath` (string, padrão `./governance.db`), `contractsDir` (string, padrão `./contracts`), `auditLogsDir` (string, padrão `./audit-logs`) e `enableChroma` (boolean, padrão `false`).
3. WHEN `createGovernanceStack()` é chamada sem parâmetros, THE factory SHALL usar todos os valores padrão e inicializar a pilha completa com SQLite, sem Chroma.
4. WHEN `createGovernanceStack()` é chamada com `enableChroma: true`, THE factory SHALL tentar inicializar o `HybridMemoryAdapter` com Chroma e, se falhar, SHALL continuar com SQLite apenas, registrando um aviso no log.
5. THE `createGovernanceStack()` SHALL inicializar os adaptadores na seguinte ordem: `AuditLoggerAdapter` → `HybridMemoryAdapter` → `ComplianceCheckerAdapter` → `GovernanceEngine`.
6. IF qualquer adaptador falhar na inicialização, THEN THE `createGovernanceStack()` SHALL lançar um erro descritivo indicando qual componente falhou e o motivo.
7. THE `createGovernanceStack()` SHALL ser idempotente: chamadas múltiplas com os mesmos parâmetros SHALL retornar pilhas funcionalmente equivalentes (sem estado compartilhado entre instâncias).

---

### Requisito 7: Integração Não-Invasiva com o EscapeKit Existente

**User Story:** Como mantenedor do EscapeKit, quero que a camada de governança seja adicionada sem modificar nenhum arquivo existente, para que o risco de regressão seja zero e a nova camada possa ser removida ou substituída de forma independente.

#### Critérios de Aceitação

1. THE `GovernanceEngine` SHALL compor o `ValidationEngine` existente importando-o como dependência, sem estender sua classe ou modificar seus arquivos.
2. THE camada de governança SHALL residir integralmente em `src/governance/`, sem criar ou modificar arquivos fora desse diretório (exceto `./contracts/`, `./audit-logs/` e `./governance.db` em runtime).
3. WHILE o `ValidationEngine` existente estiver operacional, THE `GovernanceEngine` SHALL delegar toda validação de código ao `ValidationEngine` sem reimplementar suas regras.
4. THE `src/governance/index.ts` SHALL exportar apenas `createGovernanceStack`, as interfaces públicas e os tipos de entidade, sem reexportar internals dos adaptadores.
5. IF a camada de governança for removida do projeto (exclusão de `src/governance/`), THEN o `ValidationEngine` e todos os componentes existentes do EscapeKit SHALL continuar funcionando sem alteração.
6. THE `ComplianceCheckerAdapter` SHALL usar o mesmo formato de contrato YAML gerado pelo `qwen-escapekit` existente, sem introduzir um novo formato de contrato.

---

### Requisito 8: Qualidade, Testabilidade e Propriedades de Corretude

**User Story:** Como mantenedor do EscapeKit, quero que todos os componentes da camada de governança sejam testáveis de forma isolada com Vitest e fast-check, para que eu possa garantir corretude das propriedades críticas do sistema.

#### Critérios de Aceitação

1. THE `GovernanceEngine` SHALL ser testável de forma isolada, recebendo mocks de `IHybridMemory`, `IComplianceChecker` e `IAuditLogger` via injeção de dependência no construtor.
2. THE `HybridMemoryAdapter` SHALL ser testável com um banco SQLite em memória (`:memory:`), sem dependência de sistema de arquivos.
3. THE `AuditLoggerAdapter` SHALL ser testável com um diretório temporário, sem dependência de caminhos absolutos.
4. FOR ALL `GovernancePassport`s gerados pelo `GovernanceEngine`, THE sistema SHALL garantir que serializar e desserializar o passaporte em JSON produz um objeto equivalente (propriedade round-trip).
5. FOR ALL cadeias de auditoria não adulteradas, THE `AuditLoggerAdapter` SHALL retornar `true` em `verifyIntegrity()` (invariante de integridade).
6. FOR ALL cadeias de auditoria com pelo menos uma entrada adulterada, THE `AuditLoggerAdapter` SHALL retornar `false` em `verifyIntegrity()` (detecção de adulteração).
7. THE `HybridMemoryAdapter` SHALL garantir que `save(passport)` seguido de `recall(passport.codeFingerprint, 1.0)` retorna um array contendo o passaporte salvo (propriedade round-trip de memória).
8. THE `ComplianceCheckerAdapter` SHALL garantir que `loadContract(path)` seguido de `check(code, requirements)` produz o mesmo resultado para o mesmo código e requisitos, independentemente da ordem de chamada (idempotência).
9. FOR ALL arrays arbitrários de `GovernancePassport`s gerados pelo fast-check, THE `HybridMemoryAdapter` SHALL garantir que `getSuccessRate()` retorna um valor entre 0 e 1 inclusive.
10. THE fast-check SHALL ser utilizado para verificar as propriedades 4, 5, 6, 7 e 9 acima com no mínimo 100 iterações cada.
11. THE `AuditLoggerAdapter` SHALL garantir que a ordem de inserção é preservada: para N eventos registrados em sequência, `getChain()` SHALL retornar os eventos na mesma ordem de inserção.
