# Requirements Document

## Introduction

O `FallbackGenerator` (`src/validate/auto-fix/FallbackGenerator.ts`) gera o arquivo `src/utils/webgl-fallback.ts` quando WebGL não está disponível, mas possui dois problemas críticos: (1) apenas a biblioteca Three.js tem um template específico — Babylon.js, PixiJS, React Three Fiber e qualquer outra biblioteca caem em um fallback genérico com texto hardcoded `"WebGL not supported - 2D fallback active"`; (2) o arquivo gerado nunca é importado em nenhum lugar do projeto do usuário, tornando o fallback inoperante em tempo de execução.

Esta melhoria substitui o código hardcoded por templates Handlebars por biblioteca, adiciona detecção do framework UI do projeto, e implementa integração automática do fallback ao entry point do projeto. O comportamento existente é preservado via graceful degradation quando Handlebars não estiver disponível.

## Glossary

- **FallbackGenerator**: Componente em `src/validate/auto-fix/FallbackGenerator.ts` que implementa a interface `Fixer` e gera código de fallback WebGL.
- **Fixer**: Interface em `src/validate/types.ts` com o método `fix(projectPath: string, issue: Issue): Promise<Fix>`.
- **Fix**: Tipo em `src/validate/types.ts` representando o resultado de uma operação de auto-fix.
- **Issue**: Tipo em `src/validate/types.ts` representando um problema detectado durante a validação.
- **WebGL_Library**: Biblioteca 3D/WebGL detectada no `package.json` do projeto alvo. Valores possíveis: `'three'`, `'babylon'`, `'pixi'`, `'r3f'`, `null`.
- **UI_Framework**: Framework de UI detectado no `package.json` do projeto alvo. Valores possíveis: `'react'`, `'vue'`, `'svelte'`, `'vanilla'`.
- **Fallback_File**: Arquivo `src/utils/webgl-fallback.ts` gerado pelo `FallbackGenerator` no projeto alvo.
- **Entry_Point**: Arquivo de entrada do projeto alvo onde o import do fallback é adicionado.
- **Template**: Arquivo Handlebars (`.hbs`) em `templates/fallback/` que define o conteúdo do Fallback_File para uma biblioteca específica.
- **Handlebars**: Biblioteca de templates (`handlebars` npm package) usada para renderizar os Templates com variáveis do projeto.
- **TemplateContext**: Objeto com as variáveis disponíveis nos Templates: `containerSelector`, `width`, `height`, `projectName`.
- **AutoFixEngine**: Orquestrador em `src/validate/auto-fix/AutoFixEngine.ts` que instancia e invoca fixers.

---

## Requirements

### Requirement 1: Templates Handlebars por Biblioteca WebGL

**User Story:** Como usuário do EscapeKit com projeto Three.js, Babylon.js, PixiJS ou React Three Fiber, quero que o fallback gerado use a API nativa de fallback da minha biblioteca, para que o código gerado seja idiomático e funcional.

#### Acceptance Criteria

1. THE `FallbackGenerator` SHALL criar o arquivo `templates/fallback/three.hbs` com código de fallback usando `CSS2DRenderer` ou `WebGLRenderer` do Three.js.
2. THE `FallbackGenerator` SHALL criar o arquivo `templates/fallback/babylon.hbs` com código de fallback usando `NullEngine` do Babylon.js.
3. THE `FallbackGenerator` SHALL criar o arquivo `templates/fallback/pixi.hbs` com código de fallback usando `CanvasRenderer` nativo do PixiJS.
4. THE `FallbackGenerator` SHALL criar o arquivo `templates/fallback/r3f.hbs` com código de fallback usando um componente React com `<canvas>` 2D para React Three Fiber.
5. THE `FallbackGenerator` SHALL criar o arquivo `templates/fallback/generic.hbs` com código de fallback canvas 2D genérico, substituindo o código hardcoded atual.
6. WHEN a WebGL_Library detectada for `'three'`, THE `FallbackGenerator` SHALL renderizar `templates/fallback/three.hbs` para gerar o Fallback_File.
7. WHEN a WebGL_Library detectada for `'babylon'`, THE `FallbackGenerator` SHALL renderizar `templates/fallback/babylon.hbs` para gerar o Fallback_File.
8. WHEN a WebGL_Library detectada for `'pixi'`, THE `FallbackGenerator` SHALL renderizar `templates/fallback/pixi.hbs` para gerar o Fallback_File.
9. WHEN a WebGL_Library detectada for `'r3f'`, THE `FallbackGenerator` SHALL renderizar `templates/fallback/r3f.hbs` para gerar o Fallback_File.
10. WHEN a WebGL_Library detectada for `null`, THE `FallbackGenerator` SHALL renderizar `templates/fallback/generic.hbs` para gerar o Fallback_File.
11. WHEN o template for renderizado com sucesso, THE `FallbackGenerator` SHALL retornar `Fix` com `description` no formato `"Generated WebGL fallback for {library} using template"`.

