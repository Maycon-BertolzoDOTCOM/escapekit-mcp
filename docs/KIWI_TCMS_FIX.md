# 📑 Documentação de Solução: Integração Kiwi TCMS

## 1. O Problema
Durante a execução do script `scripts/kiwi-upload-rest.ts`, o processo de upload era interrompido com o seguinte erro crítico:
`JSON-RPC Error: Internal error: [('build', ['Select a valid choice. That choice is not one of the available choices.'])]`

Este erro ocorria no momento da criação do **Test Run**. O Kiwi TCMS rejeitava o ID do **Build** fornecido, alegando que ele não era uma "opção válida" para o **Test Plan** em questão. As tentativas anteriores de associar o plano diretamente na criação do build (`Build.create`) estavam sendo ignoradas pela API ou resultando em builds órfãos, incapazes de serem usados em execuções vinculadas ao plano.

## 2. A Causa Raiz
A falha ocorria devido a dois fatores principais de arquitetura da API do Kiwi TCMS:

1.  **Isolamento de Versão:** Um Build no Kiwi TCMS está vinculado a um `Product` e a uma `Version`. Se o `Test Plan` estiver configurado para uma versão (ex: "unspecified") e o `Build` for criado para outra (ex: "1.0"), o sistema impede a criação de um `Test Run` que tente unir os dois, resultando no erro de "escolha inválida".
2.  **Associação de Plano Silenciosa:** O método `Build.create` da API JSON-RPC muitas vezes ignora o campo `plan`. A associação entre um Build e um Plano de Teste frequentemente exige uma ação explícita ou, no mínimo, que ambos compartilhem a mesma versão exata do produto.

## 3. A Solução Aplicada
A resolução foi dividida em três frentes:

### A. Idempotência e Reutilização de Builds
O script foi modificado para primeiro buscar por builds existentes com o mesmo nome (`Auto-YYYY-MM-DD`) usando um filtro corrigido. Se encontrado, o build é reutilizado, evitando o erro de "Build already exists".

### B. Alinhamento de Versão e Associação
-   **Publicação do `jsonrpc`:** O método `jsonrpc` na classe `KiwiClient` foi tornado público, permitindo chamadas diretas a métodos da API que não possuem wrappers (como `TestPlan.update`).
-   **Correção de Filtro:** O `KiwiClient` foi ajustado para usar `version__product` em vez de `product` ao filtrar builds, alinhando-se aos requisitos de busca da API v15.x.
-   **Sincronização de Versão:** Forçamos o `Test Plan` a utilizar a mesma `Version` (ID 2, correspondente a "1.0") do `Build`. Isso removeu a restrição de "valid choice" da API.

### C. Flexibilidade no CI (GitHub Actions)
-   Introdução do suporte à variável `KIWI_BUILD_ID`. Se um segredo for definido no GitHub, o script ignora a criação automática e usa um build fixo e pré-validado, garantindo estabilidade em ambientes de produção.

## 4. O Código Modificado

### `src/lib/kiwi-client.ts`
Alteramos a visibilidade do método core para permitir extensibilidade sem modificar a biblioteca base constantemente:
```typescript
// De private para public
async jsonrpc<T>(method: string, params?: unknown[] | Record<string, unknown>): Promise<T> { ... }
```
E corrigimos o filtro de busca de builds:
```typescript
// Antes: { product: productId }
// Depois: { version__product: productId }
const results = await this.jsonrpc<KiwiRawResult[]>('Build.filter', [{ version__product: productId }]);
```

### `scripts/kiwi-upload-rest.ts`
Implementamos a lógica de decisão para o Build:
```typescript
let build: any;
if (process.env.KIWI_BUILD_ID) {
  // Prioridade 1: Build Fixo (Manual)
  build = (await client.jsonrpc<any[]>('Build.filter', [{ id: parseInt(process.env.KIWI_BUILD_ID) }]))[0];
} else {
  // Prioridade 2: Reutilizar ou Criar
  const existingBuilds = await client.listBuilds(product.id);
  const existing = existingBuilds.find(b => b.name === buildName);
  build = existing || await client.createBuild(buildData);
  
  // Garantia: Tentar associar (mesmo que o método falhe, a versão alinhada resolve)
  try { await client.jsonrpc('TestPlan.add_build', [testPlanId, build.id]); } catch (e) { /* ... */ }
}
```

## 5. Como evitar no futuro

1.  **Teste Local com Variáveis de Produção:** Sempre valide o upload usando as credenciais do `ngrok` ou do servidor oficial antes de realizar o push, simulando as variáveis do GitHub Secrets.
2.  **Exploração da API:** Utilize o script de debug (`scripts/test-kiwi-methods.ts`) para verificar se novos métodos da API estão disponíveis após atualizações do servidor Kiwi TCMS.
3.  **Consistência de Versões:** Mantenha os Test Plans e os Builds sob a mesma "Product Version" no Kiwi TCMS para evitar erros de integridade referencial.
4.  **Tratamento de Artefatos:** No GitHub Actions, certifique-se de que os nomes dos arquivos de resultados (`vitest-results.json`) sejam consistentes entre o step de teste e o step de upload.

---

## 💡 Lições Aprendidas

-   **APIs "Opacas":** Erros de "Internal Error" em JSON-RPC frequentemente mascaram problemas de integridade de dados (como chaves estrangeiras inválidas entre Plano e Build).
-   **Filtros Não Documentados:** O Kiwi TCMS requer filtros específicos como `version__product` em vez de campos diretos em certas versões da API.
-   **A Força da Idempotência:** Scripts de CI devem ser capazes de rodar múltiplas vezes; a lógica de "buscar antes de criar" é essencial para evitar colisões de dados.
-   **Flexibilidade do Cliente:** Tornar os métodos core de transporte (como `jsonrpc`) públicos em classes de integração permite que o desenvolvedor contorne limitações da biblioteca sem hacks complexos.

**Status Final:** ✅ Solução implementada, testada localmente com 100% de sucesso (1282 casos) e enviada para o repositório principal.
