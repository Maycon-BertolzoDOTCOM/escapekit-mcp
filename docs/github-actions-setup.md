# GitHub Actions Setup - Kiwi TCMS Integration

## Visão Geral

Este guia explica como configurar o upload automático de resultados de testes para o Kiwi TCMS usando GitHub Actions.

## Pré-requisitos

- Repositório no GitHub
- Instância do Kiwi TCMS configurada e acessível
- Acesso administrativo ao repositório GitHub

---

## Passo 1: Configurar Workflow

### 1.1 Verificar Arquivo de Workflow

O arquivo `.github/workflows/kiwi-tcms.yml` já deve existir no repositório. Verifique se contém:

```yaml
name: Upload Test Results to Kiwi TCMS

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:

jobs:
  upload-test-results:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        continue-on-error: true

      - name: Upload results to Kiwi TCMS
        env:
          KIWI_URL: ${{ secrets.KIWI_URL }}
          KIWI_USERNAME: ${{ secrets.KIWI_USERNAME }}
          KIWI_PASSWORD: ${{ secrets.KIWI_PASSWORD }}
          KIWI_PRODUCT_ID: ${{ secrets.KIWI_PRODUCT_ID || '1' }}
          KIWI_TEST_PLAN_ID: ${{ secrets.KIWI_TEST_PLAN_ID || '1' }}
        run: |
          npx tsx scripts/kiwi-upload-enhanced.mts \
            --file vitest-results.json \
            --framework vitest \
            --product-id $KIWI_PRODUCT_ID \
            --test-plan-id $KIWI_TEST_PLAN_ID \
            --verbose
```

### 1.2 Verificar Configuração do Vitest

O arquivo `vitest.config.ts` deve gerar o arquivo JSON:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporter: ['text', 'json', 'html'],
    outputFile: {
      json: 'vitest-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'dist/'],
    },
  },
});
```

---

## Passo 2: Configurar Secrets do GitHub

### 2.1 Acessar Settings do Repositório

1. Vá para o repositório no GitHub
2. Clique em **Settings** (ícone de engrenagem)
3. No menu lateral, clique em **Secrets and variables** → **Actions**

### 2.2 Adicionar Secrets

Clique em **New repository secret** para cada um dos seguintes:

#### KIWI_URL

- **Name**: `KIWI_URL`
- **Value**: URL da sua instância do Kiwi TCMS
- **Exemplos**:
  - Local: `https://localhost:8443`
  - Produção: `https://kiwi-tcms.suaempresa.com`
  - Cloud: `https://public.tenant.kiwitcms.org`

#### KIWI_USERNAME

- **Name**: `KIWI_USERNAME`
- **Value**: Nome de usuário do Kiwi TCMS
- **Exemplo**: `admin`

#### KIWI_PASSWORD

- **Name**: `KIWI_PASSWORD`
- **Value**: Senha do usuário do Kiwi TCMS
- **Importante**: Use uma senha forte e específica para automação

#### KIWI_PRODUCT_ID (Opcional)

- **Name**: `KIWI_PRODUCT_ID`
- **Value**: ID do produto no Kiwi TCMS
- **Como encontrar**:
  1. Acesse o Kiwi TCMS
  2. Vá para **Products**
  3. Clique no produto desejado
  4. O ID estará na URL: `https://kiwi-tcms.com/products/1/`
  5. Use `1` se não configurar (será o primeiro produto criado)

#### KIWI_TEST_PLAN_ID (Opcional)

- **Name**: `KIWI_TEST_PLAN_ID`
- **Value**: ID do plano de teste no Kiwi TCMS
- **Como encontrar**:
  1. Acesse o Kiwi TCMS
  2. Vá para **Test Plans**
  3. Clique no plano desejado
  4. O ID estará na URL: `https://kiwi-tcms.com/plan/1/`
  5. Use `1` se não configurar (será o primeiro plano criado)

---

