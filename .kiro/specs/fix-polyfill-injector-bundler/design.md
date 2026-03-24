# Design Document

## Overview

Extensão do `PolyfillInjector` para adicionar detecção de bundler e integração automática do `src/polyfills.ts` ao entry point correto. A implementação adiciona dois métodos privados ao `PolyfillInjector` existente — `detectBundler` e `integrateWithBundler` — sem alterar a interface pública `Fixer` nem o construtor. O `AutoFixEngine` não requer nenhuma modificação.

---

## Architecture

### Componentes Envolvidos

```
AutoFixEngine
    └── PolyfillInjector (estendido)
            ├── detectBundler(projectPath)  → 'vite' | 'webpack' | 'nextjs' | 'unknown'
            └── integrateWithBundler(projectPath, bundler)
                    ├── integrateVite(projectPath)
                    ├── integrateWebpack(projectPath)
                    └── integrateNextjs(projectPath)
```

### Fluxo do método `fix` estendido

```
fix(projectPath, issue)
    │
    ├─ 1. Parse issue.message → apiName, polyfill  (existente)
    ├─ 2. Atualiza package.json                    (existente)
    ├─ 3. Cria/atualiza src/polyfills.ts           (existente)
    │
    └─ 4. detectBundler(projectPath)
            ├─ 'vite'    → integrateVite(projectPath)
            ├─ 'webpack' → integrateWebpack(projectPath)
            ├─ 'nextjs'  → integrateNextjs(projectPath)
            └─ 'unknown' → log warn, return Fix com nota
```

---

## Detailed Design

### 1. Tipo BundlerType

```typescript
type BundlerType = 'vite' | 'webpack' | 'nextjs' | 'unknown';
```

### 2. Método `detectBundler`

Verifica a existência de arquivos/diretórios de configuração usando `fs/promises.access`. A prioridade é: `nextjs` > `vite` > `webpack`.

```typescript
private async detectBundler(projectPath: string): Promise<BundlerType> {
  const exists = (p: string) => access(p).then(() => true).catch(() => false);

  const [hasNext1, hasNext2, hasNextPages, hasNextApp] = await Promise.all([
    exists(join(projectPath, 'next.config.js')),
    exists(join(projectPath, 'next.config.ts')),
    exists(join(projectPath, 'pages')),
    exists(join(projectPath, 'app')),
  ]);
  if (hasNext1 || hasNext2 || hasNextPages || hasNextApp) return 'nextjs';

  const [hasVite1, hasVite2] = await Promise.all([
    exists(join(projectPath, 'vite.config.ts')),
    exists(join(projectPath, 'vite.config.js')),
  ]);
  if (hasVite1 || hasVite2) return 'vite';

  const [hasWebpack1, hasWebpack2] = await Promise.all([
    exists(join(projectPath, 'webpack.config.js')),
    exists(join(projectPath, 'webpack.config.ts')),
  ]);
  if (hasWebpack1 || hasWebpack2) return 'webpack';

  return 'unknown';
}
```

### 3. Método `integrateVite`

Localiza o entry point candidato e prepend o import, verificando duplicação antes de escrever.

```typescript
private async integrateVite(projectPath: string): Promise<{ file: string | undefined; note?: string }> {
  const candidates = ['src/main.ts', 'src/main.tsx', 'src/index.ts', 'src/index.tsx'];
  const IMPORT_LINE = "import './polyfills';";

  for (const candidate of candidates) {
    const fullPath = join(projectPath, candidate);
    try {
      await access(fullPath);
      const content = await readFile(fullPath, 'utf-8');
      if (content.includes("import './polyfills'") || content.includes('import "./polyfills"')) {
        return { file: candidate }; // já existe, idempotente
      }
      await writeFile(fullPath, `${IMPORT_LINE}\n${content}`, 'utf-8');
      return { file: candidate };
    } catch {
      continue;
    }
  }

  this.log.warn('Vite entry point not found', { candidates });
  return { file: undefined, note: 'Vite entry point not found — connect polyfills.ts manually' };
}
```

### 4. Método `integrateWebpack`

Lê o webpack config como texto, localiza o campo `entry` via regex e modifica o valor. Abordagem baseada em manipulação de texto (sem eval/require) para segurança e compatibilidade com TypeScript configs.

