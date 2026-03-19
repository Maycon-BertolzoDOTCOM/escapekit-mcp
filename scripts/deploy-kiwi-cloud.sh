#!/bin/bash
#
# Script de Deploy - Kiwi TCMS para VM na Nuvem (Oracle Cloud)
# Uso: ./deploy-kiwi-cloud.sh <IP_VM> <SSH_KEY> [ADMIN_PASSWORD]
#
# Este script automatiza a configuração do Kiwi TCMS em uma VM remota
#

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funções de log
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar argumentos
if [ $# -lt 2 ]; then
    echo "Uso: $0 <IP_VM> <SSH_KEY> [ADMIN_PASSWORD]"
    echo ""
    echo "Argumentos:"
    echo "  IP_VM           - Endereço IP público da VM"
    echo "  SSH_KEY         - Caminho para a chave SSH (ex: ~/.ssh/oracle_key)"
    echo "  ADMIN_PASSWORD  - Senha do admin (opcional, padrão: KiwiAdmin123!)"
    exit 1
fi

VM_IP="$1"
SSH_KEY="$2"
ADMIN_PASSWORD="${3:-KiwiAdmin123!}"

log_info "Iniciando deploy do Kiwi TCMS na VM $VM_IP"

# Verificar se a chave SSH existe
if [ ! -f "$SSH_KEY" ]; then
    log_error "Chave SSH não encontrada: $SSH_KEY"
    exit 1
fi

# Testar conexão SSH
log_info "Testando conexão SSH..."
if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" "echo 'Conexão OK'" > /dev/null 2>&1; then
    log_error "Não foi possível conectar à VM via SSH"
    exit 1
fi
log_info "Conexão SSH OK"

# Criar diretório temporário local
TEMP_DIR=$(mktemp -d)
log_info "Diretório temporário: $TEMP_DIR"

# Modificar docker-compose para produção
cat > "$TEMP_DIR/docker-compose.kiwi.yml" << 'EOF'
version: '3.8'

services:
  kiwi-postgres:
    image: postgres:15-alpine
    container_name: kiwi-postgres
    environment:
      POSTGRES_DB: kiwi
      POSTGRES_USER: kiwi
      POSTGRES_PASSWORD: ${KIWI_DB_PASSWORD:-kiwi_password}
    volumes:
      - kiwi-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kiwi"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  kiwi-tcms:
    image: kiwitcms/kiwi:latest
    container_name: kiwi-tcms
    ports:
      - "8080:8080"
      - "8443:8443"
    environment:
      KIWI_DB_ENGINE: django.db.backends.postgresql
      KIWI_DB_HOST: kiwi-postgres
      KIWI_DB_PORT: 5432
      KIWI_DB_NAME: kiwi
      KIWI_DB_USER: kiwi
      KIWI_DB_PASSWORD: ${KIWI_DB_PASSWORD:-kiwi_password}
      KIWI_DB_SSLMODE: disable
      KIWI_USE_EXTERNAL_EMAIL_SERVER: "False"
      KIWI_HTTPS: "True"
      KIWI_DOMAIN: "${KIWI_DOMAIN:-localhost}"
    depends_on:
      kiwi-postgres:
        condition: service_healthy
    volumes:
      - kiwi-media-files:/Kiwi/media_files
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

volumes:
  kiwi-postgres-data:
  kiwi-media-files:
EOF

# Copiar arquivos para a VM
log_info "Copiando arquivos para a VM..."
scp -o StrictHostKeyChecking=no -i "$SSH_KEY" "$TEMP_DIR/docker-compose.kiwi.yml" ubuntu@"$VM_IP":~/

# Executar comandos na VM
log_info "Instalando Docker na VM (se necessário)..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" << 'REMOTE_COMMANDS'
    if ! command -v docker &> /dev/null; then
        echo "Instalando Docker..."
        sudo apt update
        sudo apt install -y docker.io
        sudo systemctl enable docker
        sudo systemctl start docker
        sudo usermod -aG docker ubuntu
    fi
    
    if ! command -v docker compose &> /dev/null; then
        echo "Instalando Docker Compose..."
        sudo apt install -y docker-compose-plugin
    fi
REMOTE_COMMANDS

log_info "Subindo contêineres..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" << 'REMOTE_COMMANDS'
    cd ~
    KIWI_DB_PASSWORD=kiwi_password docker compose -f docker-compose.kiwi.yml up -d
    echo "Aguardando serviços ficarem saudáveis..."
    sleep 30
REMOTE_COMMANDS"

log_info "Verificando status dos serviços..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" "docker compose -f docker-compose.kiwi.yml ps"

log_info "Executando migrações do banco de dados..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" << 'REMOTE_COMMANDS'
    for i in {1..30}; do
        if docker exec kiwi-postgres pg_isready -U kiwi &> /dev/null; then
            echo "PostgreSQL pronto!"
            break
        fi
        sleep 2
    done
    docker exec -w /Kiwi kiwi-tcms python manage.py migrate --noinput
REMOTE_COMMANDS"

log_info "Criando usuário admin..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" << REMOTE_COMMANDS
    docker exec -w /Kiwi kiwi-tcms python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tcms.settings.product')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    user = User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASSWORD')
    print('Admin created successfully!')
else:
    print('Admin already exists, updating password...')
    user = User.objects.get(username='admin')
    user.set_password('$ADMIN_PASSWORD')
    user.save()
    print('Password updated!')
"
REMOTE_COMMANDS"

log_info "Testando endpoint XML-RPC..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" "curl -k -s -X POST https://localhost:8443/xml-rpc/ -H 'Content-Type: text/xml' -d '<?xml version=\"1.0\"?><methodCall><methodName>Auth.login</methodName><params><param><value><string>admin</string></value></param><param><value><string>'$ADMIN_PASSWORD'</string></value></param></params></methodCall>' | head -20"

log_info "=============================================="
log_info "Deploy concluído!"
log_info "=============================================="
log_info ""
log_info "Acesse o Kiwi TCMS em:"
log_info "  HTTP:  http://$VM_IP:8080"
log_info "  HTTPS: https://$VM_IP:8443"
log_info ""
log_info "Credenciais:"
log_info "  Usuário: admin"
log_info "  Senha: $ADMIN_PASSWORD"
log_info ""
log_info "URL para GitHub Actions:"
log_info "  KIWI_URL=http://$VM_IP:8080"
log_info ""

rm -rf "$TEMP_DIR"
log_info "Deploy finalizado com sucesso!"
