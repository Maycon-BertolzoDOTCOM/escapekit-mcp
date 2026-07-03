# Requirements Document

## Introduction

Este documento especifica os três gaps críticos que bloqueiam a primeira demo enterprise do CodeMemória. Os gaps foram identificados durante o protocolo de testagem por fases e cobrem: (1) ausência de um comando `report generate` para exportar artefatos de compliance auditáveis, (2) detecção incompleta de secrets hardcoded em objetos literais pelo `PatternMatcher`, e (3) ausência de detecção de SQL injection por template string no `CodeAnalyzer`.

## Glossary

- **CLI**: Interface de linha de comando do CodeMemória (Commander.js), ponto de entrada `src/cli/index.ts`
- **Report_Generator**: Novo módulo responsável por produzir o artefato de compliance exportável
- **Compliance_Report**: Artefato JSON estruturado contendo issues, hash de integridade, timestamp e referências normativas
- **PatternMatcher**: Módulo `src/security/PatternMatcher.ts` que detecta padrões suspeitos em código
- **CodeAnalyzer**: Módulo `src/analyzers/CodeAnalyzer.ts` que analisa código gerado por IA
- **SQL_Detector**: Novo detector de SQL injection a ser integrado ao `CodeAnalyzer`
- **Hardcoded_Secret**: Valor sensível (chave de API, senha, token) atribuído diretamente a uma variável ou propriedade em código-fonte
- **Template_Literal_Injection**: Interpolação direta de variável em query SQL via template string (`` `SELECT ... ${var}` ``)
- **LGPD**: Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
- **OWASP**: Open Web Application Security Project — referência normativa para vulnerabilidades web

---

## Requirements

### Requirement 1: Comando `report generate`

**User Story:** Como jurídico ou auditor enterprise, quero exportar um relatório de compliance estruturado a partir de uma análise existente, para que eu possa assinar e arquivar um artefato rastreável que comprove a auditoria do código.

#### Acceptance Criteria

1. THE CLI SHALL expor o subcomando `report generate` com os argumentos `[analysis_file]` e as opções `--output <path>` e `--format <format>`.
2. WHEN o usuário executa `report generate <analysis_file>`, THE Report_Generator SHALL produzir um Compliance_Report em formato JSON contendo: lista de issues com campos `id`, `type`, `severity`, `message`, `location`; timestamp ISO 8601 da geração; hash SHA-256 de integridade calculado sobre o conteúdo serializado do relatório; e campo `normativeRefs` com referências LGPD e/ou OWASP quando aplicável ao tipo de issue.
3. WHEN o arquivo de análise informado não existe ou não é JSON válido, THE CLI SHALL exibir mensagem de erro descritiva e encerrar com código de saída 1.
4. WHEN a opção `--output <path>` é fornecida, THE Report_Generator SHALL gravar o Compliance_Report no caminho especificado e exibir confirmação no stdout.
5. WHEN a opção `--output` não é fornecida, THE Report_Generator SHALL imprimir o Compliance_Report serializado no stdout.
6. WHEN a opção `--format json` é fornecida (padrão), THE Report_Generator SHALL serializar o Compliance_Report como JSON formatado com indentação de 2 espaços.
7. THE Compliance_Report SHALL conter o campo `reportVersion` com valor `"1.0"` para permitir versionamento futuro do schema.
8. FOR ALL Compliance_Reports gerados, recalcular o hash SHA-256 sobre o conteúdo do relatório (excluindo o próprio campo `integrityHash`) e comparar com o campo `integrityHash` SHALL produzir valores iguais (propriedade de round-trip de integridade).

---

### Requirement 2: Detecção de secrets hardcoded em objetos literais

**User Story:** Como desenvolvedor ou auditor de segurança, quero que o PatternMatcher detecte secrets hardcoded atribuídos a propriedades de objetos literais, para que chaves de API e senhas expostas no código sejam sinalizadas antes de chegarem à produção.

#### Acceptance Criteria

1. WHEN o PatternMatcher analisa código contendo uma propriedade de objeto literal cujo nome corresponde a `stripeKey`, `apiKey`, `api_key`, `password`, `secret` ou `token` e cujo valor é uma string literal não vazia, THE PatternMatcher SHALL retornar um `DetectedPattern` com `type` igual a `'hardcoded_secret'`.
2. WHEN o PatternMatcher analisa código contendo um valor de string literal que começa com `sk_live_` ou `sk_test_` independentemente do nome da propriedade, THE PatternMatcher SHALL retornar um `DetectedPattern` com `type` igual a `'hardcoded_secret'`.
3. WHEN o PatternMatcher analisa código onde o valor da propriedade é uma referência a variável (não string literal), THE PatternMatcher SHALL NOT retornar `DetectedPattern` de `type` `'hardcoded_secret'` para esse trecho.
4. WHEN o PatternMatcher analisa código onde o valor da propriedade é uma string vazia `''` ou `""`, THE PatternMatcher SHALL NOT retornar `DetectedPattern` de `type` `'hardcoded_secret'` para esse trecho.
5. THE PatternMatcher SHALL incluir a posição (linha e coluna) no `DetectedPattern` retornado para cada secret detectado em objeto literal.
6. FOR ALL entradas de código que contenham exatamente N ocorrências de secrets hardcoded em objetos literais, THE PatternMatcher SHALL retornar exatamente N DetectedPatterns de `type` `'hardcoded_secret'` (propriedade de contagem exata).

---

### Requirement 3: Detecção de SQL injection por template string

**User Story:** Como desenvolvedor ou auditor de segurança, quero que o CodeAnalyzer detecte SQL injection introduzido via template literals com interpolação direta, para que queries vulneráveis sejam sinalizadas antes de chegarem à produção.

#### Acceptance Criteria

1. WHEN o CodeAnalyzer analisa código contendo um template literal que inclui uma palavra-chave SQL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `EXEC`) e ao menos uma interpolação `${...}`, THE SQL_Detector SHALL retornar um issue com `type` igual a `'sql_injection'` e `severity` igual a `'error'`.
2. WHEN o CodeAnalyzer analisa código contendo concatenação de string com operador `+` onde um dos operandos é uma string que contém palavra-chave SQL e o outro operando é uma variável ou expressão, THE SQL_Detector SHALL retornar um issue com `type` igual a `'sql_injection'` e `severity` igual a `'error'`.
3. WHEN o CodeAnalyzer analisa código SQL sem nenhuma interpolação ou concatenação de variável (query completamente estática), THE SQL_Detector SHALL NOT retornar issue de `type` `'sql_injection'`.
4. WHEN o SQL_Detector detecta um issue de SQL injection, THE SQL_Detector SHALL incluir no campo `suggestion` do issue uma recomendação de uso de prepared statements ou queries parametrizadas.
5. WHEN o SQL_Detector detecta um issue de SQL injection, THE SQL_Detector SHALL incluir no campo `location` a linha e coluna do template literal ou concatenação vulnerável.
6. THE CodeAnalyzer SHALL incluir a contagem de issues de `type` `'sql_injection'` no campo `summary.securityRisks` do `AnalysisResult`.
7. FOR ALL entradas de código que contenham exatamente N template literals SQL com interpolação, THE SQL_Detector SHALL retornar exatamente N issues de `type` `'sql_injection'` (propriedade de contagem exata).
