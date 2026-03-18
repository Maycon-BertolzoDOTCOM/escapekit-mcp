#!/bin/bash

# Script de teste local para integração Kiwi TCMS
# Uso: ./scripts/test-kiwi-integration-local.sh

set -e

echo "🧪 Teste Local de Integração Kiwi TCMS"
echo "========================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
    echo ""
    echo "Crie um arquivo .env com as seguintes variáveis:"
    echo ""
    echo "KIWI_URL=https://sua-instancia-kiwi-tcms.com"
    echo "KIWI_USERNAME=seu-usuario"
    echo "KIWI_PASSWORD=sua-senha"
    echo "KIWI_PRODUCT_ID=1"
    echo "KIWI_TEST_PLAN_ID=1"
    echo ""
    echo "Ou use valores padrão para teste local."
    exit 1
fi

# Carregar variáveis de ambiente
export $(cat .env | grep -v '^#' | xargs)

echo -e "${GREEN}✓ Variáveis de ambiente carregadas${NC}"
echo ""

# Verificar Node.js
echo "📦 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js não encontrado${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js $NODE_VERSION instalado${NC}"
echo ""

# Verificar npm
echo "📦 Verificando npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm não encontrado${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm $NPM_VERSION instalado${NC}"
echo ""

# Verificar dependências
echo "📦 Verificando dependências..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules não encontrado, executando npm install..."
    npm install
fi
echo -e "${GREEN}✓ Dependências instaladas${NC}"
echo ""

# Executar testes
echo "🧪 Executando testes..."
echo "Isso pode levar alguns minutos..."
echo ""
if ! npm test; then
    echo ""
    echo -e "${YELLOW}⚠️  Alguns testes falharam${NC}"
    echo "Continuando mesmo assim para testar upload de resultados..."
else
    echo ""
    echo -e "${GREEN}✓ Todos os testes passaram${NC}"
fi
echo ""

# Verificar se vitest-results.json foi gerado
echo "📄 Verificando arquivo de resultados..."
if [ ! -f "vitest-results.json" ]; then
    echo -e "${RED}✗ vitest-results.json não encontrado${NC}"
    echo ""
    echo "Verifique se vitest.config.ts está configurado corretamente:"
    echo ""
    echo "export default defineConfig({"
    echo "  test: {"
    echo "    reporter: ['text', 'json', 'html'],"
    echo "    outputFile: {"
    echo "      json: 'vitest-results.json',"
    echo "    },"
    echo "  },"
    echo "});"
    exit 1
fi
echo -e "${GREEN}✓ vitest-results.json encontrado${NC}"
echo ""

# Exibir estatísticas dos testes
echo "📊 Estatísticas dos Testes:"
TOTAL_TESTS=$(node -e "console.log(require('./vitest-results.json').numTotalTests)")
PASSED_TESTS=$(node -e "console.log(require('./vitest-results.json').numPassedTests)")
FAILED_TESTS=$(node -e "console.log(require('./vitest-results.json').numFailedTests)")
PASS_RATE=$(node -e "console.log(((require('./vitest-results.json').numPassedTests / require('./vitest-results.json').numTotalTests) * 100).toFixed(2))")
echo "   Total: $TOTAL_TESTS"
echo "   Passados: $PASSED_TESTS"
echo "   Falharam: $FAILED_TESTS"
echo "   Taxa de aprovação: $PASS_RATE%"
echo ""

# Verificar configuração do Kiwi TCMS
echo "🔗 Verificando configuração do Kiwi TCMS..."
if [ -z "$KIWI_URL" ]; then
    echo -e "${RED}✗ KIWI_URL não definido${NC}"
    echo "Configure KIWI_URL no .env"
    exit 1
fi
if [ -z "$KIWI_USERNAME" ]; then
    echo -e "${RED}✗ KIWI_USERNAME não definido${NC}"
    echo "Configure KIWI_USERNAME no .env"
    exit 1
fi
if [ -z "$KIWI_PASSWORD" ]; then
    echo -e "${RED}✗ KIWI_PASSWORD não definido${NC}"
    echo "Configure KIWI_PASSWORD no .env"
    exit 1
fi

# Mascara URL para exibição
MASKED_URL=$(echo $KIWI_URL | sed 's/\/\/[^@]*@/\/\/**@/')
echo -e "${GREEN}✓ Configuração do Kiwi TCMS:${NC}"
echo "   URL: $MASKED_URL"
echo "   Usuário: $KIWI_USERNAME"
echo "   Produto ID: ${KIWI_PRODUCT_ID:-1 (padrão)}"
echo "   Plano de Teste ID: ${KIWI_TEST_PLAN_ID:-1 (padrão)}"
echo ""

# Verificar script de upload
echo "📤 Verificando script de upload..."
if [ ! -f "scripts/kiwi-upload-enhanced.mts" ]; then
    echo -e "${RED}✗ scripts/kiwi-upload-enhanced.mts não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Script de upload encontrado${NC}"
echo ""

# Confirmar antes de fazer upload
echo "🚀 Pronto para fazer upload para o Kiwi TCMS"
echo ""
read -p "Deseja continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Cancelado pelo usuário."
    exit 0
fi

# Fazer upload
echo ""
echo "📤 Fazendo upload para o Kiwi TCMS..."
echo ""
if npx tsx scripts/kiwi-upload-enhanced.mts \
    --file vitest-results.json \
    --framework vitest \
    --product-id ${KIWI_PRODUCT_ID:-1} \
    --test-plan-id ${KIWI_TEST_PLAN_ID:-1} \
    --verbose; then
    echo ""
    echo -e "${GREEN}✅ Upload concluído com sucesso!${NC}"
    echo ""
    echo "📊 Próximos passos:"
    echo "1. Acesse o Kiwi TCMS em: $KIWI_URL"
    echo "2. Vá para Test Runs para ver os resultados"
    echo "3. Verifique se os testes estão corretamente exibidos"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Falha no upload${NC}"
    echo ""
    echo "Verifique:"
    echo "1. Se a URL do Kiwi TCMS está correta e acessível"
    echo "2. Se as credenciais são válidas"
    echo "3. Se o usuário tem permissão para criar TestRuns"
    exit 1
fi

# Testar alertas se configurados
echo ""
echo "🔔 Testando alertas (se configurados)..."
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    echo -e "${GREEN}✓ Slack webhook configurado${NC}"
    echo "Testando envio de alerta..."
    npx tsx scripts/kiwi-alert-engine.ts \
        --pass-rate $PASS_RATE \
        --failed $FAILED_TESTS \
        --total $TOTAL_TESTS \
        --build-id 999 \
        --severity WARNING || true
fi
echo ""

echo -e "${GREEN}✅ Teste de integração concluído!${NC}"