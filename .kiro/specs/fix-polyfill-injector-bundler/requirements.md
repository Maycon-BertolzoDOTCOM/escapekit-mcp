# Requirements Document

## Introduction

O `PolyfillInjector` (`src/validate/auto-fix/PolyfillInjector.ts`) cria o arquivo `src/polyfills.ts` com os imports dos polyfills necessários, mas não garante que esse arquivo seja carregado pelo bundler do projeto alvo. O resultado é que o polyfill existe no disco mas nunca é executado em produção. Esta melhoria adiciona ao `PolyfillInjector` a capacidade de detectar o bundler em uso e conectar o `src/polyfills.ts` ao entry point correto, garantindo que os polyfills sejam efetivamente executados. O comportamento existente de criar o arquivo e atualizar o `package.json` é preservado integralmente.

## Glossary

- **PolyfillInjector**: Componente em `src/validate/auto-fix/PolyfillInjector.ts` que implementa a interface `Fixer` e injeta polyfills em projetos.
- **BundlerDetector**: Lógica interna ao `PolyfillInjector` responsável por identificar o bundler do projeto alvo a partir de arquivos de configuração presentes no `projectPath`.
- **BundlerIntegrator**: Lógica interna ao `PolyfillInjector` responsável por conectar `src/polyfills.ts` ao entry point do bundler detectado.
- **Entry_Point**: Arquivo de entrada do bundler que é carregado primeiro em tempo de execução (ex: `src/main.ts`, `pages/_app.tsx`, `app/layout.tsx`).
- **Polyfills_File**: Arquivo `src/polyfills.ts` criado pelo `PolyfillInjector` contendo os imports dos polyfills.
- **Fixer**: Interface em `src/validate/types.ts` com o método `fix(projectPath: string, issue: Issue): Promise<Fix>`.
- **Fix**: Tipo em `src/validate/types.ts` que representa o resultado de uma operação de fix.
- **AutoFixEngine**: Orquestrador em `src/validate/auto-fix/AutoFixEngine.ts` que instancia e invoca fixers.
- **Vite**: Bundler detectado pela presença de `vite.config.ts` ou `vite.config.js` no `projectPath`.
- **Webpack**: Bundler detectado pela presença de `webpack.config.js` ou `webpack.config.ts` no `projectPath`.
- **Next.js**: Framework/bundler detectado pela presença de `next.config.js`, `next.config.ts`, diretório `pages/` ou diretório `app/` no `projectPath`.
- **Pages_Router**: Convenção do Next.js baseada no diretório `pages/`, com entry point em `pages/_app.tsx`.
- **App_Router**: Convenção do Next.js baseada no diretório `app/`, com entry point em `app/layout.tsx`.

---

## Requirements

### Requirement 1: Detecção do Bundler

**User Story:** Como usuário do EscapeKit, quero que o `PolyfillInjector` detecte automaticamente o bundler do projeto alvo, para que a integração do polyfill seja feita no lugar correto sem configuração manual.

#### Acceptance Criteria

1. WHEN o `projectPath` contiver `vite.config.ts` ou `vite.config.js`, THE `BundlerDetector` SHALL identificar o bundler como `"vite"`.
2. WHEN o `projectPath` contiver `webpack.config.js` ou `webpack.config.ts`, THE `BundlerDetector` SHALL identificar o bundler como `"webpack"`.
3. WHEN o `projectPath` contiver `next.config.js`, `next.config.ts`, o diretório `pages/` ou o diretório `app/`, THE `BundlerDetector` SHALL identificar o bundler como `"nextjs"`.
4. WHEN nenhum dos arquivos ou diretórios de detecção estiver presente no `projectPath`, THE `BundlerDetector` SHALL identificar o bundler como `"unknown"`.
5. WHEN múltiplos indicadores de bundlers diferentes estiverem presentes, THE `BundlerDetector` SHALL priorizar na ordem: `"nextjs"` > `"vite"` > `"webpack"`.
6. THE `BundlerDetector` SHALL realizar a detecção verificando a existência dos arquivos via sistema de arquivos, sem ler o conteúdo dos arquivos de configuração.

