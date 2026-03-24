# Documento de Requisitos

## Introdução

O EscapeKit Educational Mode é uma extensão do EscapeKit que transforma o processo de correção automática de código em uma experiência de aprendizado. Em vez de apenas corrigir silenciosamente os problemas detectados, o modo educacional explica cada decisão tomada, agrega estatísticas de erros ao longo do tempo e sugere documentação relevante para que o desenvolvedor entenda o porquê das correções — não apenas o quê.

O MVP cobre três capacidades:
1. **Flag `--explain`**: relatório em linguagem natural de cada transformação aplicada, gerado a partir dos dados já registrados pelo `EscapeContractWriter`.
2. **Comando `escapekit dashboard`**: agregação de estatísticas históricas das correções, exportada como HTML ou Markdown via `TemplateEngine`.
3. **Nível de validação `educational`**: extensão do `--level` existente que combina correção, explicação e sugestão de leitura contextualizada.

## Glossário

- **EscapeKit**: Ferramenta CLI/MCP de validação e correção automática de código gerado por IA.
- **EscapeContractWriter**: Componente existente que registra todas as transformações em um contrato JSON com campos `originalImport`, `resolvedPackage`, `confidence`, `appliedRules` e `assumptions`.
- **ExplanationGenerator**: Novo componente responsável por converter dados do `EscapeContractWriter` em texto explicativo em linguagem natural.
- **DashboardAggregator**: Novo componente responsável por agregar múltiplos contratos históricos e calcular estatísticas de tendência.
- **EducationalValidator**: Extensão do `ValidationEngine` que executa o nível `educational` de validação.
- **Ghost Import**: Importação de pacote que não existe no npm registry, gerada por alucinação de IA.
- **Contrato**: Arquivo JSON gerado pelo `EscapeContractWriter` contendo o audit trail de uma execução do EscapeKit.
- **Nível de Validação**: Parâmetro `--level` da CLI que controla a profundidade da validação (`basic`, `standard`, `thorough`, `educational`).
- **Link_Educacional**: URL para documentação externa (MDN, npm, TypeScript docs) associada a um tipo específico de correção.
- **Relatório_Explicativo**: Arquivo `.escapekit/explanation.md` gerado pelo modo `--explain`.
- **Relatório_Dashboard**: Arquivo `.escapekit/dashboard.html` ou `.escapekit/dashboard.md` gerado pelo comando `dashboard`.

---

## Requisitos

### Requisito 1: Flag `--explain` na CLI

**User Story:** Como desenvolvedor que usa o EscapeKit, quero entender em linguagem natural por que cada correção foi aplicada, para que eu aprenda com os erros e não os repita.

#### Critérios de Aceitação

1. WHEN o usuário executa `escapekit validate <projeto> --explain`, THE CLI SHALL gerar um `Relatório_Explicativo` em `.escapekit/explanation.md` após a validação.
2. THE `ExplanationGenerator` SHALL produzir pelo menos uma frase explicativa por transformação registrada no `EscapeContractWriter`, no formato: `"Substituímos '<originalImport>' por '<resolvedPackage>' porque <razão derivada de appliedRules e assumptions>"`.
3. WHEN o campo `confidence` de uma resolução for menor que 0,7, THE `ExplanationGenerator` SHALL incluir um aviso explícito de baixa confiança na explicação daquela transformação.
4. THE `Relatório_Explicativo` SHALL conter: cabeçalho com data/hora da execução, lista de transformações explicadas e seção de resumo com contagem total de correções.
5. WHEN nenhuma transformação for aplicada durante a execução, THE CLI SHALL exibir a mensagem `"Nenhuma correção foi necessária — nada a explicar."` e não gerar o arquivo.
6. WHERE o usuário especificar `--explain --output <caminho>`, THE CLI SHALL gravar o `Relatório_Explicativo` no caminho especificado em vez do padrão `.escapekit/explanation.md`.
7. THE `ExplanationGenerator` SHALL processar os dados do `EscapeContractWriter` sem modificar o contrato original.

