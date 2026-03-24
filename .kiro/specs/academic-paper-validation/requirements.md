# Documento de Requisitos

## Introdução

O EscapeKit já possui detectores funcionais (`SlopsquatDetector`, `PostInstallDetector`, `PolyfillInjector`, `WebGLDetector`, `ConfigUpdater`, `DependencyValidator`) e contratos YAML na `knowledge-base/` que formalizam os fatos e regras extraídos de papers acadêmicos. No entanto, há três lacunas críticas:

1. **Rastreabilidade em runtime ausente**: quando o `SlopsquatDetector` detecta um problema, a `Issue` gerada não carrega referência ao paper que fundamenta aquela detecção.
2. **Cobertura não verificada**: não há mecanismo para validar se todos os fatos e regras dos contratos YAML possuem implementação correspondente nos detectores.
3. **Base para publicação científica inexistente**: sem rastreabilidade formal, não é possível escrever um artigo técnico sobre o EscapeKit com referências verificáveis.

Esta feature implementa o **Academic Paper Validation** — um sistema de rastreabilidade acadêmica que conecta cada `Issue` gerada ao paper que a fundamenta, valida a cobertura dos contratos YAML em relação aos detectores, e expõe essas informações via CLI e API.

Os sete papers de referência são:
- **ICSE-2024**: "On the Nature of AI-Generated Code: A Large-Scale Study"
- **ASE-2023-Ghost**: "Ghost Dependencies: A Threat to Software Supply Chain Security"
- **ESEC-FSE-2024**: "Automated Polyfill Injection for Modern Web APIs"
- **ICWE-2024**: "WebGL Fallback Strategies: A Systematic Study"
- **ASE-2023-Config**: "Automated Configuration Repair for JavaScript Projects"
- **IEEE-SP-2024**: "Typosquatting in Package Repositories: A Large-Scale Study"
- **CCS-2023**: "Malicious Post-install Scripts in npm Packages"

## Glossário

- **EscapeKit**: Ferramenta de validação e correção automática de código gerado por IA.
- **Issue**: Estrutura de dados (`src/models/schemas.ts`) gerada pelos detectores, representando um problema encontrado no código analisado.
- **Detector**: Módulo do EscapeKit responsável por identificar uma categoria específica de problema (`SlopsquatDetector`, `PostInstallDetector`, `PolyfillInjector`, `WebGLDetector`, `ConfigUpdater`, `DependencyValidator`).
- **Contrato_YAML**: Arquivo YAML na `knowledge-base/` com estrutura `source → facts → patterns → rules → cases`, gerado pelo pipeline `paper-to-contract.sh`. Cada `rule` contém um campo `paperRef` apontando para o `paperId` no `registry.yaml`.
- **AcademicReference**: Nova estrutura de dados que encapsula a referência a um paper acadêmico, incluindo `paperId`, `title`, `venue`, `year`, `ruleId` e `factIds`.
- **CoverageReport**: Relatório que mapeia cada regra (`rules[].id`) e fato (`facts[].id`) de um `Contrato_YAML` para o detector que o implementa, identificando lacunas.
- **TraceabilityIndex**: Índice em memória construído pelo `KnowledgeBase` estendido que mapeia `IssueType` → `AcademicReference[]`.
- **KnowledgeBase**: Componente existente (`src/resolvers/KnowledgeBase.ts`) estendido para carregar contratos de papers além de mapeamentos de packages, adicionando `loadPaperContracts()` e `getAcademicReference(issueType)`.
- **CoverageValidator**: Novo componente responsável por verificar se cada regra e fato de um `Contrato_YAML` possui entrada `traceability` com `status: implemented`.
- **PaperRegistry**: Arquivo de configuração (`knowledge-base/registry.yaml`) que lista todos os papers registrados e seus `Contrato_YAML` associados.
- **Venue**: Conferência ou periódico onde o paper foi publicado (ex: ICSE, ASE, CCS).
- **RuleId**: Identificador de uma regra dentro de um `Contrato_YAML` (ex: `R001`).
- **FactId**: Identificador de um fato dentro de um `Contrato_YAML` (ex: `F001`).

