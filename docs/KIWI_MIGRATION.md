# Migração Kiwi TCMS - ngrok para URL Permanente

## Estado Atual

- **Kiwi TCMS**: `localhost:8443` (Docker)
- **Acesso externo**: ngrok via `scripts/ngrok-kiwi.sh`
- **CI/CD**: usa `secrets.KIWI_URL` do GitHub

## Objetivo

Substituir ngrok por URL permanente.

## Proveedores Recomendados

| Provedor | Custo             | Cartão          | Observações       |
| -------- | ----------------- | --------------- | ----------------- |
| Railway  | Grátis            | Sim (não cobra) | Já no ecossistema |
| Render   | Grátis (750h/mês) | Não             | Login via GitHub  |
| Koyeb    | Grátis            | Não             | Deploy via Docker |
| Zeabur   | Grátis            | Não             | Deploy automático |

## Processo de Migração

### 1. Provisionar Kiwi TCMS

Escolher um provedor e fazer deploy da imagem `kiwitcms/kiwi`.

### 2. Atualizar GitHub Secrets

```
KIWI_URL=https://seu-kiwi.algumacoisa.app
KIWI_PASSWORD=nova_senha_admin
```

### 3. Desativar ngrok

```bash
mv scripts/ngrok-kiwi.sh scripts/ngrok-kiwi.sh.disabled
```

### 4. Testar

Executar workflow e verificar se o upload funciona.

## Rollback

Se precisar voltar ao ngrok:

```bash
mv scripts/ngrok-kiwi.sh.disabled scripts/ngrok-kiwi.sh
./scripts/ngrok-kiwi.sh
```
