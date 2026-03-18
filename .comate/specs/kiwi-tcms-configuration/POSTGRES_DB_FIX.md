# Correção do Problema de Banco de Dados PostgreSQL

**Data:** 2026-03-17  
**Problema:** Kiwi TCMS não conseguia se conectar ao banco PostgreSQL

---

## 🔍 Diagnóstico do Problema

### Erro Original
```
django.core.exceptions.ImproperlyConfigured: 'postgresql' isn't an available database backend or couldn't be imported.
```

### Causa Raiz
O Kiwi TCMS estava configurado para usar o backend de banco de dados padrão (MySQL), mas o ambiente Docker estava provisionando um banco PostgreSQL. As variáveis de ambiente `KIWI_DB_HOST`, `KIWI_DB_PORT`, etc. não eram suficientes para indicar ao Django para usar o backend PostgreSQL correto.

---

## ✅ Solução Implementada

### Modificação no `docker-compose.kiwi.yml`

**Antes (INCORRETO):**
```yaml
environment:
  KIWI_DB_HOST: kiwi-postgres
  KIWI_DB_PORT: 5432
  KIWI_DB_NAME: kiwi
  KIWI_DB_USER: kiwi
  KIWI_DB_PASSWORD: kiwi_password
  KIWI_USE_EXTERNAL_EMAIL_SERVER: "False"
  KIWI_HTTPS: "False"
  KIWI_DOMAIN: "localhost:8080"
```

**Depois (CORRETO):**
```yaml
environment:
  KIWI_DB_ENGINE: django.db.backends.postgresql
  KIWI_DB_HOST: kiwi-postgres
  KIWI_DB_PORT: 5432
  KIWI_DB_NAME: kiwi
  KIWI_DB_USER: kiwi
  KIWI_DB_PASSWORD: kiwi_password
  KIWI_DB_SSLMODE: disable
  KIWI_USE_EXTERNAL_EMAIL_SERVER: "False"
  KIWI_HTTPS: "False"
  KIWI_DOMAIN: "localhost:8080"
```

### Mudanças Realizadas

1. **Adicionado `KIWI_DB_ENGINE: django.db.backends.postgresql`**
   - Indica ao Django para usar o backend PostgreSQL em vez do padrão (MySQL)
   - O Django requer o nome completo do backend: `django.db.backends.XXX`

2. **Adicionado `KIWI_DB_SSLMODE: disable`**
   - Desabilita SSL para conexões com PostgreSQL em ambiente de desenvolvimento
   - Evita erros de conexão devido a certificados SSL

3. **Mantido porta HTTPS 8443**
   - A porta 8443 já havia sido exposta anteriormente
   - Permite acesso via HTTPS com certificado autoassinado

---

## 🔄 Procedimento de Reinicialização

Após aplicar as correções no `docker-compose.kiwi.yml`, os containers foram reiniciados com um "fresh start":

```bash
docker compose -f docker-compose.kiwi.yml down -v
docker compose -f docker-compose.kiwi.yml up -d
```

**Observação:** A opção `-v` remove os volumes antigos para garantir que não haja dados corrompidos.

---

## ✅ Validação Após Correção

### Status dos Containers
```bash
$ docker compose -f docker-compose.kiwi.yml ps
NAME                      STATUS                        PORTS
kiwi-postgres-escapekit   Up 6 minutes (healthy)        5432/tcp
kiwi-tcms-escapekit       Up 5 minutes (healthy)        0.0.0.0:8080->8080/tcp
                                                        0.0.0.0:8443->8443/tcp
```

### Teste de Conectividade
```bash
$ curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/accounts/login/ --max-time 10
302
```

**Resultado:** HTTP 302 = ✅ FUNCIONANDO (redirecionamento normal para página de login)

### Logs do Kiwi TCMS
```bash
$ docker logs kiwi-tcms-escapekit --since 1m
172.18.0.1 - - [17/Mar/2026:12:50:47 +0000] "GET /accounts/login/ HTTP/1.1" 302 5 "-" "curl/8.14.1" "-"
```

**Resultado:** ✅ Sem erros de conexão com o banco de dados

---

## ?? Próximos Passos

Agora que o Kiwi TCMS está funcionando corretamente, o próximo passo é a configuração manual via navegador:

1. [ ] Acessar `https://localhost:8443` no navegador
2. [ ] Aceitar o certificado autoassinado
3. [ ] Fazer login com `admin/admin`
4. [ ] Criar produto "EscapeKit" e anotar Product ID
5. [ ] Criar plano de teste "Main Test Plan" e anotar Test Plan ID
6. [ ] Atualizar `config/kiwi-tcms.json` com o Test Plan ID
7. [ ] Executar upload: `npx tsx scripts/kiwi-upload.ts --file vitest-results.json --framework vitest`

---

## 📚 Referências

- [Django Database Backends](https://docs.djangoproject.com/en/stable/ref/settings/#databases)
- [Kiwi TCMS Configuration](https://kiwitcms.readthedocs.io/en/latest/admin.html#initial-configuration)
- [PostgreSQL SSL Mode](https://www.postgresql.org/docs/current/libpq-ssl.html)

---

**Resumo:** O problema foi resolvido adicionando a variável de ambiente `KIWI_DB_ENGINE: django.db.backends.postgresql` ao arquivo `docker-compose.kiwi.yml`. Isso garante que o Kiwi TCMS (baseado em Django) use o backend correto para se conectar ao banco PostgreSQL provisionado via Docker.

**Status:** ✅ RESOLVIDO - Kiwi TCMS funcionando e pronto para configuração manual.