# Requirements Document

## Introduction

O `MockReplacer` é o componente responsável por substituir ghost imports por pacotes reais durante o processo de auto-fix do EscapeKit MCP. Atualmente ele depende de uma tabela hardcoded com apenas 18 mapeamentos, retornando `applied: false` para qualquer ghost import não listado. Esta melhoria refatora o `MockReplacer` para usar uma cadeia de resolução dinâmica — consultando `KnowledgeBase`, `SemanticMatcher` e `NPMRegistry` em sequência — antes de recorrer à tabela hardcoded como último fallback. O objetivo é aumentar significativamente a taxa de resolução de ghost imports sem quebrar a interface `Fixer` existente.

## Glossary

- **MockReplacer**: Componente em `src/validate/auto-fix/MockReplacer.ts` que implementa a interface `Fixer` e substitui ghost imports por pacotes reais.
- **KnowledgeBase**: Componente em `src/resolvers/KnowledgeBase.ts` que mantém um mapa de mapeamentos ghost → real carregados de `knowledge-base.json`.
- **SemanticMatcher**: Componente em `src/resolvers/SemanticMatcher.ts` que realiza matching fuzzy por similaridade de nome e metadados de pacote.
- **NPMRegistry**: Serviço em `src/services/NPMRegistry.ts` que consulta o registro npm para verificar existência e versão de pacotes.
- **Ghost_Import**: Import de um pacote que não existe no npm registry e não é um módulo nativo do Node.js.
- **Resolution_Chain**: Sequência ordenada de estratégias de resolução: KnowledgeBase → SemanticMatcher → NPMRegistry → tabela hardcoded.
- **Fixer**: Interface em `src/validate/types.ts` com o método `fix(projectPath: string, issue: Issue): Promise<Fix>`.
- **PackageMapping**: Modelo em `src/models/transformation.ts` que representa um mapeamento ghost → real com metadados de confiança.
- **AutoFixEngine**: Orquestrador em `src/validate/auto-fix/AutoFixEngine.ts` que instancia e invoca fixers.

---

## Requirements

### Requirement 1: Injeção de Dependências no MockReplacer

**User Story:** Como desenvolvedor do EscapeKit, quero que o `MockReplacer` aceite `KnowledgeBase`, `SemanticMatcher` e `NPMRegistry` via construtor, para que as dependências possam ser substituídas em testes e o componente seja desacoplado de instâncias globais.

#### Acceptance Criteria

1. THE `MockReplacer` SHALL aceitar um parâmetro opcional `knowledgeBase: KnowledgeBase` no construtor.
2. THE `MockReplacer` SHALL aceitar um parâmetro opcional `semanticMatcher: SemanticMatcher` no construtor.
3. THE `MockReplacer` SHALL aceitar um parâmetro opcional `npmRegistry: NPMRegistry` no construtor.
4. WHEN nenhuma dependência for fornecida ao construtor, THE `MockReplacer` SHALL instanciar versões padrão de `KnowledgeBase`, `SemanticMatcher` e `NPMRegistry` internamente.
5. THE `MockReplacer` SHALL manter a assinatura do método `fix(projectPath: string, issue: Issue): Promise<Fix>` sem alterações.
6. THE `AutoFixEngine` SHALL continuar instanciando `MockReplacer` sem argumentos, usando o construtor padrão.

---

### Requirement 2: Resolução via KnowledgeBase

**User Story:** Como usuário do EscapeKit, quero que o `MockReplacer` consulte a `KnowledgeBase` como primeira estratégia de resolução, para que os centenas de mapeamentos do `knowledge-base.json` sejam aproveitados antes de qualquer outra estratégia.

#### Acceptance Criteria

1. WHEN o método `fix` for invocado com um ghost import, THE `MockReplacer` SHALL consultar `KnowledgeBase.getMapping(ghostImport)` como primeira etapa da Resolution_Chain.
2. WHEN `KnowledgeBase.getMapping` retornar um `PackageMapping` com `realPackages[0]` definido, THE `MockReplacer` SHALL usar esse pacote como substituto.
3. WHEN a substituição via `KnowledgeBase` for aplicada com sucesso, THE `MockReplacer` SHALL registrar no log a estratégia utilizada com o valor `"knowledge-base"`.
4. WHEN `KnowledgeBase.getMapping` retornar `null`, THE `MockReplacer` SHALL prosseguir para a próxima estratégia da Resolution_Chain sem retornar erro.

---

### Requirement 3: Resolução via SemanticMatcher

**User Story:** Como usuário do EscapeKit, quero que o `MockReplacer` tente matching semântico quando a `KnowledgeBase` não encontrar mapeamento, para que ghost imports com nomes similares a pacotes reais sejam resolvidos automaticamente.

#### Acceptance Criteria

