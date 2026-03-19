# Deploy Kiwi TCMS - Guia Completo

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `deploy-kiwi-cloud.sh` | Deploy para VM na nuvem (Oracle Cloud) |
| `setup-ssl.sh` | Configuração SSL com Let's Encrypt |
| `ngrok-kiwi.sh` | Ngrok com auto-update da secret no GitHub |

---

## Opção 1: Oracle Cloud Free Tier (Permanente)

### 1. Criar VM na Oracle Cloud

1. Acesse [oracle.com/cloud/free](https://oracle.com/cloud/free)
2. Crie uma instância VM:
   - Shape: VM.Standard.E2.1.Micro (1 OCPU, 1 GB RAM)
   - OS: Ubuntu 22.04 ou 24.04
   - Boot volume: 50 GB

### 2. Executar Deploy

```bash
# Copie sua chave SSH
./scripts/deploy-kiwi-cloud.sh <IP_VM> ~/.ssh/sua_chave [SENHA_ADMIN]

# Exemplo:
./scripts/deploy-kiwi-cloud.sh 123.45.67.89 ~/.ssh/oracle_key SenhaForte123!
```

### 3. Configurar SSL (Opcional)

```bash
# Configure domínio primeiro (ex: DuckDNS)
./scripts/setup-ssl.sh <IP_VM> ~/.ssh/sua_chave seu-dominio.duckdns.org email@exemplo.com
```

### 4. Atualizar Secret no GitHub

No GitHub: Settings → Secrets and variables → Actions → KIWI_URL

Defina para: `https://seu-dominio` (ou `http://IP:8080` sem SSL)

---

## Opção 2: Ngrok (Temporário)

### Configuração Automática

```bash
# Configure o token do GitHub (veja abaixo)
export GITHUB_TOKEN=ghp_seu_token_aqui

# Inicie o ngrok
./scripts/ngrok-kiwi.sh 8443
```

O script vai:
1. Iniciar ngrok na porta 8443
2. Obter URL pública
3. Atualizar secret KIWI_URL automaticamente
4. Manter ngrok rodando

### Obter GitHub Token

1. Vá para: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Clique "Generate new token (classic)"
3. Defina nome: `ngrok-updater`
4. Marque escopo: `repo` (acesso total)
5. Gere e copie o token

### Variáveis de Ambiente

```bash
# Adicione ao seu ~/.bashrc:
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

---

## Variáveis de Ambiente do Kiwi TCMS

| Variável | Descrição | Padrão |
|----------|------------|--------|
| `KIWI_URL` | URL do servidor | (obrigatório) |
| `KIWI_USERNAME` | Usuário admin | admin |
| `KIWI_PASSWORD` | Senha do admin | (obrigatório) |
| `KIWI_PRODUCT_ID` | ID do produto | 1 |
| `KIWI_TEST_PLAN_ID` | ID do test plan | 1 |

---

## Troubleshooting

### "Command not found: docker"

Execute na VM:
```bash
sudo apt update && sudo apt install docker.io
sudo usermod -aG docker $USER
# Faça logout e login
```

### "Failed to connect to database"

Verifique se o PostgreSQL está rodando:
```bash
docker ps
docker logs kiwi-postgres
```

### "Wrong username or password"

Recrie o admin:
```bash
docker exec -w /Kiwi kiwi-tcms python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tcms.settings.product')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='admin')
user.set_password('SUA_SENHA')
user.save()
print('Password updated!')
"
```

---

## Configuração Atual (ngrok)

- **URL**: https://paulita-unbreathed-blair.ngrok-free.dev
- **Usuário**: admin
- **Senha**: axfwxZMnJK

Para migrar para Oracle Cloud, siga os passos acima.
