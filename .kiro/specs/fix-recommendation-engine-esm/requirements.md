# Requirements Document

## Introduction

O `RecommendationEngine` (`src/recommendations/RecommendationEngine.ts`) usa `__dirname` no método `loadTemplates()`, que não existe em módulos ESM. Como o projeto EscapeKit MCP declara `"type": "module"` no `package.json`, qualquer instanciação do `RecommendationEngine` lança `ReferenceError: __dirname is not defined` em runtime. O construtor chama `loadTemplates()` imediatamente, tornando o componente completamente inutilizável. Esta correção substitui `__dirname` pelo equivalente ESM `new URL('.', import.meta.url).pathname`, padrão já adotado em `FallbackGenerator.ts`, e migra os `console.warn`/`console.log` para o logger estruturado do projeto (`logger.child`), alinhando o componente com os padrões do restante da codebase.

## Glossary

- **RecommendationEngine**: Componente em `src/recommendations/RecommendationEngine.ts` que carrega templates YAML e gera recomendações contextuais para issues detectados.
- **ESM**: ECMAScript Modules — sistema de módulos nativo do JavaScript, ativado pelo campo `"type": "module"` no `package.json`. Não expõe `__dirname` nem `__filename`.
- **import.meta.url**: Propriedade disponível em módulos ESM que contém a URL do arquivo atual, equivalente funcional de `__filename` em CommonJS.
- **Template_YAML**: Arquivo `.yaml` no diretório `src/recommendations/templates/` que define a estrutura de uma recomendação (id, title, description, severity, recommendedActions).
- **templateCache**: Mapa interno `Map<string, RecommendationTemplate>` do `RecommendationEngine` que armazena os templates carregados, indexados por `id`.
- **Logger**: Instância de `Logger` de `src/logger.ts`, criada via `logger.child('RecommendationEngine')`, usada para logging estruturado.
- **loadTemplates**: Método privado síncrono do `RecommendationEngine` responsável por descobrir e carregar todos os Template_YAML do diretório `templates/`.
- **FallbackGenerator**: Componente em `src/validate/auto-fix/FallbackGenerator.ts` que já usa `new URL('../../..', import.meta.url).pathname` como referência de padrão ESM correto no projeto.

---

## Requirements

### Requirement 1: Correção da Resolução de Caminho ESM

**User Story:** Como desenvolvedor usando o EscapeKit MCP, quero que o `RecommendationEngine` seja instanciável em ambiente ESM, para que as recomendações contextuais funcionem sem lançar `ReferenceError` em runtime.

#### Acceptance Criteria

1. WHEN `new RecommendationEngine()` for invocado em um módulo ESM, THE `RecommendationEngine` SHALL completar a construção sem lançar `ReferenceError`.
2. THE `RecommendationEngine` SHALL resolver o caminho do diretório `templates/` usando `new URL('.', import.meta.url).pathname` em substituição a `__dirname`.
3. WHEN o diretório `src/recommendations/templates/` existir e contiver arquivos `.yaml` válidos, THE `RecommendationEngine` SHALL carregar todos os templates no `templateCache` durante a construção.
4. THE `RecommendationEngine` SHALL manter a assinatura pública de todos os métodos existentes (`generate`, `formatAsMarkdown`, `getQuickFixCommands`, `getLoadedTemplateIds`, `hasTemplate`) sem alterações.

---

### Requirement 2: Migração para Logger Estruturado

**User Story:** Como desenvolvedor do EscapeKit, quero que o `RecommendationEngine` use o logger estruturado do projeto em vez de `console.warn`/`console.log`, para que os logs sejam consistentes com o restante da codebase e respeitem o nível de log configurado.

#### Acceptance Criteria

