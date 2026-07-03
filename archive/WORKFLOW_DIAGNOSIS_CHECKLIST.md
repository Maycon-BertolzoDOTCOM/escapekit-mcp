# Checklist de Diagnóstico Rápido - Workflows #12 e #13

## 📋 Verificações Imediatas

### 1. Obter o Log Completo (CRÍTICO)

**Passos:**
1. Acesse o workflow #12 (commit `cbb43f3`)
2. Clique no passo "Upload results to Kiwi TCMS" para expandir
3. Copie TODO o conteúdo (do início ao fim)
4. Cole aqui para análise

**O que procurar no log:**
- Mensagem "Looking up product..."
- Linha "✓ Found product by ID: ..." ou "✗ Product not found with ID: ..."
- Qualquer mensagem de erro ("Error:", "✗", "Failed", "exception")
- Stack trace completo
- Última linha antes do erro

### 2. Verificar Test Run no Kiwi TCMS

**Passos:**
1. Acesse seu servidor Kiwi TCMS de produção
2. Navegue para **Testing → Test Runs**
3. Procure Test Runs criados hoje (2026-03-19)
4. Verifique:
   - Nome do Test Run (provavelmente "AutoTest-2026-03-19")
   - Data de criação
   - Número de execuções de teste (~1145?)
   - Build associado (contém commit `cbb43f3`?)

**Resultados possíveis:**

| Resultado | Interpretação | Ação |
|-----------|---------------|------|
| Test Run encontrado com ~1145 execuções | Upload funcionou, mas script saiu com erro por outro motivo | Verificar log para identificar onde está o erro |
| Test Run não encontrado | Upload realmente falhou | Verificar autenticação, produto, plano |

### 3. Verificar Build no Kiwi TCMS

**Passos:**
1. Navegue para **Testing → Builds**
2. Procure builds criados hoje
3. Verifique se há build com:
   - Nome contendo `cbb43f3`
   - Branch `phase3-ci-cd-test`
   - Associado ao Test Plan "Main Test Plan"

### 4. Executar Diagnóstico Local (RECOMENDADO)

Se tiver acesso às credenciais de produção:

```bash
export KIWI_URL="https://seu-servidor-kiwi-tcms.com"
export KIWI_USERNAME="SEU_USUARIO_GITHUB_ACTIONS"
export KIWI_PASSWORD="SUA_SENHA_GITHUB_ACTIONS"

bash scripts/diagnose-kiwi-tcms.sh
```

**O que o script testa:**
1. ✅ Conectividade básica com o servidor
2. ✅ Endpoint XML-RPC acessível
3. ✅ Autenticação (Auth.login)
4. ✅ Listagem de produtos
5. ✅ Busca pelo produto "EscapeKit"

**Preste atenção em:**
- Produto "EscapeKit" aparece na lista?
- O ID é 1?
- O nome é exatamente "EscapeKit" ou "EscapetKit"?

## 🔍 Possíveis Causas da Falha

### Causa 1: Produto não encontrado

**Sintomas no log:**
```
Looking up product...
✗ Product not found with ID: 1
Available products:
  - Produto A (ID: 2)
  - Produto B (ID: 3)
```

**Solução:**
- Verificar qual o ID correto do produto "EscapeKit"
- Atualizar `KIWI_PRODUCT_ID` no GitHub Secrets

### Causa 2: Autenticação falhou

**Sintomas no log:**
```
Authenticating to Kiwi TCMS...
✗ Error looking up product by ID: Authentication failed
```

**Solução:**
- Verificar se `KIWI_USERNAME` está correto
- Verificar se `KIWI_PASSWORD` está correto
- Verificar se usuário tem permissão de API/XML-RPC

### Causa 3: Conexão/Timeout

**Sintomas no log:**
```
Looking up product...
✗ Error looking up product by ID: Connection timeout
```

**Solução:**
- Verificar se `KIWI_URL` está correto
- Verificar se servidor está acessível do GitHub Actions
- Verificar se há firewall bloqueando

### Causa 4: Erro em outra parte do script

**Sintomas no log:**
```
✓ Found product by ID: EscapeKit (ID: 1)
✓ Using TestPlan ID: 1
✓ Status map initialized: { passed: 1, failed: 2, skipped: 3, ... }
Creating new build with metadata...
✗ Failed to create build: [erro específico]
```

**Solução:**
- Analisar o erro específico
- Verificar se usuário tem permissão para criar builds
- Verificar se Test Plan existe

### Causa 5: Test Plan não encontrado

**Sintomas no log:**
```
✓ Found product by ID: EscapeKit (ID: 1)
✗ Test plan ID not specified
```
OU
```
Creating TestRun: AutoTest-2026-03-19
✗ Error: Test plan with ID 1 not found
```

**Solução:**
- Verificar se Test Plan ID 1 existe
- Verificar se está associado ao produto "EscapeKit"
- Atualizar `KIWI_TEST_PLAN_ID` se necessário

## 📊 Análise do Log - O que Fornecer

Quando você fornecer o log, inclua:

1. **O log completo do step "Upload results to Kiwi TCMS"**
   - Desde o início (primeira linha)
   - Até o final (última linha antes do erro)
   - Incluindo todas as mensagens de sucesso e erro

2. **Resultado das verificações no Kiwi TCMS**
   - Test Run encontrado? (sim/não)
   - Se sim: nome, quantidade de execuções, build associado
   - Build encontrado? (sim/não)
   - Se sim: nome, branch, commit

3. **Resultado do diagnóstico local** (se executou)
   - Saída completa do script `diagnose-kiwi-tcms.sh`
   - Produto "EscapeKit" aparece? (sim/não)
   - ID do produto "EscapeKit"? (qual?)
   - Nome exato do produto? ("EscapeKit" ou "EscapetKit"?)

## 🎯 Próximos Passos Conforme Resultado

### Se log mostrar "Product not found with ID: 1":
- Executar diagnóstico local para ver o ID correto
- Atualizar `KIWI_PRODUCT_ID` no GitHub Secrets
- Reexecutar workflow

### Se log mostrar erro de autenticação:
- Verificar credenciais no GitHub Secrets
- Executar diagnóstico local com as mesmas credenciais
- Reexecutar workflow

### Se log mostrar erro de conexão:
- Verificar `KIWI_URL` no GitHub Secrets
- Testar conectividade do GitHub Actions
- Verificar firewall/regras de rede

### Se Test Run foi criado mas workflow falhou:
- Verificar log para identificar onde está o erro
- Pode ser erro em etapa posterior do script
- Upload funcionou, precisamos corrigir o que causa o exit code 1

## ✅ Informações Mínimas Necessárias

Para que eu possa ajudar, preciso de:

- [ ] **Log completo** do step "Upload results to Kiwi TCMS" do workflow #12
- [ ] **Verificação** se Test Run foi criado no Kiwi TCMS
- [ ] **Resultado** do diagnóstico local (se possível executar)

Com essas informações, poderei identificar a causa exata e fornecer a solução apropriada!

---

**Aguardando o log completo para prosseguir com o diagnóstico.**