---

### Requirement 2: Variáveis de Template

**User Story:** Como usuário do EscapeKit, quero que o código de fallback gerado use as configurações reais do meu projeto, para que o fallback seja funcional sem edição manual.

#### Acceptance Criteria

1. THE `FallbackGenerator` SHALL passar ao template a variável `containerSelector` com o valor padrão `'#app'`.
2. THE `FallbackGenerator` SHALL passar ao template a variável `width` com o valor padrão `800`.
3. THE `FallbackGenerator` SHALL passar ao template a variável `height` com o valor padrão `600`.
4. THE `FallbackGenerator` SHALL passar ao template a variável `projectName` lida do campo `name` do `package.json` do projeto alvo.
5. WHEN o `package.json` não existir ou não contiver o campo `name`, THE `FallbackGenerator` SHALL usar `'project'` como valor padrão para `projectName`.
6. THE `FallbackGenerator` SHALL usar `Handlebars.compile()` para renderizar os templates com o TemplateContext.

---

### Requirement 3: Detecção do Framework UI

**User Story:** Como usuário do EscapeKit, quero que o `FallbackGenerator` detecte o framework UI do meu projeto, para que o template correto seja selecionado e a integração ao entry point seja feita no arquivo adequado.

#### Acceptance Criteria

1. WHEN o `package.json` do projeto alvo contiver `react` em `dependencies` ou `devDependencies`, THE `FallbackGenerator` SHALL identificar o UI_Framework como `'react'`.
2. WHEN o `package.json` do projeto alvo contiver `vue` em `dependencies` ou `devDependencies`, THE `FallbackGenerator` SHALL identificar o UI_Framework como `'vue'`.
3. WHEN o `package.json` do projeto alvo contiver `svelte` em `dependencies` ou `devDependencies`, THE `FallbackGenerator` SHALL identificar o UI_Framework como `'svelte'`.
4. WHEN nenhum dos frameworks acima for detectado, THE `FallbackGenerator` SHALL identificar o UI_Framework como `'vanilla'`.
5. THE `FallbackGenerator` SHALL usar o UI_Framework detectado para selecionar os candidatos de Entry_Point na integração ao entry point.
6. WHEN a WebGL_Library for `'r3f'`, THE `FallbackGenerator` SHALL usar o template `r3f.hbs` independentemente do UI_Framework detectado, pois R3F implica React.

---

### Requirement 4: Integração ao Entry Point

**User Story:** Como usuário do EscapeKit, quero que o import do fallback seja adicionado automaticamente ao entry point do meu projeto, para que o fallback seja executado quando WebGL não estiver disponível.

#### Acceptance Criteria

