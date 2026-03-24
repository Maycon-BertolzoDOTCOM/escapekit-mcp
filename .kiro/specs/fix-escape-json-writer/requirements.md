# Requirements Document

## Introduction

O `EscapeJsonWriter` é o componente responsável por gerar o arquivo `escape.json`, a "certidão de nascimento digital" de projetos analisados pelo EscapeKit MCP. O arquivo documenta proveniência, transformações, validações e informações de soberania de forma rastreável. O componente está implementado em `src/generators/EscapeJsonWriter.ts.disabled` mas foi desabilitado por um erro de sintaxe TypeScript na assinatura do método `buildValidations` — o parâmetro `timestamp: string` não possui vírgula separando-o do parâmetro anterior, causando falha de compilação. Adicionalmente, o método `inferFixMethod` usa `issue: any`, violando as regras de lint do projeto. Esta feature reabilita o `EscapeJsonWriter`, corrige os erros de tipo, substitui o `any` pelo tipo correto (`Issue` de `src/models/schemas.ts`), reconecta as exportações em `src/generators/index.ts` e verifica a integração com o pipeline de geração em `src/tools/generate.ts`.

## Glossary

- **EscapeJsonWriter**: Componente em `src/generators/EscapeJsonWriter.ts` (atualmente `.disabled`) que gera documentos `escape.json` no protocolo v1.0.
- **EscapeJson**: Interface TypeScript em `src/models/escape-json-schema.ts` que define a estrutura completa do arquivo `escape.json`.
- **EscapeJsonParams**: Interface que define os parâmetros de entrada do método `generate` do `EscapeJsonWriter`.
- **Issue**: Interface em `src/models/schemas.ts` que representa um problema detectado durante análise, com campos `type`, `severity`, `message`, `fixed`, entre outros.
- **AnalysisResult**: Interface em `src/models/schemas.ts` que agrega o resultado completo de uma análise, incluindo `analysisId`, `issues[]` e `summary`.
- **buildValidations**: Método privado do `EscapeJsonWriter` que constrói a seção `validations` do `EscapeJson` a partir de `kiwiTestRunId`, `testResults` e `timestamp`.
- **inferFixMethod**: Método privado do `EscapeJsonWriter` que infere o `FixMethod` a partir do tipo de um `Issue`.
- **TransformationPipeline**: Componente em `src/generators/TransformationPipeline.ts` que orquestra o pipeline de transformação de código.
- **GenerateOptions**: Interface em `src/tools/generate.ts` que define as opções do pipeline de geração, incluindo `generateEscapeJson`.
- **ProjectGenerator**: Componente em `src/generators/ProjectGenerator.ts` que gera a estrutura de arquivos do projeto de saída.

---

## Requirements

### Requirement 1: Reabilitação do Arquivo EscapeJsonWriter

**User Story:** Como desenvolvedor do EscapeKit, quero que o `EscapeJsonWriter` seja reabilitado como módulo TypeScript válido, para que o componente possa ser importado e usado no pipeline de geração.

#### Acceptance Criteria

1. THE `EscapeJsonWriter` SHALL existir como arquivo TypeScript válido em `src/generators/EscapeJsonWriter.ts` (sem sufixo `.disabled`).
2. WHEN `getDiagnostics` for executado em `src/generators/EscapeJsonWriter.ts`, THE `TypeScript_Compiler` SHALL reportar zero erros de tipo ou sintaxe.
3. THE `src/generators/index.ts` SHALL exportar `EscapeJsonWriter` e `EscapeJsonParams` sem comentários de desabilitação.
4. WHEN `import { EscapeJsonWriter } from '../generators/index.js'` for executado em um módulo ESM, THE `EscapeJsonWriter` SHALL ser importável sem erros de runtime.

---

### Requirement 2: Correção do Erro de Tipo em `buildValidations`

**User Story:** Como desenvolvedor do EscapeKit, quero que a assinatura do método `buildValidations` seja sintaticamente válida em TypeScript, para que o compilador aceite o arquivo sem erros.

#### Acceptance Criteria

1. THE método `buildValidations` SHALL ter assinatura com os três parâmetros `kiwiTestRunId?: number`, `testResults?: TestResultsSummary` e `timestamp: string` corretamente separados por vírgulas.
2. WHEN `buildValidations` for chamado com apenas `timestamp` fornecido, THE `EscapeJsonWriter` SHALL retornar um objeto `Validations` com `overallStatus: 'pending'` e contadores zerados.
3. WHEN `buildValidations` for chamado com `testResults` contendo `failed > 0`, THE `EscapeJsonWriter` SHALL retornar `Validations` com `overallStatus: 'partial'`.
4. WHEN `buildValidations` for chamado com `testResults` contendo `failed === 0`, THE `EscapeJsonWriter` SHALL retornar `Validations` com `overallStatus: 'passed'`.

---

### Requirement 3: Substituição de `any` em `inferFixMethod`