```typescript
private async integrateWebpack(projectPath: string): Promise<{ file: string }> {
  const POLYFILL_ENTRY = "'./src/polyfills'";
  const candidates = ['webpack.config.js', 'webpack.config.ts'];

  for (const candidate of candidates) {
    const fullPath = join(projectPath, candidate);
    try {
      await access(fullPath);
      let content = await readFile(fullPath, 'utf-8');

      if (content.includes('./src/polyfills')) {
        return { file: candidate }; // já existe, idempotente
      }

      // entry: 'string' → entry: ['string', './src/polyfills']
      content = content.replace(
        /entry:\s*(['"][^'"]+['"])/,
        `entry: [$1, ${POLYFILL_ENTRY}]`
      );

      // entry: [...] → entry: [..., './src/polyfills']
      content = content.replace(
        /entry:\s*\[([^\]]*)\]/,
        (_, inner) => `entry: [${inner.trimEnd()}, ${POLYFILL_ENTRY}]`
      );

      await writeFile(fullPath, content, 'utf-8');
      return { file: candidate };
    } catch {
      continue;
    }
  }

  throw new Error('webpack.config not found or could not be modified');
}
```

### 5. Método `integrateNextjs`

Integra em Pages Router e/ou App Router conforme os diretórios presentes.

```typescript
private async integrateNextjs(projectPath: string): Promise<{ file: string; note?: string }> {
  const exists = (p: string) => access(p).then(() => true).catch(() => false);
  const IMPORT_LINE = "import '../polyfills';";
  let lastFile = '';

  // Pages Router
  if (await exists(join(projectPath, 'pages'))) {
    const appPath = join(projectPath, 'pages', '_app.tsx');
    try {
      await access(appPath);
      const content = await readFile(appPath, 'utf-8');
      if (!content.includes("import '../polyfills'") && !content.includes('import "../polyfills"')) {
        await writeFile(appPath, `${IMPORT_LINE}\n${content}`, 'utf-8');
      }
    } catch {
      // _app.tsx não existe — criar com componente mínimo
      await writeFile(appPath, `${IMPORT_LINE}\nimport type { AppProps } from 'next/app';\nexport default function App({ Component, pageProps }: AppProps) {\n  return <Component {...pageProps} />;\n}\n`, 'utf-8');
    }
    lastFile = 'pages/_app.tsx';
  }

  // App Router
  if (await exists(join(projectPath, 'app'))) {
    const layoutPath = join(projectPath, 'app', 'layout.tsx');
    try {
      await access(layoutPath);
      const content = await readFile(layoutPath, 'utf-8');
      if (!content.includes("import '../polyfills'") && !content.includes('import "../polyfills"')) {
        await writeFile(layoutPath, `${IMPORT_LINE}\n${content}`, 'utf-8');
      }
      lastFile = 'app/layout.tsx';
    } catch {
      this.log.warn('app/layout.tsx not found in App Router project');
      return { file: lastFile || 'pages/_app.tsx', note: 'app/layout.tsx not found — connect polyfills.ts manually' };
    }
  }

  return { file: lastFile };
}
```

### 6. Integração no método `fix`

Após os passos existentes (atualizar `package.json` e criar `src/polyfills.ts`), o método `fix` chama `detectBundler` e `integrateWithBundler`:

```typescript
// Após os passos existentes...
const bundler = await this.detectBundler(projectPath);

if (bundler === 'unknown') {
  this.log.warn('Bundler not detected, polyfills.ts created but not connected to entry point');
  return {
    issueType: issue.type,
    description: `Injected polyfill for '${apiName}' — polyfills.ts created but not connected to entry point — connect manually`,
    file: 'src/polyfills.ts',
    applied: true,
  };
}

try {
  const result = await this.integrateWithBundler(projectPath, bundler);
  return {
    issueType: issue.type,
    description: `Injected polyfill for '${apiName}' and connected to ${bundler} entry point`,
    file: result.file ?? 'src/polyfills.ts',
    applied: true,
  };
} catch (err) {
  return {
    issueType: issue.type,
    description: `Polyfill created but bundler integration failed: ${err instanceof Error ? err.message : String(err)}`,
    file: 'src/polyfills.ts',
    applied: false,
    error: err instanceof Error ? err.message : String(err),
  };
}
```

---

## Data Models

Nenhum modelo novo é necessário. Os tipos existentes são suficientes:

- `Fix`, `Issue`, `Fixer` (de `src/validate/types.ts`) — interface pública mantida sem alterações.
- `BundlerType` — tipo literal union definido localmente no arquivo `PolyfillInjector.ts`.