1. WHEN `KnowledgeBase.getMapping` retornar `null`, THE `MockReplacer` SHALL invocar `SemanticMatcher.findSimilar(ghostImport)` como segunda etapa da Resolution_Chain.
2. WHEN `SemanticMatcher.findSimilar` retornar ao menos um `PackageMapping`, THE `MockReplacer` SHALL usar o `realPackages[0]` do resultado com maior `confidence` como substituto.
3. WHEN a substituição via `SemanticMatcher` for aplicada com sucesso, THE `MockReplacer` SHALL registrar no log a estratégia utilizada com o valor `"semantic-matcher"` e o score de confiança.
4. WHEN `SemanticMatcher.findSimilar` retornar array vazio, THE `MockReplacer` SHALL prosseguir para a próxima estratégia da Resolution_Chain.
5. IF `SemanticMatcher.findSimilar` lançar exceção, THEN THE `MockReplacer` SHALL registrar o erro no log e prosseguir para a próxima estratégia sem propagar a exceção.

---

### Requirement 4: Resolução via NPMRegistry

**User Story:** Como usuário do EscapeKit, quero que o `MockReplacer` verifique se o próprio ghost import existe no npm registry, para que pacotes reais com nomes incomuns não sejam incorretamente substituídos.

#### Acceptance Criteria

1. WHEN `SemanticMatcher.findSimilar` retornar array vazio, THE `MockReplacer` SHALL invocar `NPMRegistry.packageExists(ghostImport)` como terceira etapa da Resolution_Chain.
2. WHEN `NPMRegistry.packageExists` retornar `true`, THE `MockReplacer` SHALL tratar o ghost import como um pacote real existente e retornar `applied: false` com a descrição `"Package exists on npm registry, no replacement needed"`.
3. WHEN a verificação via `NPMRegistry` confirmar existência, THE `MockReplacer` SHALL registrar no log a estratégia utilizada com o valor `"npm-registry-verified"`.
4. WHEN `NPMRegistry.packageExists` retornar `false`, THE `MockReplacer` SHALL prosseguir para a próxima estratégia da Resolution_Chain.
5. IF `NPMRegistry.packageExists` lançar exceção, THEN THE `MockReplacer` SHALL registrar o erro no log e prosseguir para a próxima estratégia sem propagar a exceção.

---

### Requirement 5: Fallback para Tabela Hardcoded

**User Story:** Como desenvolvedor do EscapeKit, quero que a tabela hardcoded existente seja mantida como último fallback, para que os 18 mapeamentos originais continuem funcionando e a compatibilidade retroativa seja preservada.

#### Acceptance Criteria

1. WHEN todas as estratégias anteriores da Resolution_Chain falharem em encontrar um substituto, THE `MockReplacer` SHALL consultar a tabela hardcoded `replacements` como quarta e última etapa.
2. WHEN a substituição via tabela hardcoded for aplicada com sucesso, THE `MockReplacer` SHALL registrar no log a estratégia utilizada com o valor `"hardcoded-table"`.
3. WHEN nenhuma estratégia da Resolution_Chain encontrar um substituto, THE `MockReplacer` SHALL retornar `Fix` com `applied: false` e `error: "No matching replacement found"`.
4. THE `MockReplacer` SHALL manter todos os 18 mapeamentos existentes na tabela hardcoded sem remoção ou alteração.

---

### Requirement 6: Logging de Estratégia Utilizada

**User Story:** Como desenvolvedor do EscapeKit, quero que o `MockReplacer` registre qual estratégia foi usada em cada substituição, para que seja possível auditar e depurar o processo de resolução.

#### Acceptance Criteria

1. WHEN qualquer estratégia da Resolution_Chain produzir um substituto, THE `MockReplacer` SHALL emitir um log de nível `info` contendo o nome do ghost import, o pacote substituto e o identificador da estratégia usada.
2. WHEN nenhuma estratégia encontrar substituto, THE `MockReplacer` SHALL emitir um log de nível `warn` contendo o nome do ghost import e a mensagem `"No replacement found after exhausting all strategies"`.
3. THE `MockReplacer` SHALL usar o logger filho existente `this.log` para todos os registros relacionados à Resolution_Chain.

---

### Requirement 7: Compatibilidade com Testes Existentes

**User Story:** Como desenvolvedor do EscapeKit, quero que a refatoração não quebre testes existentes, para que a estabilidade do projeto seja mantida.

#### Acceptance Criteria

1. THE `MockReplacer` SHALL implementar a interface `Fixer` sem alterações na assinatura pública.
2. WHEN instanciado sem argumentos, THE `MockReplacer` SHALL se comportar de forma compatível com a implementação anterior para todos os 18 mapeamentos hardcoded.
3. THE `MockReplacer` SHALL manter o comportamento de atualizar `package.json` via `updatePackageJson` após qualquer substituição bem-sucedida, independentemente da estratégia usada.
4. FOR ALL ghost imports presentes na tabela hardcoded, o resultado de `fix` com o novo `MockReplacer` SHALL ser equivalente ao resultado da implementação anterior (round-trip de compatibilidade).
