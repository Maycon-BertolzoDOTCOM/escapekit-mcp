# Guia de Validação do Upload para Kiwi TCMS

## 📊 Situação Atual

**Workflow #10 (commit 51bc192)**
- ❌ Status: Exit code 1 (falhou)
- ✅ Job summary mostra mensagem de sucesso (mas é template)
- ❓ Incerteza: Upload realmente funcionou?

## 🔍 Como Verificar se o Upload Funcionou

### 1. Verificar Test Runs no Kiwi TCMS

**Passo 1: Acessar interface do Kiwi TCMS**
- URL do seu servidor de produção
- Login com suas credenciais

**Passo 2: Navegar para Test Runs**
- Menu: Testing → Test Runs
- Ou URL direta: `/testruns/`

**Passo 3: Filtrar por data/hora**
- Procure Test Runs criados na data do workflow
- O nome geralmente segue o padrão: `AutoTest-YYYY-MM-DD`
- Exemplo: `AutoTest-2026-03-19`

**Passo 4: Verificar detalhes do Test Run**
- Se encontrar, clique no Test Run
- Verifique:
  - Data de criação (deve coincidir com o workflow)
  - Número de execuções de teste (deve ser ~1145)
  - Status (Passed: 1133, Failed: 0, Skipped: 12)
  - Build associado (deve ter nome com commit SHA)

### 2. Verificar Builds no Kiwi TCMS

**Passo 1: Navegar para Builds**
- Menu: Testing → Builds
- Ou URL direta: `/builds/`

**Passo 2: Procurar build recente**
- Filtrar por data
- Nome do build geralmente inclui:
  - Commit SHA (ex: `51bc192`)
  - Data (ex: `2026-03-19`)
  - Branch (ex: `phase3-ci-cd-test`)

**Passo 3: Verificar detalhes do build**
- Clique no build
- Confirme se está associado ao Test Plan "Main Test Plan"
- Confirme se há execuções de teste vinculadas

### 3. Verificar logs do servidor Kiwi TCMS (se tiver acesso)

**Se você tem acesso SSH ao servidor:**

```bash
# Acessar logs do Kiwi TCMS
sudo journalctl -u kiwi-tcms -f

# Ou logs do nginx (se usar nginx)
sudo tail -f /var/log/nginx/access.log

# Filtrar por XML-RPC
grep "xml-rpc" /var/log/nginx/access.log | tail -50
```

**Procurar por:**
- Requisições POST para `/xml-rpc/`
- Auth.login
- TestRun.create
- TestExecution.create

### 4. Usar o API diretamente para verificar

**Fazer login via XML-RPC:**

```bash
curl -k -X POST $KIWI_URL/xml-rpc/ \
  -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?>
      <methodCall>
        <methodName>Auth.login</methodName>
        <params>
          <param><value><string>SEU_USUARIO</string></value></param>
          <param><value><string>SUA_SENHA</string></value></param>
        </params>
      </methodCall>'
```

**Listar Test Runs recentes:**

```bash
TOKEN="SEU_TOKEN_OBTIDO_ANTES"

curl -k -X POST $KIWI_URL/xml-rpc/ \
  -H "Content-Type: text/xml" \
  -d "<?xml version=\"1.0\"?>
      <methodCall>
        <methodName>TestRun.filter</methodName>
        <params>
          <param><value><string>$TOKEN</string></value></param>
          <param><value><struct></struct></value></param>
        </params>
      </methodCall>"
```

---

## 🐛 Por que o Workflow Retornou Exit Code 1?

### Possíveis Causas

#### 1. Erro no Script de Upload
O script `kiwi-upload-enhanced.mts` pode estar falhando em algum ponto:

**Locais prováveis de erro:**
- Linha 269: `await uploader.client.authenticate()` - Autenticação
- Linha 273: `await uploader.client.findProductByName()` - Produto não encontrado
- Linha 277: `process.exit(1)` - Produto não encontrado
- Linha 285: `process.exit(1)` - Test plan ID não especificado
- Linha 329-332: `catch` block - Qualquer erro não tratado

