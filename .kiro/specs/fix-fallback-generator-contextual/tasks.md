# Implementation Plan

## Tasks

- [ ] 1. Criar os templates Handlebars em `templates/fallback/`
  - Criar diretório `templates/fallback/`
  - Criar `templates/fallback/three.hbs` com código Three.js usando `CSS2DRenderer` e `CSS2DObject`
  - Criar `templates/fallback/babylon.hbs` com código Babylon.js usando `NullEngine`, `Scene`, `FreeCamera`
  - Criar `templates/fallback/pixi.hbs` com código PixiJS usando `CanvasRenderer`, `Container`, `Text`
  - Criar `templates/fallback/r3f.hbs` com componente React usando `useRef`, `useEffect` e `<canvas>` 2D
  - Criar `templates/fallback/generic.hbs` substituindo o código hardcoded atual com variáveis `{{width}}`, `{{height}}`, `{{projectName}}`
  - Todos os templates devem exportar `checkWebGLSupport` e `setupFallback` com as mesmas assinaturas
  - Arquivos: `templates/fallback/*.hbs`

- [ ] 2. Adicionar `handlebars` como dependência do EscapeKit MCP
  - Verificar se `handlebars` já está em `dependencies` no `package.json` raiz do projeto
  - Se não estiver, adicionar `"handlebars": "^4.7.8"` em `dependencies`
  - Arquivo: `package.json`

- [ ] 3. Adicionar tipos locais e método `detectUIFramework` ao `FallbackGenerator`
  - Adicionar `type UIFramework = 'react' | 'vue' | 'svelte' | 'vanilla'` no topo do arquivo
  - Adicionar `interface TemplateContext { containerSelector: string; width: number; height: number; projectName: string; }` no topo do arquivo
  - Implementar `private async detectUIFramework(projectPath: string): Promise<UIFramework>`
  - Ler `package.json` do projeto alvo e verificar `dependencies` + `devDependencies`
  - Retornar `'react'` se `react` presente, `'vue'` se `vue` presente, `'svelte'` se `svelte` presente, `'vanilla'` caso contrário
  - Retornar `'vanilla'` em caso de exceção (package.json não encontrado)
  - Arquivo: `src/validate/auto-fix/FallbackGenerator.ts`

- [ ] 4. Implementar método `renderTemplate` com graceful degradation
  - Implementar `private async renderTemplate(library: string | null, context: TemplateContext): Promise<string | null>`
  - Usar `await import('handlebars')` dentro de try/catch para graceful degradation
  - Resolver o caminho do template usando `new URL('../../..', import.meta.url).pathname` + `templates/fallback/{library ?? 'generic'}.hbs`
  - Ler o arquivo `.hbs` com `readFile`
  - Compilar com `Handlebars.default.compile(source)` e renderizar com o `context`
  - Retornar `null` em qualquer exceção (módulo ausente, arquivo não encontrado, erro de compilação)
  - Arquivo: `src/validate/auto-fix/FallbackGenerator.ts`

- [ ] 5. Refatorar `generateFallbackCode` para usar templates com graceful degradation
  - Renomear o método atual `generateFallbackCode` para `generateHardcodedFallback` (preserva o código existente)
  - Criar novo método `private async generateFallbackCode(library: string | null, context: TemplateContext): Promise<string>`
  - Chamar `renderTemplate(library, context)` e retornar o resultado se não for `null`
  - Se `renderTemplate` retornar `null`, emitir `this.log.warn(...)` e chamar `generateHardcodedFallback(library)`
  - Arquivo: `src/validate/auto-fix/FallbackGenerator.ts`

- [ ] 6. Implementar método `integrateIntoEntryPoint`
  - Implementar `private async integrateIntoEntryPoint(projectPath: string, uiFramework: UIFramework): Promise<{ file?: string; note?: string }>`
  - Definir `candidatesByFramework` com os candidatos por framework conforme o design
  - Iterar pelos candidatos: verificar existência com `access`, ler conteúdo, checar presença de `from './utils/webgl-fallback'`
  - Se import já presente: retornar `{ file: candidate }` sem modificar (idempotência)
  - Se import ausente: prepend `import { checkWebGLSupport, setupFallback } from './utils/webgl-fallback';\n` ao conteúdo e escrever
  - Emitir `this.log.info(...)` ao integrar com sucesso
  - Se nenhum candidato encontrado: emitir `this.log.warn(...)` e retornar `{ note: '...' }`
  - Arquivo: `src/validate/auto-fix/FallbackGenerator.ts`

