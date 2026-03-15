#!/bin/bash
# publish-final.sh - Script para publicação final no npm

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   qwen-escapekit - Publicação Final no npm        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Passo 1: Verificar login atual
echo -e "${YELLOW}Passo 1: Verificando login atual...${NC}"
if npm whoami &> /dev/null; then
    echo -e "${GREEN}✓ Logado como: $(npm whoami)${NC}"
    read -p "Deseja manter este login? (s/n): " keep_login
    if [ "$keep_login" = "n" ]; then
        npm logout
        echo -e "${YELLOW}✓ Logout realizado${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Não logado${NC}"
fi

# Passo 2: Login (se necessário)
if ! npm whoami &> /dev/null; then
    echo ""
    echo -e "${YELLOW}Passo 2: Fazendo login no npm...${NC}"
    echo -e "${CYAN}IMPORTANTE: Use seu token de acesso granular (NÃO use senha!)${NC}"
    echo ""
    npm login --auth-type=legacy
    echo -e "${GREEN}✓ Login realizado${NC}"
fi

# Passo 3: Verificar nome do pacote
echo ""
echo -e "${YELLOW}Passo 3: Verificando disponibilidade do nome...${NC}"
if npm view qwen-escapekit &> /dev/null; then
    echo -e "${RED}❌ Nome 'qwen-escapekit' já existe no npm${NC}"
    echo ""
    echo "Opções:"
    echo "  1) Mudar nome no package.json (ex: @vectorsaviorz/qwen-escapekit)"
    echo "  2) Usar outro nome (ex: qwen-escapekit-cli)"
    echo "  3) Cancelar"
    echo ""
    read -p "Escolha uma opção: " option
    case $option in
        1)
            echo "Edite o package.json e adicione o escopo @vectorsaviorz/"
            exit 1
            ;;
        2)
            read -p "Novo nome: " new_name
            npm pkg set name="$new_name"
            echo -e "${GREEN}✓ Nome alterado para: $new_name${NC}"
            ;;
        3)
            echo -e "${YELLOW}Cancelado${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Opção inválida${NC}"
            exit 1
            ;;
    esac
else
    echo -e "${GREEN}✓ Nome 'qwen-escapekit' disponível${NC}"
fi

# Passo 4: Build
echo ""
echo -e "${YELLOW}Passo 4: Executando build...${NC}"
npm run build
echo -e "${GREEN}✓ Build concluído${NC}"

# Passo 5: Verificar dist/
echo ""
echo -e "${YELLOW}Passo 5: Verificando arquivos de build...${NC}"
if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ dist/index.js não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ dist/index.js encontrado${NC}"

# Passo 6: Verificar shebang
echo ""
echo -e "${YELLOW}Passo 6: Verificando shebang...${NC}"
if head -1 dist/index.js | grep -q "#!/usr/bin/env node"; then
    echo -e "${GREEN}✓ Shebang correto${NC}"
else
    echo -e "${RED}❌ Shebang ausente ou incorreto${NC}"
    exit 1
fi

# Passo 7: Publicar
echo ""
echo -e "${YELLOW}Passo 7: Publicando no npm...${NC}"
PACKAGE_NAME=$(node -p "require('./package.json').name")
echo -e "${BLUE}Nome do pacote: $PACKAGE_NAME${NC}"
echo -e "${BLUE}Versão: $(node -p "require('./package.json').version")${NC}"
echo ""
read -p "Confirmar publicação? (s/n): " confirm
if [ "$confirm" != "s" ]; then
    echo -e "${YELLOW}Cancelado${NC}"
    exit 0
fi

npm publish --access public --tag beta

echo -e "${GREEN}✓ Publicado com sucesso!${NC}"

# Passo 8: Verificar publicação
echo ""
echo -e "${YELLOW}Passo 8: Verificando publicação...${NC}"
npm view "$PACKAGE_NAME" || true

# Passo 9: Criar tag git
echo ""
echo -e "${YELLOW}Passo 9: Criando tag git...${NC}"
VERSION=$(node -p "require('./package.json').version")
git tag "qwen-escapekit/v$VERSION" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Tag já existe${NC}"
}
git push --tags 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Não foi possível pushar tags${NC}"
}

echo -e "${GREEN}✓ Tag criada${NC}"

# Resumo final
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ✓ Publicação concluída com sucesso!             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Próximos passos:${NC}"
echo "  1. Testar instalação: npm install -g ${PACKAGE_NAME}@beta"
echo "  2. Testar comando: ${PACKAGE_NAME} --help"
echo "  3. Verificar no npm: https://www.npmjs.com/package/${PACKAGE_NAME}"
echo "  4. Anunciar nas comunidades"
echo ""
