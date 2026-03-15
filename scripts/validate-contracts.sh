#!/bin/bash
# validate-contracts.sh - Valida se todos os contratos factuais têm implementações correspondentes
# Uso: ./scripts/validate-contracts.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
KNOWLEDGE_BASE="$PROJECT_ROOT/knowledge-base"
SRC_DIR="$PROJECT_ROOT/src"
TESTS_DIR="$PROJECT_ROOT/tests"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🔍 Validando Contratos Factuais${NC}"
echo "Diretório: $KNOWLEDGE_BASE"
echo ""

total=0
implemented=0
pending=0
missing=0

# Itera sobre todos os contratos YAML
for contract in "$KNOWLEDGE_BASE"/*.yaml; do
    if [ ! -f "$contract" ]; then
        continue
    fi
    
    total=$((total + 1))
    filename=$(basename "$contract")
    echo -e "${BLUE}📄 Verificando: $filename${NC}"
    
    # Extrai detector_names das regras com action: implement_detector
    # Procura por padrões no formato: detector_name: "NomeDoDetector"
    detector_names=$(grep -A1 'action: "implement_detector"' "$contract" | grep 'detector_name:' | sed 's/.*detector_name: "\([^"]*\)".*/\1/' || echo "")
    
    if [ -z "$detector_names" ]; then
        echo -e "   ${YELLOW}⚠️  Sem detectores para implementar${NC}"
        continue
    fi
    
    # Verifica cada detector
    while IFS= read -r detector_name; do
        if [ -z "$detector_name" ]; then
            continue
        fi
        
        detector_file="$SRC_DIR/security/${detector_name}.ts"
        test_file="$TESTS_DIR/security/${detector_name}.test.ts"
        
        if [ -f "$detector_file" ]; then
            echo -e "   ${GREEN}✓ Detector: $detector_name${NC}"
            
            if [ -f "$test_file" ]; then
                echo -e "      ${GREEN}✓ Testes: $test_file${NC}"
                implemented=$((implemented + 1))
            else
                echo -e "      ${YELLOW}⚠️  Testes faltando: $test_file${NC}"
                pending=$((pending + 1))
            fi
        else
            echo -e "   ${RED}❌ Detector faltando: $detector_name${NC}"
            echo -e "      ${BLUE}Local esperado:${NC} $detector_file"
            missing=$((missing + 1))
        fi
    done <<< "$detector_names"
    
    # Verifica regras com action: add_test
    test_rules=$(grep -B2 'action: "add_test"' "$contract" | grep 'principle:' | sed 's/.*principle: "\([^"]*\)".*/\1/' || echo "")
    if [ -n "$test_rules" ]; then
        while IFS= read -r principle; do
            if [ -n "$principle" ]; then
                principle_display=$(echo "$principle" | cut -c1-60)
                echo -e "   ${YELLOW}⚠️  Teste necessário: $principle_display${NC}"
                pending=$((pending + 1))
            fi
        done <<< "$test_rules"
    fi
    
    # Verifica regras com action: create_polyfill
    polyfill_rules=$(grep -B2 'action: "create_polyfill"' "$contract" | grep 'detector_name:' | sed 's/.*detector_name: "\([^"]*\)".*/\1/' || echo "")
    if [ -n "$polyfill_rules" ]; then
        while IFS= read -r detector_name; do
            if [ -n "$detector_name" ]; then
                echo -e "   ${YELLOW}⚠️  Polyfill necessário: $detector_name${NC}"
                pending=$((pending + 1))
            fi
        done <<< "$polyfill_rules"
    fi
    
    echo ""
done

# Resumo
echo "=================================="
echo -e "${BLUE}📊 Resumo${NC}"
echo "=================================="
echo -e "Total de contratos: ${CYAN}$total${NC}"
total_rules=$((implemented + pending + missing))
echo -e "Regras detectadas: ${CYAN}$total_rules${NC}"
echo -e "${GREEN}✓ Implementados: $implemented${NC}"
echo -e "${YELLOW}⚠️  Pendentes: $pending${NC}"
echo -e "${RED}❌ Faltando: $missing${NC}"
echo ""

if [ $missing -gt 0 ]; then
    echo -e "${RED}⚠️  Existem $missing detectores faltando!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. Implemente os detectores em src/security/"
    echo "2. Adicione testes em tests/security/"
    echo "3. Atualize a seção 'traceability' nos contratos YAML"
    exit 1
elif [ $pending -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Existem $pending itens pendentes.${NC}"
    exit 0
else
    if [ $total -gt 0 ]; then
        echo -e "${GREEN}✅ Todos os detectores estão implementados!${NC}"
    else
        echo -e "${YELLOW}⚠️  Nenhum contrato encontrado em $KNOWLEDGE_BASE${NC}"
    fi
    exit 0
fi