---

## Requisitos

### Requisito 1: Enriquecimento de Issues com Referências Acadêmicas

**User Story:** Como desenvolvedor que usa o EscapeKit, quero que cada Issue gerada pelos detectores inclua a referência ao paper acadêmico que fundamenta aquela detecção, para que eu possa entender a base científica do problema identificado.

#### Critérios de Aceitação

1. THE `Issue` SHALL conter um campo opcional `academicReference` do tipo `AcademicReference`, com os campos: `paperId` (string), `title` (string), `venue` (string), `year` (number), `ruleId` (string) e `factIds` (string[]).
2. WHEN o `SlopsquatDetector` gera uma `Issue` do tipo `slopsquat_risk`, THE `KnowledgeBase` estendido SHALL associar a referência ao paper `IEEE-SP-2024` ("Typosquatting in Package Repositories: A Large-Scale Study") e à regra correspondente no `Contrato_YAML`.
3. WHEN o `PostInstallDetector` gera uma `Issue` do tipo `postinstall_risk`, THE `KnowledgeBase` estendido SHALL associar a referência ao paper `CCS-2023` ("Malicious Post-install Scripts in npm Packages") e à regra correspondente no `Contrato_YAML`.
4. WHEN o `PolyfillInjector` gera uma `Issue`, THE `KnowledgeBase` estendido SHALL associar a referência ao paper `ESEC-FSE-2024` ("Automated Polyfill Injection for Modern Web APIs") e à regra correspondente no `Contrato_YAML`.
5. WHEN o `WebGLDetector` gera uma `Issue`, THE `KnowledgeBase` estendido SHALL associar a referência ao paper `ICWE-2024` ("WebGL Fallback Strategies: A Systematic Study") e à regra correspondente no `Contrato_YAML`.
6. WHEN o `ConfigUpdater` gera uma `Issue`, THE `KnowledgeBase` estendido SHALL associar a referência ao paper `ASE-2023-Config` ("Automated Configuration Repair for JavaScript Projects") e à regra correspondente no `Contrato_YAML`.
7. WHEN o `DependencyValidator` gera uma `Issue` do tipo `ghost_import`, THE `KnowledgeBase` estendido SHALL associar a referência ao paper `ASE-2023-Ghost` ("Ghost Dependencies: A Threat to Software Supply Chain Security") e à regra correspondente no `Contrato_YAML`.
8. IF um `IssueType` não possuir mapeamento no `TraceabilityIndex`, THEN THE `KnowledgeBase` estendido SHALL retornar `undefined` para `getAcademicReference(issueType)`, sem lançar exceção.
9. FOR ALL `Issue`s com `academicReference` preenchido, THE `KnowledgeBase` estendido SHALL garantir que `paperId` corresponde a uma entrada válida no `PaperRegistry`.

---

### Requisito 2: Extensão do KnowledgeBase para TraceabilityIndex

**User Story:** Como mantenedor do EscapeKit, quero que o `KnowledgeBase` existente seja estendido para carregar contratos de papers e construir um índice de rastreabilidade em memória, evitando duplicação de infraestrutura e reutilizando os mecanismos de carregamento já existentes.

#### Critérios de Aceitação