#### 2. Erro de Conexão/Timeout
- Timeout ao conectar com o servidor Kiwi TCMS
- Resposta lenta do servidor
- Problema de DNS

#### 3. Erro de Autenticação
- Credenciais incorretas nas secrets
- Usuário sem permissão de API
- Token expirado

#### 4. Erro de Produto/Plano
- Produto "EscapeKit" não existe no servidor de produção
- Test Plan ID 1 não existe ou não está associado ao produto
- IDs incorretos nas secrets

#### 5. Erro de SSL
- Certificado SSL não confiável
- Problema com a configuração `rejectUnauthorized: false`

### Como Diagnosticar

#### 1. Verificar Log Completo do Workflow

**Passo 1: Acessar o workflow no GitHub**
- Vá para Actions tab no repositório
- Clique no workflow #10 (commit 51bc192)
- Local: `.github/workflows/kiwi-tcms.yml`

**Passo 2: Expandir o step "Upload results to Kiwi TCMS"**
- Clique na seta ▼ ao lado do step
- Copie todo o log (do início ao fim)

**Passo 3: Procurar por mensagens de erro**
- Procure por `Error:`, `✗`, `Failed`, `exception`
- Procure pelo último comando antes do erro
- Procure por stack traces

#### 2. Testar Localmente com o Servidor de Produção

**Passo 1: Configurar variáveis de ambiente**

```bash
export KIWI_URL="https://SEU-SERVIDOR-KIWI-TCMS.com"
export KIWI_USERNAME="SEU_USUARIO_GITHUB_ACTIONS"
export KIWI_PASSWORD="SUA_SENHA_GITHUB_ACTIONS"
export KIWI_PRODUCT_ID="1"
export KIWI_TEST_PLAN_ID="1"
```

**Passo 2: Executar o script de diagnóstico**

```bash
bash scripts/diagnose-kiwi-tcms.sh
```

Este script vai:
1. Testar conectividade com o servidor
2. Testar autenticação
3. Listar produtos disponíveis
4. Verificar se o produto "EscapeKit" existe

**Passo 3: Executar o upload local**

```bash
npx tsx scripts/kiwi-upload-enhanced.mts \
  --file vitest-results.json \
  --framework vitest \
  --product-id 1 \
  --test-plan-id 1 \
  --verbose
```

#### 3. Usar curl para Testar a API

**Testar autenticação:**

```bash
KIWI_URL="https://SEU-SERVIDOR-KIWI-TCMS.com"
KIWI_USERNAME="SEU_USUARIO_GITHUB_ACTIONS"
KIWI_PASSWORD="SUA_SENHA_GITHUB_ACTIONS"

curl -k -s -X POST "$KIWI_URL/xml-rpc/" \
  -H "Content-Type: text/xml" \
  -d "<?xml version=\"1.0\"?>
      <methodCall>
        <methodName>Auth.login</methodName>
        <params>
          <param><value><string>$KIWI_USERNAME</string></value></param>
          <param><value><string>$KIWI_PASSWORD</string></value></param>
        </params>
      </methodCall>"
```

**Resposta esperada:**
```xml
<?xml version="1.0"?>
<methodResponse>
  <params>
    <param>
      <value><string>SEU_TOKEN_DE_SESSAO</string></value>
    </param>
  </params>
</methodResponse>
```

**Se falhar com "Authentication failed":**
- Verifique se o usuário existe
- Verifique se a senha está correta
- Verifique se o usuário tem permissão de API

**Testar listagem de produtos:**

```bash
TOKEN="SEU_TOKEN_OBTIDO_ANTES"

curl -k -s -X POST "$KIWI_URL/xml-rpc/" \
  -H "Content-Type: text/xml" \
  -d "<?xml version=\"1.0\"?>
      <methodCall>
        <methodName>Product.filter</methodName>
        <params>
          <param><value><string>$TOKEN</string></value></param>
          <param><value><struct></struct></value></param>
        </params>
      </methodCall>"
```