---

## Error Handling

| Situação | Comportamento |
|---|---|
| Bundler não detectado | Log `warn`, retorna `Fix { applied: true }` com nota de conexão manual |
| Entry point Vite não encontrado | Log `warn`, retorna `Fix { applied: true }` com nota |
| webpack.config não encontrado ou não parseável | Retorna `Fix { applied: false, error: <mensagem> }` |
| `app/layout.tsx` não encontrado (App Router) | Log `warn`, retorna `Fix { applied: true }` com nota |
| `pages/_app.tsx` não existe | Cria o arquivo com componente mínimo válido |
| Import já presente no entry point | Não modifica o arquivo (idempotente), retorna `Fix { applied: true }` |
| Falha de I/O em qualquer etapa | Retorna `Fix { applied: false, error: <mensagem> }` |

---

## Testing Strategy

### Testes Unitários

Arquivo: `tests/validate/PolyfillInjector.test.ts`

Todos os testes usam mocks de `fs/promises` para evitar I/O real.

**Detecção de bundler:**
1. Presença de `vite.config.ts` → detecta `"vite"`
2. Presença de `vite.config.js` → detecta `"vite"`
3. Presença de `webpack.config.js` → detecta `"webpack"`
4. Presença de `next.config.js` → detecta `"nextjs"`
5. Presença de diretório `pages/` → detecta `"nextjs"`
6. Presença de diretório `app/` → detecta `"nextjs"`
7. Nenhum indicador → detecta `"unknown"`
8. Next.js + Vite presentes → prioriza `"nextjs"`

**Integração Vite:**
9. Entry point `src/main.ts` existe → adiciona import na primeira linha
10. `src/main.ts` não existe, `src/main.tsx` existe → usa `src/main.tsx`
11. Import já presente → não duplica
12. Nenhum entry point encontrado → retorna nota de conexão manual

**Integração Webpack:**
13. `entry` é string → converte para array com polyfill
14. `entry` é array → adiciona polyfill ao array
15. `'./src/polyfills'` já no array → não duplica
16. webpack.config não encontrado → retorna `applied: false`

**Integração Next.js:**
17. Pages Router (`pages/`) com `_app.tsx` existente → adiciona import
18. Pages Router sem `_app.tsx` → cria arquivo com componente mínimo
19. App Router (`app/`) com `layout.tsx` existente → adiciona import
20. App Router sem `layout.tsx` → retorna nota de conexão manual
21. Ambos Pages e App Router presentes → integra nos dois
22. Import já presente em `_app.tsx` → não duplica

**Bundler desconhecido:**
23. Sem bundler → cria `polyfills.ts`, emite warn, retorna `applied: true` com nota

**Comportamento existente preservado:**
24. `fix` com issue desconhecido → retorna `applied: false` (comportamento atual)
25. `fix` com polyfill válido → atualiza `package.json` antes da integração
26. `fix` com polyfill válido → cria `src/polyfills.ts` antes da integração

### Correctness Properties

1. **Idempotência**: para qualquer bundler detectado, executar `fix` duas vezes produz o mesmo estado final nos arquivos — `f(f(x)) = f(x)`.
2. **Invariante de interface**: para qualquer `Issue` válido, `fix` sempre retorna um objeto `Fix` com `issueType`, `description` e `applied` definidos — nunca lança exceção.
3. **Preservação do conteúdo**: ao adicionar o import no entry point, o conteúdo original do arquivo é preservado integralmente após a primeira linha inserida.
4. **Prioridade de detecção**: se Next.js e Vite forem detectados simultaneamente, o bundler retornado é sempre `"nextjs"`.

---

## Implementation Notes

- A manipulação do `webpack.config` é feita via regex sobre o texto do arquivo, sem `eval` ou `require` dinâmico, por segurança e compatibilidade com configs TypeScript.
- O método `integrateWithBundler` é um dispatcher simples que delega para `integrateVite`, `integrateWebpack` ou `integrateNextjs`.
- O `AutoFixEngine` não requer nenhuma modificação — `new PolyfillInjector()` continua funcionando sem argumentos.
- A detecção usa `Promise.all` para verificar múltiplos arquivos em paralelo, minimizando latência de I/O.
- O import adicionado ao entry point Vite usa aspas simples (`'./polyfills'`) para consistência com o estilo mais comum em projetos Vite/TypeScript.
