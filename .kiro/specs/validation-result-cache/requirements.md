# Documento de Requisitos

## Introdução

Esta feature implementa três melhorias de desempenho e observabilidade no sistema CodeMemória Governance:

1. **Cache de ValidationResult no GovernanceEngine**: quando `recallExact` retorna um passaporte com validações persistidas, a chamada ao `validationEngine.validate()` é pulada na estratégia `thorough`, reutilizando o resultado cacheado e reduzindo custo computacional e de tokens.

2. **N-gramas de AST reais com Babel parser**: substituição do `astSignature` baseado em contagem de keywords por n-gramas de nós AST reais extraídos via `@babel/parser`, com cache em tabela SQLite dedicada para composição de resultados parciais quando não há hash exato.

3. **Flag `--no-cache` na CLI**: opção no comando `govern` para forçar revalidação completa, ignorando o cache de ValidationResult.

## Glossário

- **GovernanceEngine**: orquestrador principal que coordena ValidationEngine, HybridMemory, ComplianceChecker e AuditLogger para produzir um GovernancePassport.
- **ValidationEngine**: componente que executa validação estática do código e retorna um `ValidationResult`.
- **ValidationResult**: estrutura contendo `remainingIssues`, `duration` e metadados de uma execução de validação.
- **GovernancePassport**: documento imutável gerado por cada execução de governança; contém `validations: ValidationResult[]`.
- **HybridMemoryAdapter**: adaptador SQLite que persiste e recupera GovernancePassports.
- **FederatedMemoryAdapter**: adaptador que orquestra `recallExact` → similaridade vetorial → federado.
- **recallExact**: método que faz lookup O(1) por hash SHA-256 exato no SQLite e retorna `GovernancePassport[]`.
- **cacheSource**: campo adicionado ao `GovernancePassport` para rastrear a origem do resultado de validação: `'engram'` (hash exato), `'vector'` (similaridade vetorial) ou `'full'` (validação completa executada).
- **ASTNgramExtractor**: componente que usa `@babel/parser` para extrair sequências de n-gramas de nós AST reais de um trecho de código.
- **ASTNgramCache**: tabela SQLite `ast_ngram_cache` que armazena n-gramas e resultados parciais associados.
- **ValidationCacheMetrics**: conjunto de métricas de hit/miss do cache de ValidationResult expostas no endpoint `/stats`.
- **CLI**: interface de linha de comando `escapekit`, especificamente o comando `govern`.
- **Estratégia `thorough`**: modo de execução do GovernanceEngine que executa fingerprint + recall + validação + compliance.
- **Estratégia `fast`**: modo de execução que pula validação (comportamento existente, não alterado).

## Requisitos

### Requisito 1: Cache de ValidationResult na Estratégia Thorough

**User Story:** Como desenvolvedor usando o GovernanceEngine, quero que validações já persistidas em passaportes anteriores sejam reutilizadas, para que execuções repetidas do mesmo código não desperdicem tempo e tokens de LLM.

#### Critérios de Aceitação

1. WHEN `govern()` é chamado com `strategy: 'thorough'` e `recallExact` retorna ao menos um passaporte com `validations.length > 0`, THE GovernanceEngine SHALL reutilizar o `ValidationResult` do passaporte mais recente sem chamar `validationEngine.validate()`.

2. WHEN `govern()` é chamado com `strategy: 'thorough'` e `recallExact` retorna passaportes com `validations.length === 0` ou retorna array vazio, THE GovernanceEngine SHALL chamar `validationEngine.validate()` normalmente.

3. WHEN o cache de ValidationResult é utilizado, THE GovernanceEngine SHALL definir `cacheSource: 'engram'` no GovernancePassport resultante.

4. WHEN `validationEngine.validate()` é executado sem cache, THE GovernanceEngine SHALL definir `cacheSource: 'full'` no GovernancePassport resultante.

5. THE GovernanceEngine SHALL preservar o comportamento existente da estratégia `fast` sem alterações.

6. THE GovernanceEngine SHALL preservar o comportamento existente da estratégia `compliance-first` sem alterações.

7. WHEN o cache de ValidationResult é utilizado, THE GovernanceEngine SHALL incrementar o contador `validation_cache_hits` nas métricas internas.

8. WHEN `validationEngine.validate()` é executado, THE GovernanceEngine SHALL incrementar o contador `validation_cache_misses` nas métricas internas.

---

### Requisito 2: Campo `cacheSource` no GovernancePassport

**User Story:** Como operador do sistema, quero saber de onde veio o resultado de validação de cada passaporte, para que eu possa auditar a confiabilidade dos dados e diagnosticar problemas de cache.

#### Critérios de Aceitação

1. THE GovernancePassport SHALL conter o campo `cacheSource` do tipo `'engram' | 'vector' | 'full'`.

2. WHEN um passaporte é criado com resultado de cache por hash exato, THE GovernanceEngine SHALL atribuir `cacheSource: 'engram'`.

3. WHEN um passaporte é criado com resultado de cache por similaridade vetorial (Fase 2), THE GovernanceEngine SHALL atribuir `cacheSource: 'vector'`.

4. WHEN um passaporte é criado com validação completa executada, THE GovernanceEngine SHALL atribuir `cacheSource: 'full'`.

5. THE HybridMemoryAdapter SHALL serializar e desserializar o campo `cacheSource` corretamente ao persistir e recuperar passaportes do SQLite.

---

### Requisito 3: Métricas de Cache de Validação