1. THE `KnowledgeBase` SHALL ser estendido com um `Map<string, AcademicReference[]>` para mapeamentos de `IssueType` → referências acadêmicas, coexistindo com o `Map<string, PackageMapping>` existente.
2. THE `KnowledgeBase` SHALL expor um método `loadPaperContracts(registryPath: string): Promise<void>` que lê o `registry.yaml` e carrega os contratos YAML associados, construindo o `TraceabilityIndex`.
3. THE `KnowledgeBase` SHALL expor um método `getAcademicReference(issueType: string): AcademicReference[] | undefined` para lookup no `TraceabilityIndex`.
4. THE `TraceabilityIndex` SHALL mapear cada `IssueType` para um array de `AcademicReference`, derivado das `rules` dos `Contrato_YAML` com `status: implemented` na seção `traceability` e com `paperRef` apontando para o `paperId` correspondente.
5. WHEN um `Contrato_YAML` contiver erros de sintaxe ou campos obrigatórios ausentes (`source`, `facts`, `rules`), THE `KnowledgeBase` SHALL registrar um aviso no log e ignorar aquele contrato, sem interromper a inicialização.
6. THE `KnowledgeBase` SHALL construir o `TraceabilityIndex` uma única vez por chamada de `loadPaperContracts()`, reutilizando-o para todas as chamadas subsequentes de `getAcademicReference()`.
7. WHEN o diretório `knowledge-base/` estiver vazio ou o `PaperRegistry` não existir, THE `KnowledgeBase` SHALL inicializar com um `TraceabilityIndex` vazio e registrar um aviso no log.
8. FOR ALL `Contrato_YAML` válidos carregados, THE `TraceabilityIndex` SHALL conter pelo menos uma entrada por `IssueType` mapeado nas `rules` com `status: implemented`.

---

### Requisito 3: PaperRegistry — Registro Central de Papers

**User Story:** Como mantenedor do EscapeKit, quero um registro central que liste todos os papers acadêmicos e seus contratos YAML associados, para que eu possa adicionar novos papers sem modificar código.

#### Critérios de Aceitação

1. THE `PaperRegistry` SHALL ser um arquivo YAML em `knowledge-base/registry.yaml` com a seguinte estrutura por entrada: `paperId`, `title`, `venue`, `year`, `contractFile` (caminho relativo ao `knowledge-base/`) e `detectors` (lista de nomes de detectores que implementam as regras do paper).
2. THE `PaperRegistry` SHALL conter entradas para os sete papers de referência: `ICSE-2024`, `ASE-2023-Ghost`, `ESEC-FSE-2024`, `ICWE-2024`, `ASE-2023-Config`, `IEEE-SP-2024` e `CCS-2023`.
3. WHEN um novo `Contrato_YAML` é adicionado ao `knowledge-base/`, THE `PaperRegistry` SHALL ser atualizado manualmente pelo mantenedor para incluir a nova entrada antes que o `KnowledgeBase` possa utilizá-la.
4. IF uma entrada do `PaperRegistry` referenciar um `contractFile` que não existe no sistema de arquivos, THEN THE `KnowledgeBase` SHALL registrar um erro no log e ignorar aquela entrada.
5. THE `PaperRegistry` SHALL ser validado pelo `CoverageValidator` na inicialização, verificando que todos os `contractFile` referenciados existem.

---

### Requisito 4: Validação de Cobertura dos Contratos YAML

**User Story:** Como mantenedor do EscapeKit, quero verificar se todos os fatos e regras dos contratos YAML possuem implementação correspondente nos detectores, para que eu possa identificar lacunas de cobertura antes de publicar um artigo técnico.

#### Critérios de Aceitação

1. WHEN o usuário executa `escapekit coverage`, THE `CoverageValidator` SHALL ler todos os `Contrato_YAML` listados no `PaperRegistry` e gerar um `CoverageReport`.
2. THE `CoverageReport` SHALL listar, para cada `Contrato_YAML`: total de regras, total de fatos, quantidade com `status: implemented`, quantidade com `status: pending` e quantidade sem entrada `traceability`.
3. THE `CoverageValidator` SHALL identificar como lacuna qualquer regra (`rules[].id`) ou fato (`facts[].id`) que não possua entrada correspondente na seção `traceability` do `Contrato_YAML`.
4. WHEN o `CoverageReport` identificar lacunas, THE CLI SHALL exibir a lista de lacunas com o formato: `[PAPER_ID] [RULE/FACT_ID]: sem implementação registrada`.
5. THE `CoverageValidator` SHALL calcular e exibir um percentual de cobertura global: `(total implemented / total rules + facts) * 100`, arredondado para uma casa decimal.
6. WHEN todos os fatos e regras de todos os contratos possuírem `status: implemented`, THE CLI SHALL exibir `"Cobertura completa: 100% dos fatos e regras possuem implementação registrada."`.
7. WHERE o usuário especificar `--output <caminho>`, THE CLI SHALL gravar o `CoverageReport` em formato Markdown no caminho especificado.
8. THE `CoverageValidator` SHALL ser executável de forma isolada, sem depender do estado de execução dos detectores.