1. WHEN o UI_Framework for `'react'`, THE `FallbackGenerator` SHALL procurar o Entry_Point na seguinte ordem: `src/App.tsx`, `src/App.jsx`, `src/main.tsx`, `src/main.jsx`.
2. WHEN o UI_Framework for `'vue'`, THE `FallbackGenerator` SHALL procurar o Entry_Point na seguinte ordem: `src/App.vue`, `src/main.ts`, `src/main.js`.
3. WHEN o UI_Framework for `'svelte'`, THE `FallbackGenerator` SHALL procurar o Entry_Point na seguinte ordem: `src/App.svelte`, `src/main.ts`.
4. WHEN o UI_Framework for `'vanilla'`, THE `FallbackGenerator` SHALL procurar o Entry_Point na seguinte ordem: `src/main.ts`, `src/index.ts`, `src/main.js`, `src/index.js`.
5. WHEN o Entry_Point for encontrado, THE `FallbackGenerator` SHALL adicionar a seguinte linha no topo do arquivo: `import { checkWebGLSupport, setupFallback } from './utils/webgl-fallback';`
6. WHEN o Entry_Point já contiver o import `from './utils/webgl-fallback'`, THE `FallbackGenerator` SHALL não modificar o arquivo (idempotência).
7. WHEN nenhum Entry_Point candidato for encontrado, THE `FallbackGenerator` SHALL emitir um log de nível `warn` e retornar `Fix` com `applied: true` e `description` indicando que o Fallback_File foi criado mas o entry point não foi encontrado.
8. WHEN a integração ao Entry_Point for concluída com sucesso, THE `FallbackGenerator` SHALL emitir um log de nível `info` com o caminho do arquivo modificado.

---

### Requirement 5: Graceful Degradation sem Handlebars

**User Story:** Como usuário do EscapeKit em ambiente onde Handlebars não está disponível, quero que o `FallbackGenerator` continue funcionando com o código genérico atual, para que o auto-fix não falhe silenciosamente.

#### Acceptance Criteria

1. WHEN o import de `handlebars` falhar (módulo não disponível), THE `FallbackGenerator` SHALL usar o código hardcoded atual como fallback de geração.
2. WHEN o arquivo de template não for encontrado no sistema de arquivos, THE `FallbackGenerator` SHALL usar o código hardcoded atual como fallback de geração.
3. WHEN o graceful degradation for ativado, THE `FallbackGenerator` SHALL emitir um log de nível `warn` indicando que os templates não estão disponíveis.
4. WHEN o graceful degradation for ativado, THE `FallbackGenerator` SHALL retornar `Fix` com `applied: true` (não deve lançar erro nem retornar `applied: false` por ausência de Handlebars).
5. THE `FallbackGenerator` SHALL continuar executando a integração ao Entry_Point mesmo quando o graceful degradation for ativado para a geração do Fallback_File.

---

### Requirement 6: Preservação do Comportamento Existente

**User Story:** Como desenvolvedor do EscapeKit, quero que a refatoração não quebre a interface pública do `FallbackGenerator`, para que o `AutoFixEngine` e os consumidores existentes não precisem ser alterados.

#### Acceptance Criteria

1. THE `FallbackGenerator` SHALL manter a assinatura do método `fix(projectPath: string, issue: Issue): Promise<Fix>` sem alterações.
2. THE `FallbackGenerator` SHALL continuar criando o diretório `src/utils/` se não existir antes de escrever o Fallback_File.
3. THE `FallbackGenerator` SHALL continuar criando o arquivo `src/styles/webgl-fallback.css` com os estilos de fallback.
4. THE `AutoFixEngine` SHALL continuar instanciando `FallbackGenerator` sem argumentos, sem necessidade de alteração.
5. WHEN o método `fix` lançar uma exceção de I/O, THE `FallbackGenerator` SHALL retornar `Fix` com `applied: false` e `error` descrevendo a falha (comportamento atual preservado).

---

### Requirement 7: Idempotência

**User Story:** Como usuário do EscapeKit, quero que executar o `FallbackGenerator` múltiplas vezes no mesmo projeto produza o mesmo resultado, para que não haja duplicação de imports ou arquivos corrompidos.

#### Acceptance Criteria

1. FOR ALL projetos, executar `fix` duas vezes consecutivas SHALL produzir o mesmo estado final nos arquivos que executar `fix` uma única vez.
2. WHEN o Fallback_File já existir, THE `FallbackGenerator` SHALL sobrescrever o arquivo com o conteúdo atualizado (comportamento de `writeFile` existente).
3. WHEN o import já existir no Entry_Point, THE `FallbackGenerator` SHALL não adicionar um segundo import.
4. THE `FallbackGenerator` SHALL verificar a presença do import `from './utils/webgl-fallback'` antes de qualquer escrita no Entry_Point.
