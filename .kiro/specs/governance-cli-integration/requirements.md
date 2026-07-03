# Documento de Requisitos

## Introdução

Esta feature integra o `GovernanceEngine` ao CLI do EscapeKit, expõe o `FederatedMemoryAdapter` na factory `createGovernanceStack()`, adiciona um endpoint de estatísticas ao servidor federado, expande os valores aceitos em `GovernanceContext.origin` e conecta o comando `validate` existente ao fluxo de governança.

O objetivo é tornar o sistema de governança (CodeMemória) acessível diretamente pela linha de comando, permitindo que desenvolvedores inspecionem, exportem e auditem `GovernancePassport`s sem precisar escrever código.

## Glossário

- **CLI**: Interface de linha de comando do EscapeKit (`escapekit`).
- **GovernanceEngine**: Orquestrador principal que produz um `GovernancePassport` a partir de um `GovernanceContext`.
- **GovernancePassport**: Documento imutável gerado por cada execução de governança, contendo `passportId`, `codeFingerprint`, `complianceStamps`, `auditTrail`, `riskLevel` e `memoryEnriched`.
- **GovernanceContext**: Estrutura de entrada do `GovernanceEngine`, incluindo `code`, `origin`, `projectId`, `requirements`, `strategy` e `actor`.
- **GovernanceStrategy**: Modo de execução do `GovernanceEngine` — `fast`, `thorough` ou `compliance-first`.
- **HybridMemoryAdapter**: Adaptador de memória local que combina SQLite e Chroma.
- **FederatedMemoryAdapter**: Adaptador de memória que sincroniza padrões com um servidor central via HTTP, aplicando privacidade diferencial.
- **FederatedMemoryServer**: Servidor Python/FastAPI que agrega padrões federados.
- **FederatedMemoryOptions**: Opções de inicialização do `FederatedMemoryAdapter`, incluindo `serverUrl`, `epsilon`, `noiseType` e `sector`.
- **GovernanceStackOptions**: Opções de inicialização da factory `createGovernanceStack()`.
- **createGovernanceStack**: Factory que inicializa toda a pilha de governança.
- **ComplianceStamp**: Selo de conformidade emitido após verificação de um contrato YAML, com `score` em [0, 1].
- **AuditTrail**: Entrada imutável na cadeia de auditoria com `chainHash`, `parentHash`, `timestamp`, `action` e `actor`.
- **RiskLevel**: Nível de risco do código analisado — `low`, `medium`, `high` ou `critical`.
- **Contrato YAML**: Arquivo YAML que define cláusulas de conformidade verificáveis pelo `ComplianceCheckerAdapter`.
- **Privacidade Diferencial**: Técnica que adiciona ruído calibrado (Laplace ou Gaussiano) aos embeddings antes de enviá-los ao servidor federado.
- **Endpoint /stats**: Rota `GET /stats` do `FederatedMemoryServer` que retorna estatísticas agregadas sem expor dados individuais.
- **Origin**: Campo `GovernanceContext.origin` que identifica a ferramenta de IA que gerou o código.

---

## Requisitos

### Requisito 1: Comando CLI `govern`

**User Story:** Como desenvolvedor, quero executar `escapekit govern <arquivo>` para analisar um arquivo de código com o `GovernanceEngine` e visualizar o `GovernancePassport` resultante diretamente no terminal, sem precisar escrever código TypeScript.

#### Critérios de Aceitação