## Passo 3: Testar Integração

### 3.1 Testar Localmente

Antes de fazer push, teste localmente:

```bash
# 1. Executar testes
npm test

# 2. Verificar se vitest-results.json foi gerado
ls -la vitest-results.json

# 3. Testar upload manual
export KIWI_URL="https://sua-instancia.com"
export KIWI_USERNAME="admin"
export KIWI_PASSWORD="sua-senha"
npx tsx scripts/kiwi-upload-enhanced.mts \
  --file vitest-results.json \
  --framework vitest \
  --verbose
```

### 3.2 Fazer Push e Verificar Workflow

```bash
# Fazer push para branch configurada
git add .
git commit -m "test: configure kiwi tcms integration"
git push origin main
```

1. Acesse o repositório no GitHub
2. Clique na aba **Actions**
3. Verifique o workflow "Upload Test Results to Kiwi TCMS"
4. Clique no run mais recente
5. Verifique os logs para confirmar sucesso

### 3.3 Verificar Resultados no Kiwi TCMS

1. Acesse sua instância do Kiwi TCMS
2. Vá para **Test Runs**
3. Verifique se um novo TestRun foi criado
4. O nome será algo como `AutoTest-2026-03-19`
5. Confirme que os resultados dos testes estão visíveis

---

## Passo 4: Configurar Integração com Alertas

### 4.1 Ativar Notificações no Workflow

Adicione o passo de alertas após o upload:

```yaml
- name: Check and send alerts
  if: always()
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
  run: |
    # Carregar resultados
    if [ -f "vitest-results.json" ]; then
      PASSED=$(node -e "console.log(require('./vitest-results.json').numPassedTests)")
      FAILED=$(node -e "console.log(require('./vitest-results.json').numFailedTests)")
      TOTAL=$(node -e "console.log(require('./vitest-results.json').numTotalTests)")
      PASS_RATE=$(node -e "console.log((${PASSED}/${TOTAL}).toFixed(4))")
      
      # Enviar alerta se houver falhas
      if [ $FAILED -gt 0 ]; then
        npx tsx scripts/kiwi-alert-engine.ts \
          --pass-rate $PASS_RATE \
          --failed $FAILED \
          --total $TOTAL \
          --build-id ${{ github.run_number }}
      fi
    fi
```

### 4.2 Adicionar Secrets de Notificação

Além dos secrets do Kiwi TCMS, adicione:

- `SLACK_WEBHOOK_URL`: URL do webhook do Slack
- `DISCORD_WEBHOOK_URL`: URL do webhook do Discord

(Consulte `docs/notification-channels.md` para configuração completa)

---

## Passo 5: Personalização

### 5.1 Alterar Branches Trigger

Modifique as branches que acionam o workflow:

```yaml
on:
  push:
    branches: [ main, develop, staging, release/* ]
  pull_request:
    branches: [ main, develop ]
```

### 5.2 Alterar Frequência de Upload

Por padrão, o workflow executa a cada push. Para executar apenas em PRs:

```yaml
on:
  pull_request:
    branches: [ main ]
```

### 5.3 Adicionar Upload Condicional

Executar upload apenas se houver alterações nos testes:

```yaml
- name: Run tests and upload
  run: |
    npm test
    if [ $? -ne 0 ]; then
      echo "Tests failed, but uploading results..."
    fi
```

---

## Troubleshooting

### Erro: "vitest-results.json not found"

**Causa**: O Vitest não está configurado para gerar o arquivo JSON.