**User Story:** Como operador do sistema, quero visualizar métricas de eficiência do cache de validação no endpoint `/stats`, para que eu possa monitorar o impacto da feature em produção.

#### Critérios de Aceitação

1. THE GovernanceEngine SHALL expor as métricas `validation_cache_hits`, `validation_cache_misses` e `avg_validation_time_ms` via método `getValidationCacheMetrics()`.

2. WHEN `getValidationCacheMetrics()` é chamado sem nenhuma execução prévia, THE GovernanceEngine SHALL retornar `{ validation_cache_hits: 0, validation_cache_misses: 0, avg_validation_time_ms: 0, tokens_saved_estimate: 0 }`.

3. THE GovernanceEngine SHALL calcular `avg_validation_time_ms` como a média aritmética dos tempos de execução de todas as chamadas a `validationEngine.validate()` realizadas na sessão atual.

4. THE GovernanceEngine SHALL calcular `tokens_saved_estimate` como `validation_cache_hits * avg_validation_time_ms * 0.1`, onde `0.1` é o fator de estimativa de tokens por milissegundo de validação.

5. WHEN o servidor federado Python expõe o endpoint `/stats`, THE FederatedMemoryAdapter SHALL incluir os campos `validation_cache_hits`, `validation_cache_misses` e `avg_validation_time_ms` no payload enviado a `/stats/client-metrics`.

---

### Requisito 4: Flag `--no-cache` no Comando `govern` da CLI

**User Story:** Como desenvolvedor usando a CLI, quero poder forçar uma revalidação completa sem usar o cache, para que eu possa obter resultados frescos quando suspeitar que o cache está desatualizado.

#### Critérios de Aceitação

1. THE CLI SHALL aceitar a opção `--no-cache` no comando `govern`.

2. WHEN `--no-cache` é fornecido, THE CLI SHALL forçar `strategy: 'thorough'` independentemente do valor passado em `--strategy`.

3. WHEN `--no-cache` é fornecido, THE GovernanceEngine SHALL ignorar qualquer resultado cacheado de ValidationResult e sempre chamar `validationEngine.validate()`.

4. WHEN `--no-cache` não é fornecido, THE CLI SHALL utilizar o cache de ValidationResult conforme o comportamento padrão (cache habilitado).

5. WHEN `--no-cache` é fornecido junto com `--strategy fast` ou `--strategy compliance-first`, THE CLI SHALL emitir um aviso informando que `--no-cache` força `strategy: 'thorough'` e prosseguir com essa estratégia.

---

### Requisito 5: N-gramas de AST Reais com Babel Parser

**User Story:** Como desenvolvedor, quero que o `astSignature` seja baseado em n-gramas de nós AST reais extraídos pelo `@babel/parser`, para que a similaridade estrutural entre trechos de código seja calculada com maior precisão do que a contagem de keywords atual.

#### Critérios de Aceitação

1. WHEN `computeFingerprint(code)` é chamado com código JavaScript ou TypeScript válido, THE ASTNgramExtractor SHALL extrair sequências de n-gramas de nós AST reais (ex: `FunctionDeclaration|BlockStatement|ReturnStatement`) usando `@babel/parser`.

2. WHEN `@babel/parser` falha ao parsear o código (ex: sintaxe inválida), THE ASTNgramExtractor SHALL retornar o `astSignature` baseado em keywords como fallback, sem lançar exceção.

3. THE ASTNgramExtractor SHALL gerar n-gramas de tamanho `n=3` por padrão, percorrendo os nós AST em ordem de visita depth-first.

4. THE ASTNgramExtractor SHALL serializar os n-gramas extraídos como string no formato `"NodeType1|NodeType2|NodeType3"` separados por vírgula para compor o `astSignature`.

5. WHEN o mesmo código é processado duas vezes, THE ASTNgramExtractor SHALL produzir o mesmo `astSignature` (propriedade de determinismo).

6. THE ASTNgramCache SHALL armazenar n-gramas e resultados parciais na tabela SQLite `ast_ngram_cache` com colunas `ngram_hash TEXT PRIMARY KEY, partial_result_json TEXT, confidence REAL`.

7. WHEN `recallExact` não encontra hash exato e n-gramas do código consultado coincidem com entradas em `ast_ngram_cache` com `confidence >= 0.8`, THE HybridMemoryAdapter SHALL retornar o resultado parcial associado como candidato de cache.

8. FOR ALL códigos válidos, parsear o código, extrair n-gramas, serializar e desserializar o `astSignature` SHALL produzir um objeto equivalente ao original (propriedade de round-trip).

---

### Requisito 6: Compatibilidade e Não-Regressão

**User Story:** Como mantenedor do sistema, quero que a feature de cache não quebre nenhum comportamento existente, para que a adoção seja segura em produção.

#### Critérios de Aceitação

1. THE GovernanceEngine SHALL continuar produzindo GovernancePassports válidos com todos os campos obrigatórios existentes após a adição do campo `cacheSource`.

2. WHEN passaportes persistidos antes da adição do campo `cacheSource` são recuperados do SQLite, THE HybridMemoryAdapter SHALL atribuir `cacheSource: 'full'` como valor padrão para manter compatibilidade retroativa.

3. THE GovernanceEngine SHALL garantir que `estimatedRemediationCost >= 0` independentemente de o resultado de validação ter vindo do cache ou de execução completa.

4. WHEN `--no-cache` não é fornecido e o cache está habilitado, THE GovernanceEngine SHALL produzir um GovernancePassport com `riskLevel` equivalente ao que seria produzido por uma validação completa para o mesmo código.
