# Design Document — EscapeKit Educational Mode

## Visão Geral

O EscapeKit Educational Mode transforma o processo de correção automática de código em uma experiência de aprendizado ativo. Em vez de corrigir silenciosamente os problemas detectados, o modo educacional explica cada decisão tomada, agrega estatísticas históricas de erros e sugere documentação relevante — tudo integrado ao fluxo de trabalho existente do EscapeKit.

O MVP introduz três capacidades ortogonais que se apoiam nos dados já produzidos pelo `EscapeContractWriter`:

1. **Flag `--explain`** — converte um `EscapeContract` em um relatório Markdown em linguagem natural (pt-BR), gerado pelo novo componente `ExplanationGenerator`.
2. **Comando `escapekit dashboard`** — agrega múltiplos contratos históricos em estatísticas de tendência, geradas pelo novo componente `DashboardAggregator` e renderizadas via `TemplateEngine`.
3. **Nível `educational`** — extensão do `--level` existente que combina as verificações do nível `thorough` com a geração de explicações e links educacionais contextualizados, orquestrada pelo novo `EducationalValidator`.

**Decisão de design central**: os dois novos componentes de processamento (`ExplanationGenerator` e `DashboardAggregator`) são funções puras — recebem dados, retornam dados, sem I/O. Toda a persistência e renderização é delegada às camadas existentes (`TemplateEngine`, `ProjectGenerator`, `EscapeContractWriter`). Isso garante testabilidade isolada e compatibilidade retroativa total.

---

## Arquitetura

O modo educacional se encaixa como uma camada adicional sobre o pipeline existente, sem modificar nenhum componente existente.

```mermaid
flowchart TD
    subgraph CLI["CLI (Commander.js)"]
        A[validate --explain] --> B[ValidationEngine]
        A --> C[ExplanationGenerator]
        D[validate --level educational] --> E[EducationalValidator]
        F[dashboard] --> G[DashboardAggregator]
    end

    subgraph Existente["Componentes Existentes"]
        B --> H[EscapeContractWriter]
        H --> I[".escapekit/contracts/<contractId>.json"]
        J[TemplateEngine]
        K[ProjectGenerator]
    end

    subgraph Novo["Novos Componentes"]
        C --> |EscapeContract| L["explanation.md (string)"]
        L --> J
        J --> M[".escapekit/explanation.md"]

        E --> B
        E --> C
        E --> N[EducationalLinkResolver]
        N --> O["links educacionais por tipo"]

        G --> |EscapeContract[]| P["DashboardStats (objeto)"]
        P --> J
        J --> Q[".escapekit/dashboard.md / .html"]
    end
```

### Princípios Arquiteturais

- **Sem modificações no schema existente**: `EscapeContract`, `DependencyResolution` e `CodeTransformation` permanecem inalterados.
- **Pureza dos novos componentes de processamento**: `ExplanationGenerator.generate()` e `DashboardAggregator.aggregate()` são funções puras (entrada → saída, sem I/O).
- **Reutilização do `TemplateEngine`**: toda renderização de templates Handlebars usa o `TemplateEngine` existente.
- **Extensão por composição**: `EducationalValidator` compõe `ValidationEngine` em vez de herdar, evitando acoplamento frágil.

---

## Componentes e Interfaces

### ExplanationGenerator

Converte um `EscapeContract` em uma string Markdown explicativa em pt-BR. Componente puro, sem I/O.

```typescript
interface ExplanationGeneratorOptions {
  includeEducationalLinks?: boolean; // default: false
}

interface TransformationExplanation {
  originalImport: string;
  resolvedPackage: string;
  explanation: string;          // frase em pt-BR
  confidenceWarning?: string;   // presente se confidence < 0.7
  reasoning?: string;           // de metadata.reasoning, se disponível
  educationalLinks?: string[];  // URLs, se includeEducationalLinks = true
}

interface ExplanationReport {
  contractId: string;
  timestamp: string;
  transformations: TransformationExplanation[];
  summary: {
    totalCorrections: number;
    lowConfidenceCount: number;
  };
}

class ExplanationGenerator {
  generate(contract: EscapeContract, options?: ExplanationGeneratorOptions): string;
  // Retorna string Markdown. Nunca lança exceção para contratos válidos.
  // Para contratos com zero transformações, retorna mensagem de ausência.
}
```

