# 🚨 Guia de Correção: Secret KIWI_URL no GitHub Actions

## Problema Identificado

**Erro no workflow:**
```
Error: getaddrinfo ENOTFOUND kiwi-tcms.seudominio.com
```

**Causa Raiz:**
A secret `KIWI_URL` no GitHub está com um valor antigo/placeholder (`kiwi-tcms.seudominio.com`) em vez da URL atual do ngrok (`https://paulita-unbreathed-blair.ngrok-free.dev`).

## 📋 Passo a Passo para Resolver

### Passo 1: Acessar as Secrets do Repositório

1. Acesse: https://github.com/safevisionb-dotcom/escapekit-mcp/settings/secrets/actions
2. Você verá a lista de secrets do repositório

### Passo 2: Atualizar a Secret KIWI_URL

1. Encontre a secret chamada `KIWI_URL`
2. Clique no botão **"Update"** ao lado dela
3. No campo de valor, insira **EXATAMENTE**:
   ```
   https://paulita-unbreathed-blair.ngrok-free.dev
   ```
4. **IMPORTANTE**: Não adicione barra no final (`/`)
5. Clique em **"Update secret"** para salvar

### Passo 3: Verificar Outras Secrets (Opcional mas Recomendado)

Verifique se as seguintes secrets também estão configuradas corretamente:

- `KIWI_USERNAME`: Seu usuário do Kiwi TCMS
- `KIWI_PASSWORD`: Sua senha do Kiwi TCMS
- `KIWI_PRODUCT_ID`: ID do produto (opcional, padrão é `1`)
- `KIWI_TEST_PLAN_ID`: ID do plano de teste (opcional, padrão é `1`)

### Passo 4: Confirmar que a Secret Foi Atualizada

Após atualizar, o GitHub **NÃO mostra o valor** da secret (por segurança), mas você pode confirmar que foi alterada:

1. Procure na lista de secrets uma coluna que mostra a data de atualização
2. Verifique se `KIWI_URL` mostra a data/hora atual
3. Isso confirma que a secret foi modificada

### Passo 5: Executar o Workflow Manualmente

#### Opção A: Via Interface Web

1. Acesse: https://github.com/safevisionb-dotcom/escapekit-mcp/actions
2. No menu à esquerda, selecione: **"Upload Test Results to Kiwi TCMS"**
3. Clique no botão **"Run workflow"** no canto superior direito
4. Selecione o branch: `phase3-ci-cd-test`
5. Clique no botão verde **"Run workflow"**
6. Acompanhe a execução clicando no workflow que acabou de iniciar

#### Opção B: Via Git (se preferir)

```bash
git checkout phase3-ci-cd-test
git commit --allow-empty -m "trigger: re-run workflow with updated KIWI_URL"
git push origin phase3-ci-cd-test
```

### Passo 6: Monitorar a Execução

1. Clique no workflow em execução
2. Expanda o step **"Upload results to Kiwi TCMS"**
3. Procure por logs como:
   ```
   ✓ Loaded configuration from config/kiwi-tcms.json
     baseUrl: https://paulita-unbreathed-blair.ngrok-free.dev
   ```
4. Se ver este log, significa que a URL está correta!

### Passo 7: Verificar Sucesso

O step deve mostrar:
```
✓ Loaded X test results
✓ Status map initialized: { passed: 1, failed: 2, skipped: 3 }
✓ Found product by ID: EscapeKit (ID: 1)
✓ Using TestPlan ID: 1
✓ Build created: Auto-123 (ID: 456)
✓ TestRun created with ID: 789
✓ Upload complete: 100 successful, 0 failed
✅ Upload complete!
```

## 🧪 Teste Rápido (Opcional)

Se você quiser testar se a URL está correta antes de rodar o workflow completo, adicione um step temporário ao workflow:

```yaml
- name: Test ngrok connection
  run: |
    echo "Testing connection to Kiwi TCMS..."
    curl -k -f ${{ secrets.KIWI_URL }}/xml-rpc/ || exit 1
    echo "✓ Connection successful!"
```

Ou, para debug sem expor a secret:

```yaml
- name: Debug KIWI_URL
  run: |
    echo "KIWI_URL length: ${#KIWI_URL}"
    if [ -z "$KIWI_URL" ]; then
      echo "ERROR: KIWI_URL is not set!"
      exit 1
    fi
    echo "✓ KIWI_URL is configured"
  env:
    KIWI_URL: ${{ secrets.KIWI_URL }}
```

## 🔍 Como o Fluxo Funciona

### 1. Workflow (.github/workflows/kiwi-tcms.yml)

```yaml
- name: Upload results to Kiwi TCMS
  env:
    KIWI_URL: ${{ secrets.KIWI_URL }}
    KIWI_USERNAME: ${{ secrets.KIWI_USERNAME }}
    KIWI_PASSWORD: ${{ secrets.KIWI_PASSWORD }}
```

O workflow passa as secrets como variáveis de ambiente para o script.

### 2. Config File (config/kiwi-tcms.json)

```json
{
  "baseUrl": "${KIWI_URL}",
  "username": "${KIWI_USERNAME}",
  "password": "${KIWI_PASSWORD}",
  ...
}
```

O arquivo de config usa placeholders `${NOME_VAR}` que serão substituídos.

### 3. Script (scripts/kiwi-upload-enhanced.mts)

```typescript
// Substitui placeholders por variáveis de ambiente
const resolvedConfig = JSON.stringify(config).replace(
  /\$\{(\w+)\}/g,
  (_, key) => process.env[key] || ''
);
```

O script substitui `${KIWI_URL}` pelo valor da variável de ambiente.

### 4. Fallback (Se a secret não existir)

```typescript
config = {
  baseUrl: process.env.KIWI_URL || 'https://kiwi.example.com',
  ...
};
```

