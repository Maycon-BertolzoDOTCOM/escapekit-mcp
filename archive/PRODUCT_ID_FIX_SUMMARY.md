# Resumo da Correção: Suporte a --product-id

## 🐛 Problema Identificado

O workflow do GitHub Actions estava falhando com exit code 1 no step "Upload results to Kiwi TCMS", mesmo após a correção dos imports ES Module.

### Causa Raiz

O script `scripts/kiwi-upload-enhanced.mts` **NÃO suportava** o argumento `--product-id`, apesar do workflow passá-lo:

**Workflow (.github/workflows/kiwi-tcms.yml):**
```yaml
npx tsx scripts/kiwi-upload-enhanced.mts \
  --file vitest-results.json \
  --framework vitest \
  --product-id $KIWI_PRODUCT_ID \        # ← Passa --product-id
  --test-plan-id $KIWI_TEST_PLAN_ID \
  --verbose
```

**Script (antes da correção):**
```typescript
// A interface tinha productId mas não era usado!
interface UploadOptions {
  file: string;
  framework?: 'vitest' | 'mocha' | 'custom';
  productId?: number;  // ← Definido mas não usado
  testPlanId?: number;
  verbose?: boolean;
  buildMetadata?: BuildMetadata;
}

// O script sempre procurava por NOME, não por ID
const product = await uploader.client.findProductByName(config.defaultProduct);
// ↑ Usa 'EscapeKit' como padrão, ignorando --product-id
```

### Por que Isso Causava Falha

1. O script ignorava `--product-id` e procurava pelo produto pelo **nome** "EscapeKit"
2. O nome do produto no servidor de produção pode ser diferente (ex: "EscapetKit" com erro de digitação)
3. `findProductByName('EscapeKit')` retornava `undefined`
4. O script chamava `process.exit(1)` (linha 277) com a mensagem:
   ```
   ✗ Product not found: EscapeKit
   Available products: (list skipped)
   ```

## ✅ Solução Implementada

### 1. Adicionar `productName` à Interface

```typescript
interface UploadOptions {
  file: string;
  framework?: 'vitest' | 'mocha' | 'custom';
  productId?: number;       // ← Já existia
  productName?: string;     // ← NOVO: suporte alternativo por nome
  testPlanId?: number;
  verbose?: boolean;
  buildMetadata?: BuildMetadata;
}
```

### 2. Implementar Lógica de Busca Híbrida

```typescript
// Get Product - FIXED: Support both productId and productName
console.log('Looking up product...');
let product: any;

if (options.productId) {
  // Use productId directly if provided
  try {
    const products = await uploader.client.listProducts();
    product = products.find((p: any) => p.id === options.productId);
    
    if (!product) {
      console.error(`✗ Product not found with ID: ${options.productId}`);
      console.log('Available products:');
      for (const p of products) {
        console.log(`  - ${p.name} (ID: ${p.id})`);
      }
      process.exit(1);
    }
    
    console.log(`✓ Found product by ID: ${product.name} (ID: ${product.id})`);
  } catch (error: any) {
    console.error('✗ Error looking up product by ID:', error.message);
    process.exit(1);
  }
} else {
  // Use product name if productId not provided
  const productName = options.productName || config.defaultProduct;
  try {
    product = await uploader.client.findProductByName(productName);
    
    if (!product) {
      console.error(`✗ Product not found: ${productName}`);
      console.log('Available products:');
      const products = await uploader.client.listProducts();
      for (const p of products) {
        console.log(`  - ${p.name} (ID: ${p.id})`);
      }
      process.exit(1);
    }
    
    console.log(`✓ Found product by name: ${product.name} (ID: ${product.id})`);
  } catch (error: any) {
    console.error('✗ Error looking up product:', error.message);
    process.exit(1);
  }
}
```

### 3. Atualizar CLI para Aceitar Novas Opções

```typescript
const productIdFlagIndex = args.indexOf('--product-id');
const productId = productIdFlagIndex !== -1 ? parseInt(args[productIdFlagIndex + 1]) : undefined;

const productNameFlagIndex = args.indexOf('--product-name');
const productName = productNameFlagIndex !== -1 ? args[productNameFlagIndex + 1] : undefined;

uploadResults({ file, framework, productId, productName, testPlanId, verbose })
```

## 🎯 Benefícios da Solução

1. **Prioridade correta:** Se `--product-id` for fornecido, usa o ID (mais preciso)
2. **Fallback por nome:** Se `--product-id` não for fornecido, usa `--product-name` ou `defaultProduct`
3. **Melhor diagnóstico:** Lista produtos disponíveis quando não encontrado
4. **Compatibilidade:** Mantém compatibilidade com uso anterior por nome
5. **Flexibilidade:** Permite usar ID ou nome conforme preferência

## 📊 Testes Recomendados

### Teste com Product ID (recomendado)
```bash
export KIWI_URL="https://SEU-SERVIDOR-KIWI-TCMS.com"
export KIWI_USERNAME="SEU_USUARIO"
export KIWI_PASSWORD="SUA_SENHA"

npx tsx scripts/kiwi-upload-enhanced.mts \
  --file vitest-results.json \
  --framework vitest \
  --product-id 1 \
  --test-plan-id 1 \
  --verbose
```

### Teste com Product Name (alternativo)
```bash
npx tsx scripts/kiwi-upload-enhanced.mts \
  --file vitest-results.json \
  --framework vitest \
  --product-name "EscapeKit" \
  --test-plan-id 1 \
  --verbose
```

### Teste sem especificar produto (usa padrão)
```bash
npx tsx scripts/kiwi-upload-enhanced.mts \
  --file vitest-results.json \
  --framework vitest \
  --test-plan-id 1 \
  --verbose
# Usará 'EscapeKit' (ou KIWI_PRODUCT_NAME se definida)
```

## 📝 Commits Relacionados

1. `cbb43f3` - fix: adicionar suporte a --product-id no script de upload
2. `2490338` - docs: guia completo de validacao de upload para Kiwi TCMS
3. `51bc192` - docs: resumo da correcao de import ES Module
4. `00a51ed` - fix: corrigir imports do load-test-results.ts para ES Modules
5. `0b6fa74` - docs: atualizar progresso da Tarefa 13 (upload automático)

## 🔄 Status da Tarefa 13

**Progresso:**
- ✅ Criação do vitest.config.ts na raiz
- ✅ Implementação da autenticação via Auth.login
- ✅ Correção de imports para ES Modules
- ✅ Adição de suporte a --product-id
- ✅ Documentação completa de diagnóstico
- ⏸️ Aguardando validação no GitHub Actions (workflow #11+)

**Próximo Passo:**
Aguardar o próximo workflow ser executado para validar se o upload agora funciona corretamente com `--product-id`.

## 📚 Documentos Relacionados

- `KIWI_TCMS_UPLOAD_VALIDATION_GUIDE.md` - Guia completo de validação
- `ES_MODULE_FIX_SUMMARY.md` - Resumo da correção de imports
- `GITHUB_ACTIONS_KIWI_TCMS_DIAGNOSTIC.md` - Guia de diagnóstico
- `scripts/diagnose-kiwi-tcms.sh` - Script de diagnóstico automatizado

---

**Nota:** Esta correção resolve o problema mais provável do exit code 1. Se o workflow ainda falhar, consulte `KIWI_TCMS_UPLOAD_VALIDATION_GUIDE.md` para outras causas possíveis.