**Mapeamento de frases por `TransformationType`**:

| TransformationType | Template de frase |
|---|---|
| `IMPORT_REPLACEMENT` | `"Substituímos '<originalImport>' por '<resolvedPackage>' porque <razão>"` |
| `POLYFILL_INJECTION` | `"Injetamos um polyfill para '<resolvedPackage>' porque <razão>"` |
| `API_MIGRATION` | `"Migramos a chamada de API de '<originalImport>' para '<resolvedPackage>' porque <razão>"` |
| `CONFIGURATION_GENERATION` | `"Geramos configuração para '<resolvedPackage>' porque <razão>"` |

**Mapeamento de frases por `ResolutionMethod`**:

| ResolutionMethod | Texto incluído na explicação |
|---|---|
| `KNOWLEDGE_BASE` | `"baseado em mapeamento conhecido da base de conhecimento do EscapeKit"` |
| `SEMANTIC_ANALYSIS` | `"inferido por similaridade semântica — requer revisão manual"` |
| `NPM_SEARCH` | `"encontrado via busca no registro npm"` |
| `USER_PROVIDED` | `"fornecido manualmente pelo usuário"` |

---

### DashboardAggregator

Agrega um array de `EscapeContract` em um objeto de estatísticas. Componente puro, sem I/O.

```typescript
interface TransformationDistribution {
  type: TransformationType;
  count: number;
  percentage: number;
}

interface WeeklyTrend {
  currentWeek: number;
  previousWeek: number;
  direction: 'INCREASE' | 'DECREASE' | 'STABLE';
  percentageChange: number;
}

interface TopImport {
  originalImport: string;
  count: number;
}

interface ConfidenceByMethod {
  method: ResolutionMethod;
  averageConfidence: number;
  count: number;
}

interface DashboardStats {
  totalExecutions: number;           // === contracts.length
  totalCorrections: number;          // soma de todas as transformações
  distributionByType: TransformationDistribution[];
  topImports: TopImport[];           // top 5
  confidenceByMethod: ConfidenceByMethod[];
  weeklyTrend: WeeklyTrend;
  generatedAt: string;               // ISO 8601
}

class DashboardAggregator {
  aggregate(contracts: EscapeContract[]): DashboardStats;
  // Para array vazio, retorna stats com zeros e trend STABLE.
  // Ignora silenciosamente contratos malformados (sem lançar exceção).
}
```

---

### EducationalLinkResolver

Resolve links educacionais por tipo de correção. Componente puro.

```typescript
interface EducationalLink {
  url: string;
  label: string;
  type: 'NPM' | 'TYPESCRIPT_DOCS' | 'MDN';
}

class EducationalLinkResolver {
  resolve(resolution: DependencyResolution, transformationType: TransformationType): EducationalLink[];
}
```

**Tabela de mapeamento de links**:

| Condição | URL gerada |
|---|---|
| `IMPORT_REPLACEMENT` + pacote npm | `https://www.npmjs.com/package/<resolvedPackage>` |
| Qualquer correção TypeScript (tsconfig, tipos) | `https://www.typescriptlang.org/docs/` |
| Web API (WebGL, Canvas, Fetch, etc.) | `https://developer.mozilla.org/` |

A detecção de "correção TypeScript" é feita verificando se `resolvedPackage` contém `typescript`, `@types/`, ou se `appliedRules` contém regras com tag `typescript`. A detecção de "Web API" verifica se `originalImport` ou `resolvedPackage` corresponde a padrões conhecidos (`webgl`, `canvas`, `fetch`, `indexeddb`, etc.).

---

### EducationalValidator

Orquestra o nível `educational` de validação, compondo `ValidationEngine` com `ExplanationGenerator` e `EducationalLinkResolver`.