---

### Requirement 2: Integração com Vite

**User Story:** Como usuário do EscapeKit com projeto Vite, quero que o `PolyfillInjector` adicione o import do `polyfills.ts` no entry point do Vite, para que os polyfills sejam carregados antes de qualquer outro módulo.

#### Acceptance Criteria

1. WHEN o bundler detectado for `"vite"`, THE `BundlerIntegrator` SHALL localizar o entry point do Vite verificando a existência dos seguintes arquivos na ordem: `src/main.ts`, `src/main.tsx`, `src/index.ts`, `src/index.tsx`.
2. WHEN o entry point do Vite for localizado, THE `BundlerIntegrator` SHALL adicionar `import './polyfills';` como primeira linha do arquivo de entry point.
3. WHEN o entry point do Vite já contiver `import './polyfills'` ou `import "./polyfills"`, THE `BundlerIntegrator` SHALL não modificar o arquivo (sem duplicação).
4. WHEN nenhum dos arquivos de entry point candidatos existir no projeto Vite, THE `BundlerIntegrator` SHALL registrar um aviso no log e retornar `Fix` com `applied: true` e `description` indicando que o Polyfills_File foi criado mas o entry point não foi encontrado.
5. WHEN a integração com Vite for concluída com sucesso, THE `PolyfillInjector` SHALL retornar `Fix` com `applied: true` e `file` apontando para o entry point modificado.

---

### Requirement 3: Integração com Webpack

**User Story:** Como usuário do EscapeKit com projeto Webpack, quero que o `PolyfillInjector` adicione o `polyfills.ts` ao array `entry` do Webpack, para que o polyfill seja incluído no bundle de produção.

#### Acceptance Criteria

1. WHEN o bundler detectado for `"webpack"`, THE `BundlerIntegrator` SHALL ler o arquivo `webpack.config.js` ou `webpack.config.ts` (primeiro que existir) do `projectPath`.
2. WHEN o campo `entry` do webpack config for uma string, THE `BundlerIntegrator` SHALL converter para array contendo a string original e adicionar `'./src/polyfills'` ao array.
3. WHEN o campo `entry` do webpack config for um array, THE `BundlerIntegrator` SHALL adicionar `'./src/polyfills'` ao array existente.
4. WHEN `'./src/polyfills'` já estiver presente no array `entry`, THE `BundlerIntegrator` SHALL não modificar o arquivo (sem duplicação).
5. WHEN a integração com Webpack for concluída com sucesso, THE `PolyfillInjector` SHALL retornar `Fix` com `applied: true` e `file` apontando para o arquivo de configuração do Webpack modificado.
6. IF o arquivo de configuração do Webpack não puder ser lido ou parseado, THEN THE `PolyfillInjector` SHALL retornar `Fix` com `applied: false` e `error` descrevendo a falha.

---

### Requirement 4: Integração com Next.js

**User Story:** Como usuário do EscapeKit com projeto Next.js, quero que o `PolyfillInjector` adicione o import do `polyfills.ts` no arquivo de layout correto do Next.js, para que os polyfills sejam carregados em todas as páginas.

#### Acceptance Criteria

