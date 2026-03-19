#!/bin/bash
#
# Script para iniciar ngrok e atualizar secret KIWI_URL no GitHub
# Uso: ./scripts/ngrok-kiwi.sh [PORT] [TOKEN_GITHUB]
#
# Variáveis de ambiente:
#   GITHUB_TOKEN - Token de acesso pessoal do GitHub
#   NGROK_PORT   - Porta do Kiwi TCMS (padrão: 8443)
#

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configurações padrão
PORT="${1:-8443}"
REPO="${2:-safevisionb-dotcom/escapekit-mcp}"
SECRET_NAME="KIWI_URL"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Verificar dependências
check_dependencies() {
    log_step "Verificando dependências..."
    
    if ! command -v ngrok &> /dev/null; then
        log_error "ngrok não encontrado. Instale em: https://ngrok.com/download"
        exit 1
    fi
    
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warn "GITHUB_TOKEN não definido. A secret não será atualizada automaticamente."
        log_warn "Para configurar: export GITHUB_TOKEN=ghp_xxxx"
        log_warn "Criando token: GitHub Settings → Developer settings → Personal access tokens"
        echo ""
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl não encontrado"
        exit 1
    fi
    
    log_info "Dependências OK"
    
    # Check for Python cryptography library (required for encrypting GitHub secrets)
    if ! command -v python3 &> /dev/null; then
        log_error "python3 não encontrado. Instale python3 para atualizar secrets."
        log_warn "Executando sem atualização automática de secrets."
    else
        # Check if pycryptodome is installed
        if ! python3 -c "from Crypto.PublicKey import RSA" 2>/dev/null; then
            # Try using openssl as fallback
            if ! command -v openssl &> /dev/null; then
                log_error "Nem pycryptodome nem openssl encontrados."
                log_error "Instale: pip install pycryptodome ou apt install openssl"
                log_warn "Executando sem atualização automática de secrets."
            fi
        fi
    fi
    
}

# Obter URL do ngrok
get_ngrok_url() {
    log_step "Obtendo URL do ngrok..."
    
    # Tentar obter via API local do ngrok
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4040/api/tunnels 2>/dev/null || echo "000")
        
        if [ "$status" = "200" ]; then
            local url=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | sed 's/"public_url":"//')
            if [ -n "$url" ]; then
                echo "$url"
                return 0
            fi
        fi
        
        attempts=$((attempts + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "Timeout ao obter URL do ngrok"
    return 1
}

# Atualizar secret no GitHub
update_github_secret() {
    local new_url="$1"
    
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warn "GITHUB_TOKEN não definido. Pulando atualização da secret."
        return 0
    fi
    
    log_step "Atualizando secret $SECRET_NAME no GitHub..."
    
    # Obter chave pública do repositório
    local pubkey_response
    pubkey_response=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO/actions/secrets/public-key")
    
    local pubkey
    local key_id
    pubkey=$(echo "$pubkey_response" | grep -o '"key":"[^"]*"' | head -1 | sed 's/"key":"//;s/"$//' | base64 -d 2>/dev/null || echo "")
    key_id=$(echo "$pubkey_response" | grep -o '"key_id":"[^"]*"' | sed 's/"key_id":"//;s/"$//')
    
    if [ -z "$pubkey" ] || [ -z "$key_id" ]; then
        log_error "Falha ao obter chave pública do GitHub"
        echo "$pubkey_response"
        return 1
    fi
    
    # Criptografar o valor (usando python para compatibilidade)
    local encrypted_value
    encrypted_value=$(python3 << PYEOF
import base64
import json
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP

key = RSA.import_key(base64.b64decode("$pubkey"))
cipher = PKCS1_OAEP.new(key)
encrypted = cipher.encrypt(b"$new_url")
print(base64.b64encode(encrypted).decode())
PYEOF
)
    
    if [ -z "$encrypted_value" ]; then
        # Fallback: usar openssl
        encrypted_value=$(echo -n "$new_url" | openssl pkeyutl -encrypt -pubin \
            -inkey <(echo "$pubkey" | base64 -d) \
            -pkeyopt rsa_padding_mode:oaep 2>/dev/null | base64 -w0) || {
            log_error "Falha na criptografia"
            return 1
        }
    fi
    
    # Atualizar secret
    local response
    response=$(curl -s -X PUT \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$REPO/actions/secrets/$SECRET_NAME" \
        -d "{\"encrypted_value\":\"$encrypted_value\",\"key_id\":\"$key_id\"}")
    
    if echo "$response" | grep -q '"message"'; then
        log_error "Falha ao atualizar secret: $response"
        return 1
    fi
    
    log_info "✓ Secret $SECRET_NAME atualizada para $new_url"
    return 0
}

# Iniciar ngrok
start_ngrok() {
    log_step "Iniciando ngrok na porta $PORT..."
    
    # Verificar se ngrok já está rodando
    if curl -s http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
        log_info "ngrok já está rodando"
    else
        ngrok http "$PORT" --log=stdout > /dev/null 2>&1 &
        sleep 3
    fi
    
    # Obter URL
    local url
    url=$(get_ngrok_url)
    
    if [ -z "$url" ]; then
        log_error "Não foi possível obter URL do ngrok"
        exit 1
    fi
    
    echo ""
    log_info "✓ ngrok iniciado: $url"
    echo "$url"
}

# Main
main() {
    echo "=============================================="
    echo "  🚀 Ngrok + Kiwi TCMS Auto-Updater"
    echo "=============================================="
    echo ""
    
    check_dependencies
    
    local url
    url=$(start_ngrok)
    
    update_github_secret "$url"
    
    echo ""
    echo "=============================================="
    log_info "Pronto! Acesse: $url"
    log_info "Pressione Ctrl+C para encerrar"
    echo "=============================================="
    
    # Manter ngrok rodando
    wait
}

# Trap para cleanup
cleanup() {
    log_warn "Encerrando ngrok..."
    pkill -f "ngrok http" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

main "$@"