```typescript
interface EducationalValidationResult {
  validationResult: ValidationResult;    // resultado completo do ValidationEngine (thorough)
  explanationReport: string;             // Markdown gerado pelo ExplanationGenerator
  educationalLinks: EducationalLink[];   // links gerados pelo EducationalLinkResolver
  contractPath: string;                  // caminho do contrato salvo
  summary: {
    correctionsApplied: number;
    educationalLinksGenerated: number;
    reportPath: string;
  };
}

class EducationalValidator {
  constructor(
    private readonly validationEngine: ValidationEngine,
    private readonly explanationGenerator: ExplanationGenerator,
    private readonly linkResolver: EducationalLinkResolver,
    private readonly contractWriter: EscapeContractWriter,
    private readonly templateEngine: TemplateEngine
  )

  async validate(
    projectPath: string,
    options?: Partial<ValidationOptions>
  ): Promise<EducationalValidationResult>;
}
```

---

### Templates Handlebars

Dois novos templates serão adicionados ao diretório `templates/`:

**`templates/explanation.md.hbs`** — template para o relatório explicativo:
```handlebars
# Relatório Explicativo EscapeKit
**Data/Hora:** {{timestamp}}
**Contrato:** {{contractId}}

## Transformações Aplicadas
{{#each transformations}}
### {{@index}}. {{originalImport}} → {{resolvedPackage}}
{{explanation}}
{{#if confidenceWarning}}
> ⚠️ {{confidenceWarning}}
{{/if}}
{{#if reasoning}}
**Raciocínio:** {{reasoning}}
{{/if}}
{{#if educationalLinks}}
**Leia mais:**
{{#each educationalLinks}}
- {{this}}
{{/each}}
{{/if}}
{{/each}}

## Resumo
- Total de correções: {{summary.totalCorrections}}
- Correções de baixa confiança: {{summary.lowConfidenceCount}}
```

**`templates/dashboard.md.hbs`** e **`templates/dashboard.html.hbs`** — templates para o dashboard de estatísticas.

---

### Extensão da CLI

**Flag `--explain`** adicionada ao comando `validate`:
```
escapekit validate <projeto> --explain [--output <caminho>]
```

**Novo comando `dashboard`**:
```
escapekit dashboard [--format html|md] [--output <caminho>] [--contracts-dir <dir>]
```

**Novo nível `educational`** no `--level`:
```
escapekit validate <projeto> --level educational
```

---

## Modelos de Dados

Os modelos existentes (`EscapeContract`, `DependencyResolution`, `CodeTransformation`, `TransformationType`, `ResolutionMethod`) são reutilizados sem modificação.

Novos tipos introduzidos:

```typescript
// src/educational/types.ts

export interface ExplanationReport { /* ver acima */ }
export interface TransformationExplanation { /* ver acima */ }
export interface DashboardStats { /* ver acima */ }
export interface WeeklyTrend { /* ver acima */ }
export interface TopImport { /* ver acima */ }
export interface ConfidenceByMethod { /* ver acima */ }
export interface EducationalLink { /* ver acima */ }
export interface EducationalValidationResult { /* ver acima */ }
```

**Estrutura de diretórios dos contratos**:
```
.escapekit/
  contracts/
    <contractId>.json    ← um arquivo por execução
  explanation.md         ← gerado por --explain ou --level educational
  dashboard.md           ← gerado por escapekit dashboard
  dashboard.html         ← gerado por escapekit dashboard --format html
```

**Schema do contrato** (sem alterações — compatibilidade retroativa garantida):
```typescript
// EscapeContract permanece idêntico ao definido em src/models/transformation.ts
// Nenhum campo novo é adicionado ao schema existente.
```

---


## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma afirmação formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

---

### Propriedade 1: ExplanationGenerator é puro e determinístico

*Para qualquer* `EscapeContract` válido, chamar `ExplanationGenerator.generate(contract)` duas vezes com o mesmo contrato deve produzir saídas idênticas. O contrato original não deve ser modificado após a chamada.