- [ ] 7. Estender o método `fix` para usar os novos métodos
  - Adicionar chamada a `detectUIFramework(projectPath)` logo após `detectWebGLLibrary`
  - Adicionar leitura de `projectName` do `package.json` com fallback para `'project'`
  - Construir o `TemplateContext` com `containerSelector: '#app'`, `width: 800`, `height: 600`, `projectName`
  - Atualizar chamada de `generateFallbackCode` para `await this.generateFallbackCode(webglLib, context)`
  - Adicionar chamada a `integrateIntoEntryPoint(projectPath, uiFramework)` após escrever o CSS
  - Atualizar o campo `description` do `Fix` retornado para o formato `"Generated WebGL fallback for {library} using template"`
  - Incluir a nota de integração no `description` quando `integration.note` estiver presente
  - Arquivo: `src/validate/auto-fix/FallbackGenerator.ts`

- [ ] 8. Escrever testes unitários para o `FallbackGenerator` refatorado
  - Criar `tests/validate/FallbackGenerator.test.ts`
  - Mockar `fs/promises` (`access`, `readFile`, `writeFile`, `mkdir`) para evitar I/O real
  - Mockar `import('handlebars')` para testar graceful degradation
  - **Detecção de UI framework:**
    - `react` em dependencies → `'react'`
    - `vue` em dependencies → `'vue'`
    - `svelte` em dependencies → `'svelte'`
    - Nenhum → `'vanilla'`
    - package.json ausente → `'vanilla'`
  - **Seleção de template:**
    - `webglLib === 'three'` → renderiza `three.hbs`
    - `webglLib === 'babylon'` → renderiza `babylon.hbs`
    - `webglLib === 'pixi'` → renderiza `pixi.hbs`
    - `webglLib === 'r3f'` → renderiza `r3f.hbs`
    - `webglLib === null` → renderiza `generic.hbs`
  - **Graceful degradation:**
    - Handlebars não disponível → usa hardcoded, `applied: true`, sem erro
    - Arquivo `.hbs` não encontrado → usa hardcoded, `applied: true`, sem erro
    - Log `warn` emitido em ambos os casos
  - **Integração ao entry point:**
    - React: tenta `src/App.tsx` primeiro
    - Vue: tenta `src/App.vue` primeiro
    - Svelte: tenta `src/App.svelte` primeiro
    - Vanilla: tenta `src/main.ts` primeiro
    - Import já presente → não duplica (idempotência)
    - Nenhum candidato encontrado → `applied: true` com nota no `description`
  - **P1:** projeto com `three` → código contém `CSS2DRenderer` ou `WebGLRenderer`
  - **P2:** projeto com `@react-three/fiber` → código contém `<` e `/>`
  - **P3:** `integrateIntoEntryPoint` duas vezes → mesmo resultado (idempotência)
  - **P4:** `fix` com `applied: true` → arquivo `src/utils/webgl-fallback.ts` criado
  - **P5:** sem Handlebars → `applied: true` com código genérico
  - **Comportamento existente:**
    - `fix` com exceção de I/O → `applied: false` com `error`
    - CSS file ainda é criado em `src/styles/webgl-fallback.css`
    - `description` contém o nome da biblioteca usada

- [ ] 9. Verificar diagnósticos e corrigir erros de tipo
  - Executar `getDiagnostics` em `src/validate/auto-fix/FallbackGenerator.ts`
  - Corrigir quaisquer erros de tipo TypeScript introduzidos pela mudança de `generateFallbackCode` para `async`
  - Verificar que `src/validate/auto-fix/AutoFixEngine.ts` não apresenta novos erros
  - Verificar que os tipos `UIFramework` e `TemplateContext` não conflitam com exports existentes