Se a secret não estiver configurada, usa um valor placeholder.

## ❌ Se o Erro Persistir Após Atualizar a Secret

### Verificação 1: Ngrok Ainda Está Rodando?

O ngrok precisa estar rodando no seu computador durante a execução do workflow.

```bash
# Verifique se o ngrok está ativo
docker ps | grep ngrok
# ou
ps aux | grep ngrok
```

Se não estiver rodando, inicie novamente:
```bash
ngrok http https://localhost:8443
```

### Verificação 2: URL do Ngrok Mudou?

URLs do ngrok mudam a cada sessão. Verifique a URL atual no terminal do ngrok:
```
Forwarding  https://NOVA-URL.ngrok-free.dev -> http://localhost:8443
```

Se mudou, atualize a secret novamente.

### Verificação 3: Script Está Lendo a Variável Correta?

Verifique no log do workflow:
```
✓ Loaded configuration from config/kiwi-tcms.json
  baseUrl: https://paulita-unbreathed-blair.ngrok-free.dev
```

Se mostrar uma URL diferente, o arquivo de config pode estar incorreto.

### Verificação 4: Há Alguma Cache no GitHub?

Às vezes o GitHub Actions cache secrets. Tente:
1. Renomeie a secret para `KIWI_URL_NEW`
2. Atualize o workflow para usar `KIWI_URL_NEW`
3. Execute o workflow
4. Se funcionar, renomeie de volta para `KIWI_URL`

## 📊 Logs Esperados vs Logs com Erro

### ✅ Logs Esperados (Sucesso)

```
🚀 Starting Kiwi TCMS upload via XML-RPC...
✓ Loaded configuration from config/kiwi-tcms.json
  baseUrl: https://paulita-unbreathed-blair.ngrok-free.dev
✓ Loaded 1145 test results

Test Statistics:
   Total: 1145
   Passed: 1120 (97.82%)
   Failed: 25
   Skipped: 0

Authenticating to Kiwi TCMS...
Looking up product...
✓ Found product by ID: EscapeKit (ID: 1)
✓ Using TestPlan ID: 1
✓ Status map initialized: { passed: 1, failed: 2, skipped: 3 }
✓ Using existing build: Auto-123 (ID: 456)

Creating TestRun: AutoTest-2026-03-19
✓ TestRun created with ID: 789

Uploading 1145 test results...
  Progress: 50/1145 (4.4%)
  Progress: 100/1145 (8.7%)

✓ Upload complete: 1145 successful, 0 failed

✅ Upload complete!
📊 TestRun ID: 789
🔗 View results at: https://paulita-unbreathed-blair.ngrok-free.dev/runs/789
```

### ❌ Logs com Erro (Secret Incorreta)

```
🚀 Starting Kiwi TCMS upload via XML-RPC...
✓ Loaded configuration from config/kiwi-tcms.json
  baseUrl: kiwi-tcms.seudominio.com
✓ Loaded 1145 test results

Authenticating to Kiwi TCMS...
Error: getaddrinfo ENOTFOUND kiwi-tcms.seudominio.com
```

### ❌ Logs com Erro (Secret Não Configurada)

```
🚀 Starting Kiwi TCMS upload via XML-RPC...
✗ Failed to load configuration: ENOENT: no such file or directory
Using environment variables...
  baseUrl: https://kiwi.example.com

Authenticating to Kiwi TCMS...
Error: getaddrinfo ENOTFOUND kiwi.example.com
```

## 🎯 Checklist Completo

- [ ] Acesse https://github.com/safevisionb-dotcom/escapekit-mcp/settings/secrets/actions
- [ ] Encontre e atualize a secret `KIWI_URL`
- [ ] Valor exato: `https://paulita-unbreathed-blair.ngrok-free.dev` (sem barra final)
- [ ] Confirme que a secret foi atualizada (verifique a data)
- [ ] Verifique que o ngrok está rodando localmente
- [ ] Execute o workflow manualmente
- [ ] Monitore os logs para ver `baseUrl: https://paulita-unbreathed-blair.ngrok-free.dev`
- [ ] Verifique que o upload foi bem-sucedido

## 💡 Dicas Adicionais

### Solução Permanente: URL Fixa

URLs do ngrok mudam a cada sessão. Para uma solução permanente:

1. **Usar ngrok com domínio personalizado** (pago)
2. **Hospedar Kiwi TCMS na nuvem** (Oracle Cloud, Railway, etc.)
3. **Usar um serviço de túnel com domínio fixo** (Cloudflare Tunnel, etc.)

### Script para Auto-Atualizar URL do Ngrok

Se o ngrok mudar com frequência, você pode criar um script que:
1. Detecta a nova URL do ngrok
2. Atualiza a secret via GitHub API
3. Dispara o workflow

### Variáveis de Ambiente Alternativas

Você também pode passar a URL diretamente no workflow sem usar secrets:

```yaml
- name: Upload results to Kiwi TCMS
  env:
    KIWI_URL: https://paulita-unbreathed-blair.ngrok-free.dev
  run: |
    npx tsx scripts/kiwi-upload-enhanced.mts ...
```

**⚠️ Cuidado**: Isso expõe a URL nos logs do workflow.

## 📞 Se Precisar de Ajuda

Se após seguir todos estes passos o erro ainda persistir:

1. Copie o log completo do step "Upload results to Kiwi TCMS"
2. Verifique a data de atualização da secret
3. Confirme que o ngrok está rodando e qual é a URL atual
4. Compartilhe todas essas informações para diagnóstico

---

**Última atualização**: 2026-03-19
**Status**: 🟡 Aguardando atualização da secret KIWI_URL
**Próxima ação**: Atualizar secret no GitHub e re-executar workflow