---

### Requisito 2: Geração de Explicações em Linguagem Natural

**User Story:** Como desenvolvedor, quero que as explicações sejam compreensíveis e contextualizadas, para que eu entenda a decisão técnica sem precisar ler o JSON do contrato.

#### Critérios de Aceitação

1. THE `ExplanationGenerator` SHALL mapear cada valor de `TransformationType` (`IMPORT_REPLACEMENT`, `POLYFILL_INJECTION`, `API_MIGRATION`, `CONFIGURATION_GENERATION`) para um template de frase explicativa distinto.
2. WHEN o `ResolutionMethod` for `KNOWLEDGE_BASE`, THE `ExplanationGenerator` SHALL incluir na explicação que a substituição foi baseada em mapeamento conhecido da base de conhecimento do EscapeKit.
3. WHEN o `ResolutionMethod` for `SEMANTIC_ANALYSIS`, THE `ExplanationGenerator` SHALL incluir na explicação que a substituição foi inferida por similaridade semântica e requer revisão manual.
4. WHEN o `ResolutionMethod` for `NPM_SEARCH`, THE `ExplanationGenerator` SHALL incluir na explicação que o pacote substituto foi encontrado via busca no registro npm.
5. THE `ExplanationGenerator` SHALL incluir, quando disponível, o campo `metadata.reasoning` da `DependencyResolution` na explicação gerada.
6. FOR ALL explicações geradas, THE `ExplanationGenerator` SHALL produzir texto em português brasileiro.
7. THE `ExplanationGenerator` SHALL serializar o `Relatório_Explicativo` usando o `TemplateEngine` existente, com template Handlebars dedicado.

---

### Requisito 3: Comando `escapekit dashboard`

**User Story:** Como desenvolvedor ou tech lead, quero visualizar estatísticas agregadas das correções aplicadas ao longo do tempo, para que eu possa identificar padrões de erro recorrentes e medir a evolução da qualidade do código gerado.

#### Critérios de Aceitação

1. WHEN o usuário executa `escapekit dashboard`, THE CLI SHALL ler todos os contratos JSON em `.escapekit/contracts/` e gerar um `Relatório_Dashboard`.
2. THE `DashboardAggregator` SHALL calcular e incluir no relatório: total de execuções, total de correções aplicadas, distribuição por `TransformationType`, top 5 `originalImport` mais frequentes e média de `confidence` por tipo de resolução.
3. THE `DashboardAggregator` SHALL calcular tendência temporal: comparar a contagem de correções da semana atual com a semana anterior e indicar se houve aumento, redução ou estabilidade.
4. WHEN o usuário especificar `--format html`, THE CLI SHALL gerar `.escapekit/dashboard.html` usando o `TemplateEngine` e o `ProjectGenerator`.
5. WHEN o usuário especificar `--format md` ou não especificar formato, THE CLI SHALL gerar `.escapekit/dashboard.md`.
6. IF nenhum contrato for encontrado em `.escapekit/contracts/`, THEN THE CLI SHALL exibir `"Nenhum histórico encontrado. Execute o EscapeKit em um projeto primeiro."` e encerrar com código de saída 0.
7. WHERE o usuário especificar `--output <caminho>`, THE CLI SHALL gravar o `Relatório_Dashboard` no caminho especificado.
8. THE `DashboardAggregator` SHALL ignorar arquivos em `.escapekit/contracts/` que não sejam JSON válidos, registrando um aviso no log sem interromper a execução.

---

### Requisito 4: Nível de Validação `educational`

**User Story:** Como desenvolvedor que quer aprender enquanto trabalha, quero um modo de validação que corrija os problemas, explique cada decisão e sugira documentação relevante, para que eu evolua meu conhecimento sem sair do fluxo de trabalho.

#### Critérios de Aceitação