1. WHEN o usuário executa `escapekit govern <arquivo>`, THE CLI SHALL ler o conteúdo do arquivo especificado e passá-lo ao `GovernanceEngine.govern()`.
2. WHEN o arquivo especificado não existe, THE CLI SHALL exibir a mensagem `"Erro: arquivo não encontrado: <caminho>"` e encerrar com código de saída 1.
3. WHEN nenhum arquivo é especificado e há dados disponíveis em stdin, THE CLI SHALL ler o código a partir de stdin.
4. WHEN o `GovernanceEngine.govern()` retorna um `GovernancePassport`, THE CLI SHALL exibir no terminal: `passportId`, `riskLevel`, `memoryEnriched`, quantidade de `complianceStamps`, quantidade de entradas em `auditTrail` e `estimatedRemediationCost`.
5. WHEN o usuário passa a flag `--output json`, THE CLI SHALL serializar o `GovernancePassport` completo como JSON e imprimir em stdout.
6. WHEN o usuário passa a flag `--strategy <valor>`, THE CLI SHALL definir `GovernanceContext.strategy` com o valor fornecido; os valores aceitos são `fast`, `thorough` e `compliance-first`.
7. IF o usuário passa `--strategy` com um valor não reconhecido, THEN THE CLI SHALL exibir a mensagem `"Estratégia inválida: <valor>. Use: fast | thorough | compliance-first"` e encerrar com código de saída 1.
8. WHEN o usuário passa a flag `--requirements <ids>`, THE CLI SHALL interpretar `<ids>` como uma lista separada por vírgulas e definir `GovernanceContext.requirements` com esses valores.
9. WHEN o usuário passa a flag `--federated`, THE CLI SHALL inicializar a pilha de governança com `FederatedMemoryAdapter` em vez de `HybridMemoryAdapter`.
10. WHEN o usuário passa `--federated` sem `--server-url`, THE CLI SHALL usar `http://localhost:8000` como URL padrão do servidor federado.
11. WHEN o usuário passa a flag `--server-url <url>`, THE CLI SHALL usar a URL fornecida para configurar o `FederatedMemoryAdapter`.
12. IF o `GovernanceEngine.govern()` lançar uma exceção, THEN THE CLI SHALL exibir a mensagem de erro e encerrar com código de saída 1.
13. THE CLI SHALL aceitar `--project-id <id>` para definir `GovernanceContext.projectId`; se omitido, SHALL usar o nome do diretório atual como valor padrão.
14. THE CLI SHALL aceitar `--actor <nome>` para definir `GovernanceContext.actor`; se omitido, SHALL usar `"cli"` como valor padrão.
15. THE CLI SHALL aceitar `--origin <valor>` para definir `GovernanceContext.origin`; se omitido, SHALL usar `"unknown"` como valor padrão.

---

### Requisito 2: Integração do FederatedMemoryAdapter na factory `createGovernanceStack()`

**User Story:** Como desenvolvedor, quero passar opções de federação para `createGovernanceStack()` e receber automaticamente uma pilha de governança que usa `FederatedMemoryAdapter`, sem precisar instanciar o adaptador manualmente.

#### Critérios de Aceitação

1. WHEN `GovernanceStackOptions` contém o campo `federatedServer` com `url` definida, THE `createGovernanceStack` SHALL instanciar `FederatedMemoryAdapter` com as opções fornecidas em vez de `HybridMemoryAdapter`.
2. WHEN `GovernanceStackOptions` não contém o campo `federatedServer`, THE `createGovernanceStack` SHALL manter o comportamento atual e instanciar `HybridMemoryAdapter`.
3. THE `GovernanceStackOptions` SHALL aceitar um campo opcional `federatedServer` do tipo `FederatedMemoryOptions` (exceto `sqlitePath`, que é herdado de `GovernanceStackOptions`).
4. WHEN `federatedServer.url` está definida mas o servidor não está acessível durante a inicialização, THE `createGovernanceStack` SHALL lançar `GovernanceInitError` com mensagem descritiva.
5. THE módulo `src/governance/index.ts` SHALL exportar `FederatedMemoryAdapter`, `FederatedMemoryOptions` e `FederatedPattern` para consumidores externos.
6. THE `GovernanceStack` retornado por `createGovernanceStack` SHALL expor o adaptador de memória instanciado no campo `memory`, independentemente de ser `HybridMemoryAdapter` ou `FederatedMemoryAdapter`.

---

### Requisito 3: Endpoint `GET /stats` no FederatedMemoryServer

**User Story:** Como operador do servidor federado, quero consultar estatísticas agregadas dos padrões armazenados via `GET /stats`, para monitorar a saúde e a distribuição do conhecimento federado sem expor dados individuais.

#### Critérios de Aceitação

