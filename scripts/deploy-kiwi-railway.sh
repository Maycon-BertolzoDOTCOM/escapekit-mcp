#!/bin/bash

# =============================================================================
# Kiwi TCMS Deploy Script for Railway
# =============================================================================
# Este script facilita o deploy do Kiwi TCMS no Railway
# =============================================================================

set -e

echo "🍃 Kiwi TCMS - Railway Deployment Script"
echo "=========================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar pré-requisitos
check_prerequisites() {
    echo ""
    echo "Verificando pré-requisitos..."
    
    if ! command -v railway &> /dev/null; then
        echo -e "${RED}✗ Railway CLI não encontrado${NC}"
        echo "Instale com: npm install -g @railway/cli"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker não encontrado${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Pré-requisitos OK${NC}"
}

# Login no Railway
railway_login() {
    echo ""
    echo "Fazendo login no Railway..."
    railway login
}

# Criar projeto
create_project() {
    echo ""
    echo "Criando projeto Railway..."
    railway init --name "kiwi-tcms"
    
    # Criar variável BASE_URL
    echo "Configurando variáveis de ambiente..."
    railway variables set KIWI_SECRET_KEY="$(openssl rand -hex 32)"
}

# Adicionar PostgreSQL
add_database() {
    echo ""
    echo "Adicionando PostgreSQL..."
    railway add postgresql
}

# Deploy Kiwi TCMS
deploy_kiwi() {
    echo ""
    echo "Fazendo deploy do Kiwi TCMS..."
    
    # Usar a imagem oficial
    railway up -e DOCKER_IMAGE="pub.kiwitcms.eu/kiwitcms/kiwi:latest"
    
    echo ""
    echo "Configurando variáveis do Kiwi..."
    railway variables set KIWI_DB_HOST="\${POSTGRES_HOST}"
    railway variables set KIWI_DB_PORT="5432"
    railway variables set KIWI_DB_NAME="\${POSTGRES_DB}"
    railway variables set KIWI_DB_USER="\${POSTGRES_USER}"
    railway variables set KIWI_DB_PASSWORD="\${POSTGRES_PASSWORD}"
}

# Executar setup inicial
initial_setup() {
    echo ""
    echo -e "${YELLOW}Executando setup inicial...${NC}"
    echo "Nota: Você precisará criar o primeiro usuário manualmente via interface web"
    
    railway run python manage.py migrate
}

# Obter URL
get_url() {
    echo ""
    echo -e "${GREEN}Deploy concluído!${NC}"
    echo ""
    echo "URL do seu Kiwi TCMS:"
    railway domain
    echo ""
    echo "Próximos passos:"
    echo "1. Acesse a URL acima"
    echo "2. Crie uma conta de admin"
    echo "3. Configure as secrets no GitHub:"
    echo "   KIWI_URL=\$(railway domain)/xml-rpc/"
    echo "   KIWI_USERNAME=seu_usuario"
    echo "   KIWI_PASSWORD=sua_senha"
    echo "   KIWI_PRODUCT_ID=1"
    echo "   KIWI_TEST_PLAN_ID=1"
}

# Menu principal
show_menu() {
    echo ""
    echo "Escolha uma opção:"
    echo "1) Deploy completo (cria tudo do zero)"
    echo "2) Apenas verificar status"
    echo "3) Obter URL"
    echo "4) Sair"
    echo ""
    read -p "Opção: " option
    
    case $option in
        1)
            check_prerequisites
            railway_login
            create_project
            add_database
            deploy_kiwi
            initial_setup
            get_url
            ;;
        2)
            railway status
            ;;
        3)
            get_url
            ;;
        4)
            echo "Saindo..."
            exit 0
            ;;
        *)
            echo "Opção inválida"
            ;;
    esac
}

# Executar
if [ "$1" == "--auto" ]; then
    # Modo automático
    check_prerequisites
    railway_login
    create_project
    add_database
    deploy_kiwi
    get_url
else
    # Menu interativo
    show_menu
fi