**Valida: Requisitos 6.1, 6.6, 1.7**

---

### Propriedade 2: Cobertura de transformações no relatório

*Para qualquer* `EscapeContract` com N transformações registradas (N ≥ 1), o relatório gerado pelo `ExplanationGenerator` deve conter pelo menos N frases explicativas distintas — uma por transformação — e o campo `summary.totalCorrections` deve ser igual a N.

**Valida: Requisitos 1.2, 1.4**

---

### Propriedade 3: Aviso de baixa confiança

*Para qualquer* `DependencyResolution` com `confidence < 0.7`, a explicação gerada pelo `ExplanationGenerator` para aquela resolução deve conter um aviso explícito de baixa confiança.

**Valida: Requisito 1.3**

---

### Propriedade 4: Imutabilidade do contrato

*Para qualquer* `EscapeContract` passado ao `ExplanationGenerator.generate()`, o objeto contrato deve ser estruturalmente idêntico antes e depois da chamada (deep equality).

**Valida: Requisito 1.7**

---

### Propriedade 5: Mapeamento de ResolutionMethod para texto

*Para qualquer* `DependencyResolution` com um `ResolutionMethod` definido (`KNOWLEDGE_BASE`, `SEMANTIC_ANALYSIS`, `NPM_SEARCH`, `USER_PROVIDED`), a explicação gerada deve conter o texto descritivo correspondente ao método de resolução conforme a tabela de mapeamento definida no design.

**Valida: Requisitos 2.2, 2.3, 2.4**

---

### Propriedade 6: Inclusão de metadata.reasoning

*Para qualquer* `DependencyResolution` que possua `metadata.reasoning` preenchido (string não vazia), a explicação gerada pelo `ExplanationGenerator` deve conter esse texto de raciocínio.

**Valida: Requisito 2.5**

---

### Propriedade 7: DashboardAggregator é puro e totalExecutions correto

*Para qualquer* array de N `EscapeContract` (N ≥ 0) passado ao `DashboardAggregator.aggregate()`, o objeto `DashboardStats` retornado deve ter `totalExecutions === N`, `totalCorrections >= 0`, e chamar `aggregate()` duas vezes com o mesmo array deve produzir resultados idênticos.

**Valida: Requisitos 6.2, 6.4, 3.2**

---

### Propriedade 8: Campos obrigatórios do DashboardStats

*Para qualquer* array não vazio de `EscapeContract` passado ao `DashboardAggregator`, o objeto retornado deve conter todos os campos obrigatórios: `totalExecutions`, `totalCorrections`, `distributionByType` (array), `topImports` (array com no máximo 5 elementos), `confidenceByMethod` (array), e `weeklyTrend` com campo `direction` em `['INCREASE', 'DECREASE', 'STABLE']`.

**Valida: Requisito 3.2, 3.3**

---

### Propriedade 9: Robustez do DashboardAggregator com entradas inválidas

*Para qualquer* array de objetos onde alguns são contratos JSON inválidos (malformados), o `DashboardAggregator` deve processar apenas os contratos válidos sem lançar exceção, e `totalExecutions` deve refletir apenas os contratos válidos processados.

**Valida: Requisito 3.8**

---

### Propriedade 10: Links educacionais corretos por tipo de correção

*Para qualquer* `DependencyResolution` com `TransformationType.IMPORT_REPLACEMENT`, o `EducationalLinkResolver` deve retornar pelo menos um link com URL `https://www.npmjs.com/package/<resolvedPackage>`. Para correções TypeScript, deve retornar link para `https://www.typescriptlang.org/docs/`. Para Web APIs, deve retornar link para `https://developer.mozilla.org/`.

**Valida: Requisitos 4.3, 4.4, 4.5**

---

### Propriedade 11: Cobertura de links educacionais por transformação

*Para qualquer* `EscapeContract` com N tipos de correção distintos processado pelo `EducationalValidator`, o relatório gerado deve conter pelo menos N links educacionais — um por tipo de correção aplicada.