---

### Requisito 5: Campo `paperRef` nas Rules dos Contratos YAML

**User Story:** Como mantenedor do EscapeKit, quero que cada `rule` nos contratos YAML existentes contenha um campo `paperRef` apontando para o `paperId` no `registry.yaml`, tornando a rastreabilidade direta e menos verbosa do que uma seção separada.

#### Critérios de Aceitação

1. THE `Contrato_YAML` SHALL suportar um campo `paperRef` em cada entrada de `rules`, contendo o `paperId` correspondente no `PaperRegistry` (ex: `paperRef: "IEEE-SP-2024"`).
2. THE `KnowledgeBase` estendido SHALL usar o campo `paperRef` de cada `rule` para associar a `AcademicReference` ao `IssueType` mapeado pelo `detector_name` da regra.
3. THE `Contrato_YAML` SHALL manter a seção `traceability` opcional com a seguinte estrutura por entrada: chave igual ao `FactId` ou `RuleId`, `implementation` (caminho do arquivo TypeScript), `tests` (caminho do arquivo de testes) e `status` (`implemented`, `pending` ou `not_applicable`).
4. THE `CoverageValidator` SHALL tratar a ausência da seção `traceability` em um `Contrato_YAML` como cobertura zero para aquele contrato.
5. WHEN o `paper-to-contract.sh` gera um novo `Contrato_YAML`, THE script SHALL incluir o campo `paperRef` em cada `rule` e uma seção `traceability` com `status: pending` para cada fato e regra gerado.
6. FOR ALL sete papers de referência, os `Contrato_YAML` correspondentes SHALL conter o campo `paperRef` em cada `rule` e a seção `traceability` com entradas para cada fato e regra, com `status` refletindo o estado atual de implementação.
7. THE `KnowledgeBase` estendido SHALL considerar apenas `rules` com `paperRef` definido e entrada `traceability` com `status: implemented` ao construir o `TraceabilityIndex`.

---

### Requisito 6: Exibição de Referências Acadêmicas na Saída da CLI

**User Story:** Como desenvolvedor, quero ver as referências acadêmicas associadas a cada Issue na saída dos comandos `validate` e `audit` da CLI, para que eu possa consultar os papers originais quando necessário.

#### Critérios de Aceitação

1. WHEN o usuário executa `escapekit validate <projeto> --academic`, THE CLI SHALL incluir, para cada `Issue` com `academicReference` preenchido, uma linha adicional no formato: `  📄 Ref: <title> (<venue>, <year>) — Regra <ruleId>`.
2. WHEN o usuário executa `escapekit audit <arquivo> --academic`, THE CLI SHALL incluir as referências acadêmicas para cada issue listada no relatório de auditoria.
3. WHEN o usuário executa `escapekit validate <projeto>` ou `escapekit audit <arquivo>` sem a flag `--academic`, THE CLI SHALL omitir as referências acadêmicas da saída padrão, mantendo compatibilidade retroativa.
4. THE CLI SHALL exibir as referências acadêmicas após a descrição da `Issue`, com indentação de dois espaços.
5. WHEN o usuário executa `escapekit validate <projeto> --academic --format json`, THE CLI SHALL incluir o campo `academicReference` completo no JSON de saída.
6. WHERE o usuário especificar `--academic --output <caminho>`, THE CLI SHALL gravar a saída com referências acadêmicas no caminho especificado.
7. IF uma `Issue` não possuir `academicReference`, THEN THE CLI SHALL omitir a linha de referência para aquela `Issue`, sem exibir campos vazios.

---

### Requisito 7: Geração de Contratos YAML para os Sete Papers de Referência

**User Story:** Como mantenedor do EscapeKit, quero que os sete papers de referência possuam contratos YAML completos na `knowledge-base/`, para que o sistema de rastreabilidade tenha base factual para todos os detectores existentes.

