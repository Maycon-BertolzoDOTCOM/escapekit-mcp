# Deploy Kiwi TCMS no Railway

Este guia explica como fazer deploy do Kiwi TCMS Community Edition no Railway.

## Pré-requisitos

- Conta no [Railway](https://railway.app)
- Railway CLI instalada: `npm install -g @railway/cli`
- Docker (para testes locais opcionais)

## Opção 1: Deploy Automatizado

Execute o script automático:

```bash
cd scripts
chmod +x deploy-kiwi-railway.sh
./deploy-kiwi-railway.sh --auto
```

## Opção 2: Deploy Manual

### Passo 1: Criar projeto no Railway

1. Acesse https://railway.app
2. Clique em "New Project"
3. Selecione "Empty Project"
4. Nomeie como "kiwi-tcms"

### Passo 2: Adicionar PostgreSQL

1. No painel do projeto, clique em "New"
2. Selecione "Database" → "PostgreSQL"
3. Aguarde a criação

### Passo 3: Deploy do Kiwi TCMS

1. Clique em "New" → "Deploy from Docker image"
2. Use a imagem: `pub.kiwitcms.eu/kiwitcms/kiwi:latest`
3. Configure as variáveis:

| Variável         | Valor                                     |
| ---------------- | ----------------------------------------- |
| KIWI_DB_HOST     | Use a variável `POSTGRES_HOST` do Railway |
| KIWI_DB_PORT     | 5432                                      |
| KIWI_DB_NAME     | Use `POSTGRES_DB`                         |
| KIWI_DB_USER     | Use `POSTGRES_USER`                       |
| KIWI_DB_PASSWORD | Use `POSTGRES_PASSWORD`                   |
| KIWI_SECRET_KEY  | Gere com: `openssl rand -hex 32`          |

### Passo 4: Configuração Inicial

1. Acesse a URL gerada pelo Railway
2. Complete o setup inicial
3. Crie um usuário admin

### Passo 5: Obter URL de API

Sua URL de API será:

```
https://seu-projeto.up.railway.app/xml-rpc/
```

## Configuração no GitHub

Adicione as secrets no repositório:

| Secret            | Valor                                         |
| ----------------- | --------------------------------------------- |
| KIWI_URL          | `https://seu-projeto.up.railway.app/xml-rpc/` |
| KIWI_USERNAME     | Seu usuário                                   |
| KIWI_PASSWORD     | Sua senha                                     |
| KIWI_PRODUCT_ID   | 1                                             |
| KIWI_TEST_PLAN_ID | 1                                             |

## Troubleshooting

### Erro de conexão com banco

- Verifique as variáveis KIWI*DB*\*

### Erro de autenticação

- Verifique se o setup inicial foi concluído
- Confirme as credenciais

### Cookies não funcionam

- Esta configuração deve funcionar porque você controla a instância
- Se persistir, adicione `CSRF_COOKIE_SECURE = False` nas configurações

## Custos Estimados

- Railway Starter: $5/mês
- Opcional: $0 com plano gratuito (limitado)

## Referências

- [Kiwi TCMS Docker](https://github.com/kiwitcms/kiwi)
- [Railway Docs](https://docs.railway.app)