**Testar buscar produto "EscapeKit":**

```bash
curl -k -s -X POST "$KIWI_URL/xml-rpc/" \
  -H "Content-Type: text/xml" \
  -d "<?xml version=\"1.0\"?>
      <methodCall>
        <methodName>Product.filter</methodName>
        <params>
          <param><value><string>$TOKEN</string></value></param>
          <param><value><struct>
            <member>
              <name>name</name>
              <value><string>EscapeKit</string></value>
            </member>
          </struct></value></param>
        </params>
      </methodCall>"
```

---

## 📋 Próximos Passos Conforme Resultado

### Se o Upload FUNCIONOU (Test Run criado)

**Causa do exit code 1:**
- Pode ser um erro em uma parte posterior do workflow
- Ou o script está chamando `process.exit(1)` indevidamente após sucesso

**Ações:**
1. Verificar o log completo do workflow
2. Procurar onde exatamente o erro ocorre
3. Corrigir o script se necessário

### Se o Upload NÃO funcionou (nenhum Test Run criado)

**Causas prováveis:**
- Erro de autenticação
- Produto não encontrado
- Test Plan não encontrado
- Erro de conexão

**Ações:**
1. Executar o script de diagnóstico localmente
2. Testar com curl para isolar o problema
3. Corrigir as secrets ou configuração
4. Criar produto/plano se necessário

### Se não tiver certeza

**Ações:**
1. Fornecer o log completo do workflow
2. Executar o script de diagnóstico localmente
3. Compartilhar os resultados

---

## 🎯 Resumo de Ações

### Ações Imediatas

1. ✅ Verificar se há Test Run criado no Kiwi TCMS (hoje, 2026-03-19)
2. ✅ Fornecer o log completo do step "Upload results to Kiwi TCMS"
3. ⏸️ Executar `scripts/diagnose-kiwi-tcms.sh` localmente apontando para produção

### Ações Dependendo do Resultado

**Se Test Run existe:**
- Investigar por que exit code 1
- Corrigir o script se necessário

**Se Test Run não existe:**
- Usar diagnóstico local para identificar problema
- Corrigir configuração ou secrets
- Reexecutar workflow

---

## 📚 Documentos Relacionados

- `GITHUB_ACTIONS_KIWI_TCMS_DIAGNOSTIC.md` - Guia completo de diagnóstico
- `scripts/diagnose-kiwi-tcms.sh` - Script de diagnóstico automatizado
- `ES_MODULE_FIX_SUMMARY.md` - Resumo da correção de imports
- `KIWI_TCMS_AUTH_FIX.md` - Documentação de correções de autenticação

---

## ❓ Perguntas para Responder

Por favor, responda às seguintes perguntas para ajudar no diagnóstico:

1. **Você encontrou algum Test Run criado em 2026-03-19?**
   - [ ] Sim, com nome "AutoTest-2026-03-19"
   - [ ] Sim, com outro nome (qual?)
   - [ ] Não, nenhum Test Run encontrado

2. **O Test Run tem ~1145 execuções de teste?**
   - [ ] Sim
   - [ ] Não, tem outro número (qual?)

3. **O log do workflow mostra alguma mensagem de erro específica?**
   - [ ] Sim (qual mensagem?)
   - [ ] Não, apenas exit code 1
   - [ ] Não tenho o log completo ainda

4. **Você pode executar o script de diagnóstico localmente apontando para o servidor de produção?**
   - [ ] Sim, vou fazer e compartilhar os resultados
   - [ ] Não, não tenho as credenciais de produção
   - [ ] Não, prefero fornecer apenas o log do GitHub

Com essas respostas, poderei diagnosticar e resolver o problema com precisão!