#### Critérios de Aceitação

1. THE `knowledge-base/` SHALL conter um `Contrato_YAML` para cada um dos sete papers de referência, com as seções `source`, `facts`, `patterns`, `rules`, `cases` e `traceability` preenchidas, e o campo `paperRef` em cada `rule`.
2. THE `Contrato_YAML` do paper `IEEE-SP-2024` SHALL conter pelo menos uma regra com `detector_name: SlopsquatDetector`, `paperRef: "IEEE-SP-2024"` e entrada `traceability` correspondente.
3. THE `Contrato_YAML` do paper `CCS-2023` SHALL conter pelo menos uma regra com `detector_name: PostInstallDetector`, `paperRef: "CCS-2023"` e entrada `traceability` correspondente.
4. THE `Contrato_YAML` do paper `ESEC-FSE-2024` SHALL conter pelo menos uma regra com `detector_name: PolyfillInjector`, `paperRef: "ESEC-FSE-2024"` e entrada `traceability` correspondente.
5. THE `Contrato_YAML` do paper `ICWE-2024` SHALL conter pelo menos uma regra com `detector_name: WebGLDetector`, `paperRef: "ICWE-2024"` e entrada `traceability` correspondente.
6. THE `Contrato_YAML` do paper `ASE-2023-Config` SHALL conter pelo menos uma regra com `detector_name: ConfigUpdater`, `paperRef: "ASE-2023-Config"` e entrada `traceability` correspondente.
7. THE `Contrato_YAML` do paper `ASE-2023-Ghost` SHALL conter pelo menos uma regra com `detector_name: DependencyValidator`, `paperRef: "ASE-2023-Ghost"` e entrada `traceability` correspondente.
8. THE `Contrato_YAML` do paper `ICSE-2024` SHALL conter fatos sobre características gerais de código gerado por IA, com pelo menos uma regra mapeada para um ou mais detectores existentes e `paperRef: "ICSE-2024"`.

---

### Requisito 8: Qualidade e Testabilidade

**User Story:** Como mantenedor do EscapeKit, quero que os novos componentes sejam testáveis de forma isolada com Vitest e fast-check, para que eu possa garantir a corretude da rastreabilidade e da validação de cobertura.

#### Critérios de Aceitação

1. THE `KnowledgeBase` estendido SHALL ser testável de forma isolada, recebendo um array de `Contrato_YAML` diretamente (sem I/O) e retornando um `TraceabilityIndex` como saída.
2. THE `CoverageValidator` SHALL ser testável de forma isolada, recebendo um array de `Contrato_YAML` como entrada e retornando um `CoverageReport` como saída, sem efeitos colaterais de I/O.
3. FOR ALL arrays arbitrários de `Contrato_YAML` válidos gerados pelo fast-check, THE `KnowledgeBase` estendido SHALL retornar um `TraceabilityIndex` não nulo (nunca `null` ou `undefined`).
4. FOR ALL `Contrato_YAML` onde todos os fatos e regras têm `status: implemented`, THE `CoverageValidator` SHALL retornar `coveragePercentage` igual a `100.0`.
5. THE `KnowledgeBase` estendido SHALL produzir saída determinística: para o mesmo conjunto de `Contrato_YAML` de entrada, o `TraceabilityIndex` gerado SHALL ser sempre idêntico.
6. WHEN o `KnowledgeBase` estendido receber um `Contrato_YAML` com seção `traceability` vazia, THE `KnowledgeBase` SHALL retornar um `TraceabilityIndex` vazio para aquele contrato, sem lançar exceção.
7. FOR ALL `Issue`s enriquecidas com `academicReference`, THE `KnowledgeBase` estendido SHALL garantir que `paperId` é uma string não vazia e `year` é um número positivo.
8. THE fast-check SHALL ser utilizado para gerar arrays arbitrários de `Contrato_YAML` e verificar as propriedades 3, 4 e 5 acima com no mínimo 100 iterações cada.
