#!/bin/bash

# Script para validar o projeto pisosrealview-pro com EscapeKit
# Este script será usado como base para o case study

PROJECT_PATH="$HOME/Transferências/pisosrealview-pro"
LOG_FILE="validation-pisosrealview-$(date +%Y%m%d-%H%M%S).log"

echo "============================================================"
echo "       🔍 VALIDAÇÃO: pisosrealview-pro"
echo "============================================================"
echo ""
echo "📅 Data: $(date)"
echo "📁 Projeto: $PROJECT_PATH"
echo "📋 Log: $LOG_FILE"
echo ""

# Verificar se o projeto existe
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ ERRO: Projeto não encontrado em $PROJECT_PATH"
    exit 1
fi

cd "$PROJECT_PATH"

echo "============================================================"
echo "       📊 ANÁLISE INICIAL"
echo "============================================================"
echo ""

# Contar arquivos TypeScript/JavaScript
TS_FILES=$(find . -name "*.ts" -o -name "*.tsx" | wc -l)
JS_FILES=$(find . -name "*.js" ! -path "*/node_modules/*" | wc -l)

echo "📄 Arquivos TypeScript: $TS_FILES"
echo "📄 Arquivos JavaScript: $JS_FILES"
echo ""

# Verificar package.json
if [ -f package.json ]; then
    echo "✅ package.json encontrado"
    echo ""
    echo "📦 Dependências principais:"
    cat package.json | grep -A 50 "dependencies" | head -20
else
    echo "❌ package.json não encontrado"
fi
echo ""

echo "============================================================"
echo "       🚨 DETECÇÃO DE GHOST IMPORTS"
echo "============================================================"
echo ""

# Buscar imports suspeitos
echo "📋 Imports de pacotes externos:"
echo ""
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.next/*" \
    ! -path "*/dist/*" \
    -exec grep -h "^import.*from ['\"]" {} \; 2>/dev/null | \
    sort | uniq | head -30

echo ""
echo "📋 Imports que NÃO estão no package.json:"
echo ""

# Extrair imports do código
IMPORTS=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.next/*" \
    ! -path "*/dist/*" \
    -exec grep -h "^import.*from ['\"]" {} \; 2>/dev/null | \
    sed "s/.*from ['\"]\([^'\"]*\)['\"].*/\1/" | \
    sed "s/@[^/]*\///" | \
    sort | uniq)

# Extrair dependências do package.json
if [ -f package.json ]; then
    DEPS=$(cat package.json | grep -A 100 "dependencies" | grep -v "devDependencies" | grep -v "^  }" | grep -v "^  " | sed 's/.*"\([^"]*\)".*/\1/' | sed 's/@[^/]*\///')
    
    echo "🔍 Potenciais ghost imports:"
    echo "$IMPORTS" | while read import; do
        if [ ! -z "$import" ]; then
            # Verificar se não é um caminho relativo
            if [[ ! "$import" =~ ^\.{1,2}/ ]]; then
                # Verificar se não está nas dependências
                if ! echo "$DEPS" | grep -q "^${import}$"; then
                    echo "  ⚠️  $import"
                fi
            fi
        fi
    done | head -20
fi
echo ""

echo "============================================================"
echo "       🏗️  ANÁLISE DE ARQUITETURA"
echo "============================================================"
echo ""

# Verificar estrutura de diretórios
echo "?? Estrutura de diretórios:"
ls -la | grep "^d" | awk '{print "  " $NF}'
echo ""

# Verificar arquivos de configuração
echo "⚙️  Arquivos de configuração:"
for config_file in tsconfig.json vite.config.ts tailwind.config.js next.config.js webpack.config.js; do
    if [ -f "$config_file" ]; then
        echo "  ✅ $config_file"
    fi
done
echo ""

echo "============================================================"
echo "       📋 PRÓXIMOS PASSOS"
echo "============================================================"
echo ""
echo "1. 📝 Documentar os problemas encontrados"
echo "2. 🔧 Executar escapekit analyze (quando disponível)"
echo "3. 🔄 Executar escapekit generate para transformar"
echo "4. ✅ Executar escapekit validate para testar"
echo "5. 📤 Testar kiwi-upload.ts com resultados"
echo "6. 🚀 Criar template Railway com projeto transformado"
echo ""

echo "============================================================"
echo "       ✅ VALIDAÇÃO CONCLUÍDA"
echo "============================================================"
echo ""
echo "Log salvo em: $LOG_FILE"
echo ""
echo "Próximo passo: Executar EscapeKit no projeto"
echo "============================================================"