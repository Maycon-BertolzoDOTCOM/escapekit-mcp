# Guia de Configuração Manual do Kiwi TCMS

## ✅ Status Atual

**Conteineres Docker:** ✅ Rodando e saudáveis
- `kiwi-postgres-escapekit`: Up e healthy
- `kiwi-tcms-escapekit`: Up e healthy

**Portas expostas:**
- HTTP: `0.0.0.0:8080->8080/tcp` (redireciona para HTTPS)
- HTTPS: `0.0.0.0:8443->8443/tcp` (agora exposta e funcionando)

**Acesso API:**
- HTTP (porta 8080): ✅ Respondendo com redirect 301 para HTTPS
- HTTPS (porta 8443): ✅ Disponível (requer aceitar certificado autoassinado)

## 🎯 Solução Recomendada: Configuração Manual via Navegador

Esta é a solução mais rápida e confiável. Siga os passos abaixo:

### Passo 1: Acessar o Kiwi TCMS via HTTPS

No seu navegador web, acesse:
```
https://localhost:8443
```

### Passo 2: Aceitar o Certificado Autoassinado

O navegador exibirá um aviso de segurança (porque o certificado é autoassinado):

**Chrome/Edge:**
1. Clique em "Avançado" (Advanced)
2. Clique em "Prosseguir para localhost (não seguro)" (Proceed to localhost (unsafe))

**Firefox:**
1. Clique em "Avançado..." (Advanced...)
2. Clique em "Aceitar o Risco e Continuar" (Accept the Risk and Continue)

### Passo 3: Fazer Login

- **Usuário:** `admin`
- **Senha:** `admin`

### Passo 4: Criar o Produto "EscapeKit"

1. No menu superior, clique em **Produto** (ou **Products**)
2. Clique no botão **Adicionar** (ou **Add**)
3. No campo "Nome" (ou **Name**), digite: `EscapeKit`
4. Clique em **Salvar** (ou **Save**)
5. **IMPORTANTE:** Anote o **Product ID** (será algo como `1`)

### Passo 5: Criar o Plano de Teste "Main Test Plan"

1. No menu superior, clique em **Test Plan**
2. Clique no botão **Adicionar** (ou **Add**)
3. No campo "Produto" (ou **Product**), selecione: `EscapeKit`
4. No campo "Nome" (ou **Name**), digite: `Main Test Plan`
5. Clique em **Salvar** (ou **Save**)
6. **IMPORTANTE:** Anote o **Test Plan ID** (será algo como `1`)

### Passo 6: Atualizar o Arquivo de Configuração

Edite o arquivo `config/kiwi-tcms.json`:

```json
{
  "baseUrl": "http://localhost:8080",
  "username": "admin",
  "password": "admin",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": 1,  // ← Substitua pelo Test Plan ID que você anotou
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3
}
```

**Nota:** Substitua `1` pelo `Test Plan ID` que você anotou no Passo 5.

### Passo 7: Testar o Upload

Após atualizar a configuração, execute o upload dos resultados de teste:

```bash
npx tsx scripts/kiwi-upload.ts --file vitest-results.json --framework vitest
```

## 🔍 Solução de Problemas

### Problema: Navegador não consegue acessar https://localhost:8443

**Solução 1:** Verifique se os containers estão rodando:
```bash
docker compose -f docker-compose.kiwi.yml ps
```

**Solução 2:** Verifique se a porta 8443 está aberta:
```bash
netstat -an | grep 8443
```

**Solução 3:** Tente usar um navegador diferente (Chrome, Firefox, Edge)

### Problema: Upload falha com erro de autenticação

**Solução:** 
1. Verifique se o `defaultPlanId` está correto em `config/kiwi-tcms.json`
2. Verifique se os containers estão rodando
3. Verifique os logs do Kiwi TCMS:
```bash
docker logs kiwi-tcms-escapekit --tail 50
```

### Problema: Não consigo criar o produto ou plano de teste

**Solução:**
1. Verifique se você está logado como `admin`
2. Verifique se tem permissões adequadas
3. Tente recarregar a página

## 📊 Próximos Passos Após Configuração Manual

1. ✅ Criar o produto "EscapeKit" e anotar o Product ID
2. ✅ Criar o plano de teste "Main Test Plan" e anotar o Test Plan ID
3. ✅ Atualizar `config/kiwi-tcms.json` com o Test Plan ID
4. ⏳ Executar o upload: `npx tsx scripts/kiwi-upload.ts --file vitest-results.json --framework vitest`
5. ⏳ Verificar os resultados na interface web do Kiwi TCMS
6. ⏳ Documentar a conclusão da Fase 4

## 📝 Referências

- [Kiwi TCMS Documentation](https://kiwitcms.readthedocs.io/)
- [Docker Compose Configuration](https://docs.docker.com/compose/)
- [Kiwi TCMS GitHub](https://github.com/kiwitcms/Kiwi)

## 🎓 Notas Importantes

- **HTTPS Redirect:** O Kiwi TCMS força HTTPS por padrão. Isso é um recurso de segurança.
- **Certificado Autoassinado:** Em ambiente de desenvolvimento, o certificado autoassinado é aceitável. Em produção, use um certificado válido (Let's Encrypt, por exemplo).
- **Portas:** As portas 8080 (HTTP) e 8443 (HTTPS) agora estão expostas e funcionando.
- **Configuração Manual:** Embora tenhamos tentado a automação, a configuração manual via navegador é mais rápida e confiável neste cenário.

## 🚀 Comandos Úteis

```bash
# Verificar status dos containers
docker compose -f docker-compose.kiwi.yml ps

# Verificar logs do Kiwi TCMS
docker logs kiwi-tcms-escapekit --tail 50

# Reiniciar os containers
docker compose -f docker-compose.kiwi.yml restart

# Parar os containers
docker compose -f docker-compose.kiwi.yml down

# Iniciar os containers
docker compose -f docker-compose.kiwi.yml up -d
```

---

**Última atualização:** 2026-03-17
**Status:** ✅ Containers rodando, pronto para configuração manual