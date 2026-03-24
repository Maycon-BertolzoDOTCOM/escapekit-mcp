# Implementation Plan

## Tasks

- [x] 1. Substituir `__dirname` por `import.meta.url` no `RecommendationEngine`
  - Localizar a linha `const templatesDir = resolve(__dirname, 'templates');` em `loadTemplates()`
  - Substituir por `const templatesDir = resolve(new URL('.', import.meta.url).pathname, 'templates');`
  - Verificar que o import de `resolve` de `'path'` já existe e não precisa ser adicionado
  - Confirmar que `new URL` não requer import adicional (é global em Node.js ESM)
  - Arquivo: `src/recommendations/RecommendationEngine.ts`

- [x] 2. Adicionar logger estruturado ao `RecommendationEngine`
  - Adicionar `import { logger } from '../logger.js';` ao bloco de imports
  - Adicionar `private readonly log = logger.child('RecommendationEngine');` como propriedade de classe
  - Substituir `console.warn(\`Templates directory not found: ${templatesDir}\`)` por `this.log.warn('Templates directory not found', { templatesDir })`
  - Substituir `console.log(\`RecommendationEngine: Loaded ${this.templateCache.size} templates\`)` por `this.log.info('Templates loaded', { count: this.templateCache.size })`
  - Substituir `console.warn('Error loading recommendation templates:', error)` por `this.log.warn('Error loading recommendation templates', { error })`
  - Arquivo: `src/recommendations/RecommendationEngine.ts`

- [x] 3. Verificar diagnósticos e corrigir erros de tipo
  - Executar `getDiagnostics` em `src/recommendations/RecommendationEngine.ts`
  - Corrigir quaisquer erros de tipo TypeScript introduzidos pelas alterações
  - Confirmar que nenhum outro arquivo do projeto apresenta novos erros em decorrência da mudança

- [x] 4. Expandir testes com propriedades de corretude da correção ESM
  - Adicionar `describe` block `'ESM compatibility and correctness properties'` ao arquivo de testes existente
  - Adicionar P1: teste que verifica `new RecommendationEngine()` não lança exceção (`expect(() => new RecommendationEngine()).not.toThrow()`)
  - Adicionar P2: teste que verifica `getLoadedTemplateIds()` retorna array não vazio após construção
  - Adicionar P3: teste que verifica degradação graciosa quando `existsSync` retorna `false` (mock via `vi.spyOn`)
  - Adicionar P4: teste que verifica `generate({ problemType: 'ghost-import' })` retorna `Recommendation` com `id` definido e não `undefined`
  - Adicionar P5: teste que verifica os quatro templates padrão (`framework-mix`, `ghost-import`, `mock-api`, `phantom-dependency`) estão presentes em `getLoadedTemplateIds()`
  - Arquivo: `tests/recommendations/recommendation-engine.test.ts`

- [x] 5. Verificar diagnósticos no arquivo de testes
  - Executar `getDiagnostics` em `tests/recommendations/recommendation-engine.test.ts`
  - Corrigir quaisquer erros de tipo ou import introduzidos pelos novos testes

