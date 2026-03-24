# Implementation Plan

## Tasks

- [ ] 1. Adicionar tipo `BundlerType` e método `detectBundler` ao `PolyfillInjector`
  - Definir `type BundlerType = 'vite' | 'webpack' | 'nextjs' | 'unknown'` no topo do arquivo
  - Implementar `private async detectBundler(projectPath: string): Promise<BundlerType>`
  - Verificar existência de `next.config.js`, `next.config.ts`, `pages/`, `app/` (prioridade máxima)
  - Verificar existência de `vite.config.ts`, `vite.config.js`
  - Verificar existência de `webpack.config.js`, `webpack.config.ts`
  - Usar `Promise.all` para verificações paralelas dentro de cada bundler
  - Arquivo: `src/validate/auto-fix/PolyfillInjector.ts`

- [ ] 2. Implementar método `integrateVite`
  - Implementar `private async integrateVite(projectPath: string): Promise<{ file: string | undefined; note?: string }>`
  - Iterar pelos candidatos: `src/main.ts`, `src/main.tsx`, `src/index.ts`, `src/index.tsx`
  - Verificar presença de `import './polyfills'` ou `import "./polyfills"` antes de escrever
  - Prepend `import './polyfills';\n` ao conteúdo existente quando não duplicado
  - Retornar nota quando nenhum entry point for encontrado
  - Arquivo: `src/validate/auto-fix/PolyfillInjector.ts`

- [ ] 3. Implementar método `integrateWebpack`
  - Implementar `private async integrateWebpack(projectPath: string): Promise<{ file: string }>`
  - Tentar `webpack.config.js` e depois `webpack.config.ts`
  - Verificar presença de `'./src/polyfills'` antes de modificar (idempotência)
  - Aplicar regex para converter `entry: 'string'` → `entry: ['string', './src/polyfills']`
  - Aplicar regex para adicionar ao array existente `entry: [...]`
  - Lançar erro descritivo se nenhum config for encontrado
  - Arquivo: `src/validate/auto-fix/PolyfillInjector.ts`

- [ ] 4. Implementar método `integrateNextjs`
  - Implementar `private async integrateNextjs(projectPath: string): Promise<{ file: string; note?: string }>`
  - Verificar presença do diretório `pages/` e integrar em `pages/_app.tsx`
  - Criar `pages/_app.tsx` com componente mínimo se não existir
  - Verificar presença do diretório `app/` e integrar em `app/layout.tsx`
  - Logar warn e retornar nota se `app/layout.tsx` não existir
  - Verificar presença de `import '../polyfills'` antes de escrever (idempotência)
  - Integrar em ambos quando Pages Router e App Router coexistirem
  - Arquivo: `src/validate/auto-fix/PolyfillInjector.ts`

- [ ] 5. Integrar detecção e integração no método `fix` existente
  - Após os passos existentes (package.json + polyfills.ts), chamar `detectBundler`
  - Para bundler `'unknown'`: emitir `this.log.warn(...)` e retornar `Fix` com nota de conexão manual
  - Para bundlers conhecidos: chamar o integrador correspondente via dispatcher `integrateWithBundler`
  - Envolver a chamada ao integrador em try/catch retornando `Fix { applied: false }` em caso de erro
  - Manter todos os retornos antecipados existentes (issue desconhecido, polyfill não mapeado) sem alteração
  - Arquivo: `src/validate/auto-fix/PolyfillInjector.ts`

- [ ] 6. Escrever testes unitários para o `PolyfillInjector` estendido
  - Criar `tests/validate/PolyfillInjector.test.ts`
  - Mockar `fs/promises` (`access`, `readFile`, `writeFile`) para evitar I/O real
  - Testar detecção de cada bundler (vite, webpack, nextjs, unknown) e prioridade nextjs > vite > webpack
  - Testar integração Vite: entry point encontrado, não encontrado, import já presente
  - Testar integração Webpack: entry string, entry array, import já presente, config não encontrado
  - Testar integração Next.js: Pages Router, App Router, ambos, _app.tsx criado, layout.tsx ausente
  - Testar bundler unknown: warn emitido, Fix com nota, nenhum arquivo de config modificado
  - Testar preservação do comportamento existente: issue desconhecido retorna `applied: false`
  - Testar idempotência: segunda chamada com mesmo estado não duplica imports

- [ ] 7. Verificar diagnósticos e corrigir erros de tipo
  - Executar `getDiagnostics` em `src/validate/auto-fix/PolyfillInjector.ts`
  - Corrigir quaisquer erros de tipo TypeScript introduzidos
  - Verificar que `src/validate/auto-fix/AutoFixEngine.ts` não apresenta novos erros