1. WHEN uma requisição `GET /stats` é recebida, THE `FederatedMemoryServer` SHALL retornar um objeto JSON com os campos: `total_patterns` (inteiro >= 0), `patterns_by_rule_type` (objeto com contagens por tipo de regra), `avg_success_rate` (número em [0, 1]) e `top_sectors` (lista de até 5 setores com maior número de padrões).
2. WHEN não há padrões armazenados, THE `FederatedMemoryServer` SHALL retornar `{"total_patterns": 0, "patterns_by_rule_type": {}, "avg_success_rate": 0.0, "top_sectors": []}`.
3. THE `FederatedMemoryServer` SHALL calcular `avg_success_rate` como a média aritmética de `success_count` de todos os padrões armazenados, normalizada para o intervalo [0, 1].
4. THE `FederatedMemoryServer` SHALL calcular `top_sectors` ordenando os setores por contagem de padrões em ordem decrescente e retornando no máximo 5 entradas.
5. THE `GET /stats` SHALL retornar apenas dados agregados; THE `FederatedMemoryServer` SHALL omitir `pattern_id`, `embedding` e qualquer identificador individual da resposta.
6. IF ocorrer um erro interno ao calcular as estatísticas, THEN THE `FederatedMemoryServer` SHALL retornar HTTP 500 com `{"detail": "<mensagem de erro>"}`.
7. THE `GET /stats` SHALL responder em menos de 500ms para bases com até 10.000 padrões armazenados.

---

### Requisito 4: Expansão de `GovernanceContext.origin`

**User Story:** Como desenvolvedor, quero que `GovernanceContext.origin` aceite ferramentas de IA modernas como `gemini`, `gpt`, `mistral`, `v0`, `lovable` e `antigravity`, para que o sistema de governança registre corretamente a origem do código gerado por essas ferramentas.

#### Critérios de Aceitação

1. THE tipo `GovernanceContext.origin` SHALL aceitar os valores: `'copilot' | 'claude' | 'bolt' | 'cursor' | 'unknown' | 'antigravity' | 'gemini' | 'gpt' | 'mistral' | 'v0' | 'lovable'`.
2. THE expansão de `GovernanceContext.origin` SHALL manter retrocompatibilidade com todos os valores existentes: `'copilot'`, `'claude'`, `'bolt'`, `'cursor'` e `'unknown'`.
3. WHEN um `GovernancePassport` é gerado com qualquer um dos novos valores de `origin`, THE `GovernanceEngine` SHALL registrar o valor correto no `AuditTrail` sem lançar exceção.
4. THE CLI SHALL aceitar todos os valores expandidos de `origin` via flag `--origin <valor>`.
5. IF o usuário passa `--origin` com um valor não reconhecido, THEN THE CLI SHALL exibir a mensagem `"Origin inválida: <valor>. Valores aceitos: copilot | claude | bolt | cursor | unknown | antigravity | gemini | gpt | mistral | v0 | lovable"` e encerrar com código de saída 1.

---

### Requisito 5: Integração `validate` → `govern`

**User Story:** Como desenvolvedor, quero executar `escapekit validate <projeto> --govern` para que, após a validação, o `GovernanceEngine` seja executado automaticamente sobre o código validado e o `GovernancePassport` seja exibido no terminal.

#### Critérios de Aceitação

1. WHEN o usuário executa `escapekit validate <projeto> --govern`, THE CLI SHALL executar o fluxo de validação existente e, em seguida, executar `GovernanceEngine.govern()` sobre o código do projeto.
2. WHEN a flag `--govern` não é fornecida, THE CLI SHALL executar apenas o fluxo de validação existente, sem alteração de comportamento.
3. WHEN `--govern` é fornecido e a validação é concluída com sucesso, THE CLI SHALL exibir o `GovernancePassport` no mesmo formato definido no Requisito 1, critério 4.
4. WHEN `--govern` é fornecido junto com `--output json`, THE CLI SHALL incluir o `GovernancePassport` no objeto JSON de saída sob a chave `"governancePassport"`.
5. WHEN `--govern` é fornecido e o projeto contém múltiplos arquivos, THE CLI SHALL concatenar o conteúdo dos arquivos `.ts`, `.js`, `.tsx` e `.jsx` encontrados no diretório raiz do projeto para compor o `GovernanceContext.code`.
6. IF `GovernanceEngine.govern()` lançar uma exceção durante o fluxo `validate --govern`, THEN THE CLI SHALL exibir o erro de governança como aviso e encerrar com o código de saída determinado pelo resultado da validação (não pelo erro de governança).
7. WHEN `--govern` é fornecido junto com `--strategy <valor>`, THE CLI SHALL repassar a estratégia ao `GovernanceEngine` conforme definido no Requisito 1, critério 6.
8. WHEN `--govern` é fornecido junto com `--requirements <ids>`, THE CLI SHALL repassar os IDs de contratos ao `GovernanceEngine` conforme definido no Requisito 1, critério 8.