**Valida: Requisito 4.2**

---

### Propriedade 12: Persistência de contratos no caminho correto

*Para qualquer* execução do EscapeKit com `--explain` ou `--level educational` que produza um contrato com `contractId`, o arquivo `.escapekit/contracts/<contractId>.json` deve existir após a execução e ser deserializável como `EscapeContract` válido.

**Valida: Requisitos 5.1, 5.3**

---

### Propriedade 13: ExplanationGenerator retorna string não vazia para qualquer contrato válido

*Para qualquer* `EscapeContract` válido (incluindo contratos com zero transformações), `ExplanationGenerator.generate()` deve retornar uma string não vazia sem lançar exceção. Para contratos com zero transformações, a string deve conter a mensagem de ausência de correções.

**Valida: Requisitos 6.3, 6.5, 1.5**

---

## Tratamento de Erros

| Cenário | Componente | Comportamento |
|---|---|---|
| Contrato JSON inválido em `.escapekit/contracts/` | `DashboardAggregator` | Ignora o arquivo, registra aviso no log, continua processando os demais |
| Falha de escrita do contrato em disco | CLI / `EscapeContractWriter` | Registra erro no log, continua a execução principal sem interromper |
| Falha de escrita do relatório explicativo | CLI | Registra erro no log, exibe mensagem ao usuário, encerra com código 1 |
| Contrato com zero transformações passado ao `ExplanationGenerator` | `ExplanationGenerator` | Retorna string com mensagem de ausência, sem exceção |
| Array vazio passado ao `DashboardAggregator` | `DashboardAggregator` | Retorna `DashboardStats` com zeros e `weeklyTrend.direction = 'STABLE'` |
| Diretório `.escapekit/contracts/` inexistente no `dashboard` | CLI | Exibe mensagem `"Nenhum histórico encontrado..."` e encerra com código 0 |
| `confidence` fora do intervalo [0, 1] | `ExplanationGenerator` | Trata como baixa confiança se < 0.7, sem lançar exceção |
| Template Handlebars não encontrado | `TemplateEngine` | Lança `FileSystemError` — propagado para a CLI que exibe mensagem de erro |
| `resolvedPackage` vazio em `IMPORT_REPLACEMENT` | `EducationalLinkResolver` | Omite o link npm, não lança exceção |

---

## Estratégia de Testes

### Abordagem Dual

A estratégia combina testes de exemplo (unit tests) para comportamentos específicos e testes de propriedade (property-based tests) para invariantes universais.

- **Testes de exemplo**: verificam casos concretos, integração de CLI, casos de borda e condições de erro.
- **Testes de propriedade**: verificam invariantes que devem valer para qualquer entrada válida, usando geração aleatória de dados.

### Testes de Exemplo (Unit Tests)

Verificam comportamentos específicos e integração:

1. `ExplanationGenerator` com contrato de zero transformações retorna mensagem de ausência
2. `ExplanationGenerator` com contrato de uma transformação `IMPORT_REPLACEMENT` retorna frase no formato correto
3. `DashboardAggregator` com array vazio retorna stats com zeros
4. `EducationalLinkResolver` com `IMPORT_REPLACEMENT` para `axios` retorna `https://www.npmjs.com/package/axios`
5. CLI `escapekit validate --explain` gera arquivo em `.escapekit/explanation.md`
6. CLI `escapekit dashboard --format html` gera arquivo `.escapekit/dashboard.html`
7. CLI `escapekit dashboard` sem contratos exibe mensagem e encerra com código 0
8. `DashboardAggregator` ignora arquivo JSON inválido sem lançar exceção

### Testes de Propriedade (Property-Based Tests)

Biblioteca: **fast-check** (já presente no projeto como dependência).

Cada teste deve rodar mínimo **100 iterações**. Cada teste deve referenciar a propriedade do design com o formato:

```
// Feature: escapekit-educational-mode, Property N: <texto da propriedade>
```