1. WHEN o bundler detectado for `"nextjs"` e o diretório `pages/` existir no `projectPath`, THE `BundlerIntegrator` SHALL adicionar `import '../polyfills';` como primeira linha de `pages/_app.tsx`.
2. WHEN `pages/_app.tsx` não existir, THE `BundlerIntegrator` SHALL criar o arquivo com um componente `_app` mínimo válido contendo o import do polyfill.
3. WHEN o bundler detectado for `"nextjs"` e o diretório `app/` existir no `projectPath`, THE `BundlerIntegrator` SHALL adicionar `import '../polyfills';` como primeira linha de `app/layout.tsx`.
4. WHEN `app/layout.tsx` não existir no projeto com App Router, THE `BundlerIntegrator` SHALL registrar um aviso no log e retornar `Fix` com `applied: true` e `description` indicando que o layout não foi encontrado.
5. WHEN o arquivo de entry point do Next.js já contiver `import '../polyfills'` ou `import "../polyfills"`, THE `BundlerIntegrator` SHALL não modificar o arquivo (sem duplicação).
6. WHEN tanto `pages/` quanto `app/` existirem no projeto, THE `BundlerIntegrator` SHALL integrar em ambos os entry points.
7. WHEN a integração com Next.js for concluída com sucesso, THE `PolyfillInjector` SHALL retornar `Fix` com `applied: true` e `file` apontando para o entry point modificado ou criado.

---

### Requirement 5: Comportamento para Bundler Desconhecido

**User Story:** Como usuário do EscapeKit em projeto sem bundler detectado, quero que o `PolyfillInjector` preserve o comportamento atual e emita um aviso claro, para que eu saiba que preciso conectar o polyfill manualmente.

#### Acceptance Criteria

1. WHEN o bundler detectado for `"unknown"`, THE `PolyfillInjector` SHALL criar o Polyfills_File e atualizar o `package.json` normalmente (comportamento atual preservado).
2. WHEN o bundler detectado for `"unknown"`, THE `PolyfillInjector` SHALL emitir um log de nível `warn` com a mensagem `"Bundler not detected, polyfills.ts created but not connected to entry point"`.
3. WHEN o bundler detectado for `"unknown"`, THE `PolyfillInjector` SHALL retornar `Fix` com `applied: true` e `description` contendo a nota `"polyfills.ts created but not connected to entry point — connect manually"`.
4. THE `PolyfillInjector` SHALL não modificar nenhum arquivo de configuração quando o bundler for `"unknown"`.

---

### Requirement 6: Preservação do Comportamento Existente

**User Story:** Como desenvolvedor do EscapeKit, quero que a melhoria não quebre o comportamento atual do `PolyfillInjector`, para que a estabilidade do sistema de auto-fix seja mantida.

#### Acceptance Criteria

1. THE `PolyfillInjector` SHALL manter a assinatura do método `fix(projectPath: string, issue: Issue): Promise<Fix>` sem alterações.
2. THE `PolyfillInjector` SHALL continuar adicionando o pacote do polyfill ao `package.json` do projeto alvo antes de qualquer integração com bundler.
3. THE `PolyfillInjector` SHALL continuar criando ou atualizando `src/polyfills.ts` com o import statement correto antes de qualquer integração com bundler.
4. THE `AutoFixEngine` SHALL continuar instanciando `PolyfillInjector` sem argumentos, sem necessidade de alteração.
5. WHEN o `PolyfillInjector` não conseguir determinar o polyfill necessário a partir da mensagem do issue, THE `PolyfillInjector` SHALL retornar `Fix` com `applied: false` (comportamento atual preservado).

---

### Requirement 7: Idempotência das Integrações

**User Story:** Como usuário do EscapeKit, quero que executar o `PolyfillInjector` múltiplas vezes no mesmo projeto produza o mesmo resultado, para que não haja duplicação de imports ou entradas de configuração.

#### Acceptance Criteria

1. FOR ALL projetos com bundler detectado, executar `fix` duas vezes consecutivas SHALL produzir o mesmo estado final nos arquivos modificados que executar `fix` uma única vez.
2. WHEN o import do polyfill já existir no entry point, THE `BundlerIntegrator` SHALL detectar a presença e não adicionar um segundo import.
3. WHEN `'./src/polyfills'` já existir no array `entry` do Webpack, THE `BundlerIntegrator` SHALL não adicionar uma entrada duplicada.
4. THE `PolyfillInjector` SHALL verificar a presença do import antes de qualquer escrita no entry point, independentemente do bundler.
