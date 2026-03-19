#!/bin/bash
#
# Script de Configuração SSL - Let's Encrypt + Nginx
# Uso: ./setup-ssl.sh <IP_VM> <SSH_KEY> <DOMINIO> [ADMIN_EMAIL]
#
# Este script configura HTTPS com Let's Encrypt para o Kiwi TCMS
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ $# -lt 3 ]; then
    echo "Uso: $0 <IP_VM> <SSH_KEY> <DOMINIO> [ADMIN_EMAIL]"
    echo ""
    echo "Exemplo: $0 123.45.67.89 ~/.ssh/oracle_key meu-kiwi.duckdns.org admin@example.com"
    exit 1
fi

VM_IP="$1"
SSH_KEY="$2"
DOMAIN="$3"
ADMIN_EMAIL="${4:-admin@example.com}"

log_info "Configurando SSL para $DOMAIN..."

# Verificar se o domínio aponta para o IP
log_info "Verificando DNS..."
if ! host "$DOMAIN" | grep -q "$VM_IP"; then
    log_error "O domínio $DOMAIN não aponta para $VM_IP"
    log_error "Configure o DNS primeiro (ex: DuckDNS)"
    exit 1
fi

log_info "Instalando Nginx e Certbot na VM..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" << 'REMOTE'
    sudo apt update
    sudo apt install -y nginx certbot python3-certbot-nginx
REMOTE

log_info "Criando configuração Nginx..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" << REMOTE
    sudo tee /etc/nginx/sites-available/kiwi-tcms > /dev/null << 'NGINX_CONF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /xml-rpc/ {
        proxy_pass http://localhost:8080/xml-rpc/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    location / {
        proxy_pass https://localhost:8443;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /xml-rpc/ {
        proxy_pass https://localhost:8443/xml-rpc/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
NGINX_CONF
    
    sudo ln -sf /etc/nginx/sites-available/kiwi-tcms /etc/nginx/sites-enabled/
    sudo nginx -t
REMOTE

# Substituir placeholder
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" "sudo sed -i 's/DOMAIN_PLACEHOLDER/$DOMAIN/g' /etc/nginx/sites-available/kiwi-tcms"

log_info "Obtendo certificado Let's Encrypt..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" << REMOTE
    sudo certbot --nginx -d $DOMAIN --email $ADMIN_EMAIL --agree-tos --non-interactive --redirect
REMOTE

log_info "Reiniciando Nginx..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ubuntu@"$VM_IP" "sudo systemctl restart nginx"

log_info "=============================================="
log_info "SSL configurado com sucesso!"
log_info "=============================================="
log_info ""
log_info "Acesse o Kiwi TCMS em:"
log_info "  HTTPS: https://$DOMAIN"
log_info ""
log_info "URL para GitHub Actions:"
log_info "  KIWI_URL=https://$DOMAIN"
log_info ""
log_info "Nota: O certificado Let's Encrypt expira em 90 dias."
log_info "Para renovar automaticamente, execute:"
log_info "  sudo certbot renew --dry-run"