1. WHEN o usuário executa `escapekit validate <projeto> --level educational`, THE `EducationalValidator` SHALL executar todas as verificações do nível `thorough` e, adicionalmente, gerar o `Relatório_Explicativo` e os `Link_Educacional` associados.
2. THE `EducationalValidator` SHALL associar pelo menos um `Link_Educacional` a cada tipo de correção aplicada, conforme a tabela de mapeamento definida no design.
3. WHEN o tipo de correção for `IMPORT_REPLACEMENT` para um pacote npm, THE `EducationalValidator` SHALL incluir o link `https://www.npmjs.com/package/<resolvedPackage>` como `Link_Educacional`.
4. WHEN o tipo de correção envolver TypeScript, THE `EducationalValidator` SHALL incluir o link para a seção relevante da documentação oficial do TypeScript (`https://www.typescriptlang.org/docs/`).
5. WHEN o tipo de correção envolver uma API Web (ex: WebGL, Canvas, Fetch), THE `EducationalValidator` SHALL incluir o link para a página MDN correspondente (`https://developer.mozilla.org/`).
6. THE `EducationalValidator` SHALL incluir os `Link_Educacional` no `Relatório_Explicativo` gerado, agrupados por transformação.
7. WHEN o nível `educational` for usado, THE CLI SHALL exibir no terminal um resumo com o número de correções aplicadas, o número de links educacionais gerados e o caminho do `Relatório_Explicativo`.
8. THE `EducationalValidator` SHALL herdar e reutilizar o `ValidationEngine` existente sem duplicar lógica de validação.

---

### Requisito 5: Persistência e Rastreabilidade dos Contratos

**User Story:** Como desenvolvedor, quero que os contratos gerados sejam armazenados de forma organizada, para que o dashboard possa acessar o histórico completo de execuções.

#### Critérios de Aceitação

1. WHEN o EscapeKit aplica correções com a flag `--explain` ou o nível `educational`, THE CLI SHALL salvar o contrato JSON em `.escapekit/contracts/<contractId>.json`.
2. THE CLI SHALL criar o diretório `.escapekit/contracts/` automaticamente se ele não existir.
3. THE `EscapeContractWriter` SHALL continuar gerando contratos no formato existente, sem alterações no schema, para garantir compatibilidade retroativa.
4. FOR ALL contratos salvos, THE CLI SHALL registrar no log o caminho do arquivo gerado.
5. IF a gravação do contrato falhar por erro de sistema de arquivos, THEN THE CLI SHALL registrar o erro no log e continuar a execução sem interromper o fluxo principal.

---

### Requisito 6: Qualidade e Testabilidade

**User Story:** Como mantenedor do EscapeKit, quero que o modo educacional seja testável com as ferramentas existentes (Vitest, fast-check), para que eu possa garantir a corretude das explicações e das estatísticas geradas.

#### Critérios de Aceitação

1. THE `ExplanationGenerator` SHALL ser testável de forma isolada, recebendo um `EscapeContract` como entrada e retornando uma string Markdown como saída, sem efeitos colaterais de I/O.
2. THE `DashboardAggregator` SHALL ser testável de forma isolada, recebendo um array de `EscapeContract` como entrada e retornando um objeto de estatísticas como saída, sem efeitos colaterais de I/O.
3. FOR ALL `EscapeContract` válidos fornecidos ao `ExplanationGenerator`, THE `ExplanationGenerator` SHALL retornar uma string não vazia.
4. FOR ALL arrays não vazios de `EscapeContract` fornecidos ao `DashboardAggregator`, THE `DashboardAggregator` SHALL retornar estatísticas onde `totalCorrections` é maior ou igual a zero e `totalExecutions` é igual ao tamanho do array.
5. WHEN o `ExplanationGenerator` receber um contrato com zero transformações, THE `ExplanationGenerator` SHALL retornar uma string contendo a mensagem de ausência de correções, sem lançar exceção.
6. THE `ExplanationGenerator` SHALL produzir saída determinística: para o mesmo `EscapeContract` de entrada, a saída SHALL ser sempre idêntica.