**Solução**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    reporter: ['text', 'json', 'html'],
    outputFile: {
      json: 'vitest-results.json',
    },
  },
});
```

### Erro: "Authentication failed"

**Causa**: Credenciais incorretas ou instância inacessível.

**Solução**:
1. Verifique se os secrets estão configurados corretamente
2. Teste acesso à instância do Kiwi TCMS
3. Verifique se o usuário tem permissão para criar TestRuns

### Erro: "Product not found"

**Causa**: ID do produto incorreto ou produto não existe.

**Solução**:
1. Acesse o Kiwi TCMS
2. Verifique o ID do produto na URL
3. Configure o secret `KIWI_PRODUCT_ID`

### Erro: "TestRun creation failed"

**Causa**: Permissões insuficientes ou plano de teste inválido.

**Solução**:
1. Verifique se o usuário tem permissão de "TestRun.add"
2. Verifique se o plano de teste existe
3. Configure o secret `KIWI_TEST_PLAN_ID`

### Workflow falha mas não há logs detalhados

**Causa**: `continue-on-error: true` oculta erros.

**Solução**: Remova `continue-on-error` temporariamente para depurar:

```yaml
- name: Run tests
  run: npm test
  # Remova continue-on-error para depurar
```

---

## Melhores Práticas

### 1. Versionamento de Builds

Use build numbers do GitHub:

```yaml
- name: Create TestRun
  run: |
    BUILD_NAME="Build-${{ github.run_number }}-${{ github.sha }}"
    echo "Creating build: $BUILD_NAME"
```

### 2. Histórico de Resultados

Mantenha histórico configurando retention days:

```yaml
- name: Upload test artifacts
  uses: actions/upload-artifact@v4
  with:
    name: test-results-${{ github.run_id }}
    path: vitest-results.json
    retention-days: 90  # Mantém por 90 dias
```

### 3. Paralelização

Para projetos grandes, execute testes em paralelo:

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
    total-shards: [4]

- name: Run tests
  run: npm test -- --shard=${{ matrix.shard }}/${{ matrix.total-shards }}
```

### 4. Cache de Dependências

Use cache para acelerar builds:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'  # Cache automático de node_modules
```

### 5. Upload Apenas em Sucesso

Para fazer upload apenas se testes passarem:

```yaml
- name: Upload results
  if: success()  # Apenas se testes passarem
  run: |
    npx tsx scripts/kiwi-upload-enhanced.mts ...
```

---

## Exemplos de Uso

### Exemplo 1: Upload Apenas em Main Branch

```yaml
on:
  push:
    branches: [ main ]  # Apenas main
```

### Exemplo 2: Upload em Todos os Branches com Tag

```yaml
on:
  push:
    tags:
      - 'v*.*.*'  # v1.0.0, v2.1.3, etc.
```

### Exemplo 3: Upload Manual

```yaml
on:
  workflow_dispatch:  # Apenas manual
```

Depois, no GitHub: **Actions** → **Upload Test Results** → **Run workflow**

---

## Integração com Outros Workflows

### Com CI/CD

Adicione ao seu workflow principal:

```yaml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      
      - name: Upload to Kiwi TCMS
        if: always()
        env:
          KIWI_URL: ${{ secrets.KIWI_URL }}
          KIWI_USERNAME: ${{ secrets.KIWI_USERNAME }}
          KIWI_PASSWORD: ${{ secrets.KIWI_PASSWORD }}
        run: |
          npx tsx scripts/kiwi-upload-enhanced.mts ...
```

### Com Deploy

```yaml
deploy:
  needs: test
  if: success() && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to production
      run: ./deploy.sh
```

---

## Monitoramento e Alertas

### Monitorar Workflow Status

1. Acesse **Actions** no repositório
2. Veja o histórico de execuções
3. Configure notificações de falhas:
   - **Settings** → **Notifications**
   - Ative "Workflow runs"

### Configurar Email de Falhas

1. **Settings** → **Notifications**
2. Selecione "Email"
3. Escolha "Failed workflows"
4. Salve

---

## Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kiwi TCMS API Documentation](https://kiwitcms.readthedocs.io/)
- [Vitest Configuration](https://vitest.dev/config/)
- [Escapte Kit Alert System](docs/notification-channels.md)

---

**Última atualização**: 2026-03-19  
**Versão**: 1.0.0