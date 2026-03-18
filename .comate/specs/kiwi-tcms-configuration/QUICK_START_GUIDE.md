# 🚀 Guia Rápido - Configuração do Kiwi TCMS

**Status**: Scripts corrigidos para ES modules ✅

## ✅ O Que Foi Corrigido

### 1. Scripts Corrigidos para ES Modules

**Arquivo**: `scripts/kiwi-upload.ts`
- ✅ Substituído `require('./load-test-results')` por `import { loadTestResults } from './load-test-results.js'`
- ✅ Substituído `if (require.main === module)` por `if (import.meta.url === \`file://${process.argv[1]}\`)`

**Arquivo**: `scripts/load-test-results.ts`
- ✅ Substituído `if (require.main === module)` por `if (import.meta.url === \`file://${process.argv[1]}\`)`

## 📋 Passos para Configuração Manual

### Passo 1: Acessar Kiwi TCMS via Navegador

**Status**: Containers rodando ✅
```bash
docker compose -f docker-compose.kiwi.yml ps
```

1. Abra seu navegador em: `http://localhost:8080`
2. **Importante**: Aceite o certificado autoassinado (Avançado → Prosseguir)
3. Faça login com:
   - Usuário: `admin`
   - Senha: `admin`

### Passo 2: Criar Produto "EscapeKit"

1. Clique em **Products** no menu superior
2. Clique em **New Product**
3. Preencha:
   - Name: `EscapeKit`
4. Clique em **Save**
5. **Anote o Product ID** (aparece na URL)

### Passo 3: Criar Plano de Teste

1. Clique em **Test Plans** no menu superior
2. Clique em **New Test Plan**
3. Preencha:
   - Name: `Main Test Plan`
   - Product: Selecione `EscapeKit`
4. Clique em **Save**
5. **Anote o Test Plan ID** (aparece na URL)

### Passo 4: Atualizar Configuração

Edite o arquivo `config/kiwi-tcms.json`:

```json
{
  "baseUrl": "http://localhost:8080",
  "username": "admin",
  "password": "admin",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": 1,
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3
}
```

**Importante**: Substitua `1` pelo Test Plan ID anotado!

### Passo 5: Testar Upload

Use resultados reais de testes executados:

```bash
npx tsx scripts/kiwi-upload.ts --file vitest-results.json --framework vitest
```

## 🔧 Comandos Úteis

```bash
# Verificar status
docker compose -f docker-compose.kiwi.yml ps

# Verificar logs
docker compose -f docker-compose.kiwi.yml logs -f kiwi-tcms

# Reiniciar
docker compose -f docker-compose.kiwi.yml restart
```

## ✅ Checklist

- [x] Scripts corrigidos para ES modules
- [x] Containers rodando
- [ ] Login no Kiwi TCMS via navegador
- [ ] Produto "EscapeKit" criado
- [ ] Plano de teste criado
- [ ] Configuração atualizada (defaultPlanId)
- [ ] Upload testado com sucesso

## 📚 Documentação Adicional

- **Guia Completo**: `.comate/specs/kiwi-tcms-configuration/MANUAL_SETUP_GUIDE.md`
- **Status Técnico**: `.comate/specs/kiwi-tcms-configuration/KIWI_TCMS_CONFIG_STATUS.md`
- **Documentação Kiwi TCMS**: https://kiwitcms.readthedocs.io/

---

**Próxima Ação**: Acesse o Kiwi TCMS via navegador, configure e teste o upload