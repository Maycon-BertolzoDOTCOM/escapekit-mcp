#!/bin/bash
# publish-quick.sh - Publicação rápida da CLI qwen-escapekit
# Uso: ./publish-quick.sh

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   qwen-escapekit - Publicação Rápida              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Menu
echo -e "${CYAN}Escolha o tipo de publicação:${NC}"
echo "  1) Beta (recomendado para primeira versão)"
echo "  2) Estável"
echo "  3) Apenas teste local (npm pack)"
echo "  4) Cancelar"
echo ""
read -p "Opção: " option

case $option in
    1)
        TAG="beta"
        VERSION_TYPE="prerelease"
        ;;
    2)
        TAG="latest"
        VERSION_TYPE="patch"
        ;;
    3)
        echo ""
        echo -e "${YELLOW}Modo teste local selecionado${NC}"
        npm pack
        echo ""
        echo -e "${GREEN}✓ Pacote criado!${NC}"
        echo "Para instalar e testar:"
        echo "  npm install -g ./qwen-escapekit-*.tgz"
        echo "  qwen-escapekit --version"
        exit 0
        ;;
    4)
        echo -e "${YELLOW}Cancelado${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Opção inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}Passo 1/5: Verificando login no npm...${NC}"
if ! npm whoami &> /dev/null; then
    echo -e "${YELLOW}Login necessário. Execute:${NC}"
    echo "  npm login"
    echo ""
    read -p "Já fez login? (s/n): " logged
    if [ "$logged" != "s" ]; then
        npm login
    fi
fi
echo -e "${GREEN}✓ Login confirmado${NC}"
echo ""

echo -e "${YELLOW}Passo 2/5: Atualizando versão...${NC}"
echo "Tipos de versão:"
echo "  1) Patch (0.1.0 → 0.1.1)"
echo "  2) Minor (0.1.0 → 0.2.0)"
echo "  3) Major (0.1.0 → 1.0.0)"
echo "  4) Pre-release (0.1.0 → 0.1.0-beta.1)"
read -p "Tipo: " version_type

case $version_type in
    1)
        npm version patch
        ;;
    2)
        npm version minor
        ;;
    3)
        npm version major
        ;;
    4)
        npm version prerelease --preid=beta
        ;;
    *)
        echo -e "${RED}Tipo inválido${NC}"
        exit 1
        ;;
esac

NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✓ Nova versão: $NEW_VERSION${NC}"
echo ""

echo -e "${YELLOW}Passo 3/5: Executando preparação...${NC}"
./prepublish.sh || {
    echo -e "${RED}✗ Preparação falhou${NC}"
    exit 1
}
echo ""

echo -e "${YELLOW}Passo 4/5: Publicando no npm...${NC}"
if [ "$TAG" = "beta" ]; then
    npm publish --access public --tag beta
else
    npm publish --access public
fi

echo -e "${GREEN}✓ Publicado com sucesso!${NC}"
echo ""

echo -e "${YELLOW}Passo 5/5: Criando tag git...${NC}"
git tag "qwen-escapekit/v$NEW_VERSION"
git push --tags

echo -e "${GREEN}✓ Tag criada e enviada${NC}"
echo ""

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ✓ Publicação concluída!                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Próximos passos:${NC}"
echo "  1. Verifique em: https://www.npmjs.com/package/qwen-escapekit"
echo "  2. Teste: npm install -g qwen-escapekit"
echo "  3. Crie Release no GitHub"
echo "  4. Anuncie nas comunidades"
echo ""
echo -e "${GREEN}Versão publicada: $NEW_VERSION${NC}"
echo -e "${GREEN}Tag: ${CYAN}qwen-escapekit/v$NEW_VERSION${NC}"
echo ""
