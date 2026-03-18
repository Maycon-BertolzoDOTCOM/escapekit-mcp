# Kiwi TCMS - Autenticação XML-RPC

## Problema

A instância pública `public.tenant.kiwitcms.org` não envia cookies de sessão via header `Set-Cookie` - uma medida de segurança que impede ataques XSS. Isso quebra a autenticação programática via XML-RPC com clientes Node.js.

### Sintomas

```
XML-RPC fault: Internal error: Wrong username or password
```

### O que foi testado

| Abordagem                             | Resultado   |
| ------------------------------------- | ----------- |
| Cliente .cjs com token como parâmetro | ❌ Falha    |
| Cliente .ts (HTTP) com cookie         | ❌ Falha    |
| tough-cookie + axios                  | ❌ Falha    |
| curl com arquivo de cookie            | ✅ Funciona |

### Por que curl funciona

O curl salva o cookie em arquivo local (`-c cookies.txt`) e o reutiliza (`-b cookies.txt`) nas requisições seguintes. Isso funciona porque:

1. O login retorna o token na resposta XML
2. O curl armazena o session ID
3. Nas requisições seguintes, o curl envia o cookie

Os clientes Node.js testados não conseguem manter o estado de sessão corretamente com esta instância.

---

## Soluções

### Opção A: Instância Própria (Recomendada)

Fazer deploy de uma instância própria do Kiwi TCMS.

#### Railway

1. Criar projeto no Railway
2. Adicionar PostgreSQL
3. Deploy do Kiwi TCMS:

```bash
docker run -d -p 8080:8080 \
  --name kiwitcms \
  -e KIWI_SECRET_KEY=your-secret \
  -e DB_HOST=$POSTGRES_HOST \
  -e DB_NAME=$POSTGRES_DB \
  -e DB_USER=$POSTGRES_USER \
  -e DB_PASSWORD=$POSTGRES_PASSWORD \
  kiwitcms/kiwi
```

#### DigitalOcean App Platform

1. Criar Droplet com Docker
2. Instalar PostgreSQL
3. Deploy do Kiwi TCMS via Docker Compose

### Opção B: Usar API REST

O Kiwi TCMS também expõe endpoints REST que podem ser mais fáceis de usar.

### Opção C: Usar curl no script

Modificar o script de upload para usar curl em vez de biblioteca Node.js.

---

## Configuração Atual

### Secrets do GitHub

| Secret              | Descrição            |
| ------------------- | -------------------- |
| `KIWI_URL`          | URL do Kiwi TCMS     |
| `KIWI_USERNAME`     | Usuário              |
| `KIWI_PASSWORD`     | Senha                |
| `KIWI_PRODUCT_ID`   | ID do produto        |
| `KIWI_TEST_PLAN_ID` | ID do plano de teste |

### Scripts

- `scripts/kiwi-upload-enhanced.mts` - Upload de resultados
- `scripts/load-test-results.ts` - Carrega resultados do Vitest
- `scripts/test-kiwi-connection-http.ts` - Testa conexão

---

## Referências

- [Kiwi TCMS Documentation](https://kiwitcms.readthedocs.io/)
- [Kiwi TCMS Docker](https://github.com/kiwitcms/kiwi)
- [tcms-api Python](https://github.com/kiwitcms/tcms-api)
