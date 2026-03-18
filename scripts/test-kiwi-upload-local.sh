#!/bin/bash

# Script para testar o upload do Kiwi TCMS localmente
# Uso: ./scripts/test-kiwi-upload-local.sh

set -e

echo "🧪 Teste Local de Upload para Kiwi TCMS"
echo "=========================================="
echo ""

# Verificar se vitest-results.json existe
if [ ! -f "vitest-results.json" ]; then
    echo "❌ Erro: vitest-results.json não encontrado"
    echo "   Execute 'npm test' primeiro para gerar o arquivo"
    exit 1
fi

echo "✅ vitest-results.json encontrado"
echo ""

# Verificar variáveis de ambiente
if [ -z "$KIWI_URL" ]; then
    echo "⚠️  KIWI_URL não está definida"
    echo "   Defina as variáveis de ambiente:"
    echo ""
    echo "   export KIWI_URL='https://sua-instancia-kiwi-tcms.com'"
    echo "   export KIWI_USERNAME='seu-usuario'"
    echo "   export KIWI_PASSWORD='sua-senha'"
    echo "   export KIWI_PRODUCT_ID='1'"
    echo "   export KIWI_TEST_PLAN_ID='1'"
    echo ""
    exit 1
fi

# Verificar conexão com Kiwi TCMS
echo "🔍 Verificando conexão com Kiwi TCMS..."
echo "   URL: $KIWI_URL"
echo ""

# Testar conexão básica
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$KIWI_URL/xml-rpc/" || echo "000")
    
    if [ "$HTTP_CODE" = "000" ]; then
        echo "❌ Erro: Não foi possível conectar a $KIWI_URL"
        echo "   Verifique:"
        echo "   - A URL está correta?"
        echo "   - O serviço Kiwi TCMS está rodando?"
        echo "   - Há firewall bloqueando a conexão?"
        exit 1
    fi
    
    if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "405" ]; then
        echo "⚠️  Aviso: Resposta inesperada do servidor (HTTP $HTTP_CODE)"
        echo "   Isso pode indicar um problema com a URL ou autenticação"
    fi
    
    echo "✅ Conexão estabelecida (HTTP $HTTP_CODE)"
else
    echo "⚠️  curl não encontrado, pulando verificação de conexão"
fi
echo ""

# Testar autenticação
echo "🔑 Testando autenticação..."
AUTH_RESPONSE=$(curl -s -X POST "$KIWI_URL/xml-rpc/" \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"Auth.login\",
        \"params\": [\"$KIWI_USERNAME\", \"$KIWI_PASSWORD\"],
        \"id\": 1
    }" 2>/dev/null || echo "")

if echo "$AUTH_RESPONSE" | grep -q '"error"'; then
    echo "❌ Erro de autenticação:"
    echo "$AUTH_RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4
    echo ""
    echo "   Verifique:"
    echo "   - O usuário está correto?"
    echo "   - A senha está correta?"
    echo "   - O usuário tem permissão para fazer upload?"
    exit 1
fi

if [ -z "$AUTH_RESPONSE" ]; then
    echo "⚠️  Não foi possível verificar autenticação"
    echo "   Continuando mesmo assim..."
else
    echo "✅ Autenticação bem-sucedida"
fi
echo ""

# Executar upload
echo "📤 Executando upload de resultados..."
echo "   Arquivo: vitest-results.json"
echo ""

if npx tsx scripts/kiwi-upload-enhanced.mts \
    --file vitest-results.json \
    --framework vitest \
    --product-id ${KIWI_PRODUCT_ID:-1} \
    --test-plan-id ${KIWI_TEST_PLAN_ID:-1} \
    --verbose; then
    echo ""
    echo "✅ Upload completado com sucesso!"
    echo ""
    echo "📊 Próximos passos:"
    echo "   1. Configure as secrets no GitHub Actions"
    echo "   2. Re-execute o workflow"
    echo "   3. Verifique o TestRun criado no Kiwi TCMS"
    exit 0
else
    echo ""
    echo "❌ Upload falhou!"
    echo ""
    echo "🔍 Verifique:"
    echo "   - As IDs de produto e plano estão corretas?"
    echo "   - O usuário tem permissão para criar TestRuns?"
    echo "   - O produto e plano existem no Kiwi TCMS?"
    exit 1
fi