| Propriedade | Descrição do teste | Tag |
|---|---|---|
| Property 1 | Para qualquer contrato válido gerado aleatoriamente, `generate(contract)` duas vezes produz saídas idênticas e o contrato não é mutado | `Feature: escapekit-educational-mode, Property 1: ExplanationGenerator puro e determinístico` |
| Property 2 | Para qualquer contrato com N transformações (N ≥ 1), o relatório contém N explicações e summary.totalCorrections === N | `Feature: escapekit-educational-mode, Property 2: cobertura de transformações` |
| Property 3 | Para qualquer resolução com confidence < 0.7, a explicação contém aviso de baixa confiança | `Feature: escapekit-educational-mode, Property 3: aviso de baixa confiança` |
| Property 5 | Para qualquer ResolutionMethod, a explicação contém o texto descritivo correspondente | `Feature: escapekit-educational-mode, Property 5: mapeamento ResolutionMethod para texto` |
| Property 6 | Para qualquer resolução com metadata.reasoning preenchido, a explicação contém esse texto | `Feature: escapekit-educational-mode, Property 6: inclusão de metadata.reasoning` |
| Property 7 | Para qualquer array de N contratos, totalExecutions === N e aggregate() é determinístico | `Feature: escapekit-educational-mode, Property 7: DashboardAggregator puro e totalExecutions correto` |
| Property 8 | Para qualquer array não vazio, DashboardStats contém todos os campos obrigatórios com valores válidos | `Feature: escapekit-educational-mode, Property 8: campos obrigatórios do DashboardStats` |
| Property 9 | Para qualquer array com entradas inválidas misturadas, aggregate() não lança exceção | `Feature: escapekit-educational-mode, Property 9: robustez com entradas inválidas` |
| Property 10 | Para qualquer IMPORT_REPLACEMENT, link npm é gerado com resolvedPackage correto | `Feature: escapekit-educational-mode, Property 10: links educacionais corretos por tipo` |
| Property 13 | Para qualquer contrato válido, generate() retorna string não vazia sem lançar exceção | `Feature: escapekit-educational-mode, Property 13: string não vazia para qualquer contrato válido` |

### Exemplo de Teste de Propriedade (TypeScript)

```typescript
import * as fc from 'fast-check';
import { ExplanationGenerator } from '../src/educational/ExplanationGenerator.js';
import { arbitraryEscapeContract } from './fixtures/arbitraries.js';

const generator = new ExplanationGenerator();

// Feature: escapekit-educational-mode, Property 1: ExplanationGenerator puro e determinístico
test('Property 1: ExplanationGenerator é puro e determinístico', () => {
  fc.assert(
    fc.property(arbitraryEscapeContract(), (contract) => {
      const contractCopy = JSON.parse(JSON.stringify(contract));
      const result1 = generator.generate(contract);
      const result2 = generator.generate(contract);
      // Determinismo
      expect(result1).toBe(result2);
      // Imutabilidade
      expect(contract).toEqual(contractCopy);
    }),
    { numRuns: 100 }
  );
});

// Feature: escapekit-educational-mode, Property 7: DashboardAggregator puro e totalExecutions correto
test('Property 7: totalExecutions === array.length', () => {
  fc.assert(
    fc.property(fc.array(arbitraryEscapeContract(), { minLength: 0, maxLength: 50 }), (contracts) => {
      const stats = aggregator.aggregate(contracts);
      expect(stats.totalExecutions).toBe(contracts.length);
      expect(stats.totalCorrections).toBeGreaterThanOrEqual(0);
    }),
    { numRuns: 100 }
  );
});
```

### Localização dos Testes

```
tests/
  educational/
    ExplanationGenerator.pbt.test.ts   ← testes de propriedade
    ExplanationGenerator.test.ts       ← testes de exemplo
    DashboardAggregator.pbt.test.ts    ← testes de propriedade
    DashboardAggregator.test.ts        ← testes de exemplo
    EducationalLinkResolver.test.ts    ← testes de exemplo
    EducationalValidator.test.ts       ← testes de integração
  fixtures/
    arbitraries.ts                     ← geradores fast-check para EscapeContract
```