**User Story:** Como desenvolvedor do EscapeKit, quero que o método `inferFixMethod` use o tipo correto para o parâmetro `issue`, para que o código esteja em conformidade com as regras de lint do projeto e o TypeScript possa verificar o acesso a `issue.type`.

#### Acceptance Criteria

1. THE método `inferFixMethod` SHALL declarar o parâmetro `issue` com o tipo `Issue` importado de `'../models/schemas.js'`.
2. WHEN `getDiagnostics` for executado em `src/generators/EscapeJsonWriter.ts`, THE `TypeScript_Compiler` SHALL não reportar warnings de `@typescript-eslint/no-explicit-any` relacionados ao método `inferFixMethod`.
3. WHEN `inferFixMethod` for chamado com um `Issue` de `type: 'ghost_import'`, THE `EscapeJsonWriter` SHALL retornar `'REPLACED_WITH_REAL_PACKAGE'`.
4. WHEN `inferFixMethod` for chamado com um `Issue` de `type: 'mock_api'`, THE `EscapeJsonWriter` SHALL retornar `'REPLACED_WITH_POLYFILL'`.
5. WHEN `inferFixMethod` for chamado com um `Issue` de tipo não mapeado, THE `EscapeJsonWriter` SHALL retornar `'REPLACED_WITH_REAL_PACKAGE'` como valor padrão.

---

### Requirement 4: Integração com o Pipeline de Geração

**User Story:** Como usuário do EscapeKit, quero que o comando `generate` produza um arquivo `escape.json` quando a opção `--escape-json` estiver ativa, para que o projeto gerado inclua sua certidão de nascimento digital.

#### Acceptance Criteria

1. WHEN `generateEscapeKit` for invocado com `options.generateEscapeJson !== false`, THE `generate_pipeline` SHALL instanciar `EscapeJsonWriter` e chamar `generate(params)` com os dados da análise.
2. WHEN `generateEscapeKit` for invocado com `dryRun: false` e `generateEscapeJson: true`, THE `generate_pipeline` SHALL escrever o arquivo `escape.json` no diretório de saída via `EscapeJsonWriter.writeToFile`.
3. WHEN `generateEscapeKit` for invocado com `generateEscapeJson: false`, THE `generate_pipeline` SHALL não criar o arquivo `escape.json`.
4. IF `EscapeJsonWriter.writeToFile` lançar `FileSystemError`, THEN THE `generate_pipeline` SHALL registrar o erro no log e continuar a geração sem interromper o pipeline.
5. THE `EscapeKit` retornado por `generateEscapeKit` SHALL incluir `'escape.json'` na lista `filesCreated` quando o arquivo for gerado com sucesso.

---

### Requirement 5: Geração de Documento EscapeJson Consistente

**User Story:** Como usuário do EscapeKit, quero que o `EscapeJsonWriter` produza documentos `escape.json` com dados internamente consistentes, para que o arquivo seja confiável como registro de auditoria.

#### Acceptance Criteria

1. WHEN `generate(params)` for invocado, THE `EscapeJsonWriter` SHALL retornar `EscapeJson` com `escapeId === params.analysisResult.analysisId`.
2. WHEN `generate(params)` for invocado, THE `EscapeJsonWriter` SHALL retornar `EscapeJson` com `analysis.totalIssues === params.analysisResult.issues.length`.
3. WHEN `generate(params)` for invocado, THE `EscapeJsonWriter` SHALL retornar `EscapeJson` com `transformations.totalTransformations === transformations.applied.length`.
4. WHEN `generate(params)` for invocado com qualquer `EscapeJsonParams` válido, THE `EscapeJsonWriter` SHALL retornar sem lançar exceção.
5. THE `EscapeJsonWriter` SHALL incluir o campo `$schema` apontando para o schema oficial do protocolo escape.json v1.0 em todos os documentos gerados.

---

### Requirement 6: Persistência e Parseabilidade do Arquivo escape.json

**User Story:** Como desenvolvedor do EscapeKit, quero que o arquivo `escape.json` escrito em disco seja um JSON válido e parseável, para que ferramentas externas possam consumir o arquivo sem erros.

#### Acceptance Criteria

1. WHEN `writeToFile(escapeJson, path)` for invocado com um `EscapeJson` válido, THE `EscapeJsonWriter` SHALL criar o arquivo no caminho especificado com conteúdo JSON formatado com indentação de 2 espaços.
2. WHEN o arquivo `escape.json` for lido e parseado via `JSON.parse`, THE resultado SHALL ser estruturalmente equivalente ao `EscapeJson` original passado para `writeToFile`.
3. IF o diretório de destino não existir ou a escrita falhar, THEN THE `EscapeJsonWriter` SHALL lançar `FileSystemError` com mensagem descritiva contendo o caminho do arquivo.
4. FOR ALL `EscapeJson` válidos, `JSON.parse(JSON.stringify(escapeJson))` SHALL produzir objeto equivalente ao original (propriedade de round-trip de serialização).