1. THE `RecommendationEngine` SHALL declarar `private readonly log = logger.child('RecommendationEngine')` como propriedade de classe.
2. WHEN o diretório `templates/` não for encontrado, THE `RecommendationEngine` SHALL emitir log de nível `warn` via `this.log.warn` em substituição ao `console.warn` existente.
3. WHEN os templates forem carregados com sucesso, THE `RecommendationEngine` SHALL emitir log de nível `info` via `this.log.info` em substituição ao `console.log` existente.
4. WHEN ocorrer erro durante o carregamento de templates, THE `RecommendationEngine` SHALL emitir log de nível `warn` via `this.log.warn` em substituição ao `console.warn` existente.
5. THE `RecommendationEngine` SHALL importar `logger` de `'../logger.js'` usando caminho relativo correto para o módulo ESM.

---

### Requirement 3: Preservação do Comportamento de Carregamento de Templates

**User Story:** Como usuário do EscapeKit, quero que a correção não altere o comportamento funcional do carregamento de templates, para que todas as recomendações existentes continuem sendo geradas corretamente.

#### Acceptance Criteria

1. WHEN o diretório `templates/` existir e contiver os quatro arquivos YAML padrão (`framework-mix.yaml`, `ghost-import.yaml`, `mock-api.yaml`, `phantom-dependency.yaml`), THE `RecommendationEngine` SHALL carregar todos os quatro templates no `templateCache`.
2. WHEN `getLoadedTemplateIds()` for chamado após construção bem-sucedida, THE `RecommendationEngine` SHALL retornar array contendo ao menos os ids `'framework-mix'`, `'ghost-import'`, `'mock-api'` e `'phantom-dependency'`.
3. WHEN o diretório `templates/` não existir, THE `RecommendationEngine` SHALL completar a construção sem lançar exceção, mantendo o `templateCache` vazio (degradação graciosa já existente).
4. WHEN `generate({ problemType: 'ghost-import' })` for invocado após construção bem-sucedida, THE `RecommendationEngine` SHALL retornar `Recommendation` com `id` igual a `'ghost-import'` e `steps` não vazio.
5. THE `loadTemplates` SHALL continuar usando a API síncrona de `fs` (`existsSync`, `readdirSync`, `readFileSync`), mantendo o carregamento no construtor como decisão de design documentada.

---

### Requirement 4: Compatibilidade com Testes Existentes

**User Story:** Como desenvolvedor do EscapeKit, quero que a correção não quebre os testes existentes do `RecommendationEngine`, para que a estabilidade da suite de testes seja mantida.

#### Acceptance Criteria

1. FOR ALL casos de teste em `tests/recommendations/recommendation-engine.test.ts`, o comportamento do `RecommendationEngine` após a correção SHALL ser equivalente ao comportamento esperado pelos testes existentes.
2. WHEN `new RecommendationEngine()` for invocado no contexto de testes Vitest (ambiente ESM), THE `RecommendationEngine` SHALL construir sem erro e carregar os templates corretamente.
3. THE `RecommendationEngine` SHALL manter o comportamento de retornar recomendação genérica com `id: 'generic-{problemType}'` para tipos de problema sem template correspondente.

---

### Requirement 5: Cobertura de Testes da Correção

**User Story:** Como desenvolvedor do EscapeKit, quero que a correção seja coberta por testes que verificam as propriedades de corretude, para que regressões futuras sejam detectadas automaticamente.

#### Acceptance Criteria

1. THE `tests/recommendations/RecommendationEngine.test.ts` SHALL conter teste que verifica que `new RecommendationEngine()` não lança exceção em ambiente ESM.
2. THE `tests/recommendations/RecommendationEngine.test.ts` SHALL conter teste que verifica que `getLoadedTemplateIds()` retorna array não vazio após construção bem-sucedida.
3. THE `tests/recommendations/RecommendationEngine.test.ts` SHALL conter teste que verifica degradação graciosa quando o diretório de templates não existe (construção sem exceção, `templateCache` vazio).
4. THE `tests/recommendations/RecommendationEngine.test.ts` SHALL conter teste que verifica que `generate({ problemType: 'ghost-import' })` retorna `Recommendation` com `id` definido e não `undefined`.
5. FOR ALL templates YAML presentes em `src/recommendations/templates/`, THE `tests/recommendations/RecommendationEngine.test.ts` SHALL verificar que o template correspondente é carregado no `templateCache` após construção.

