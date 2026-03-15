#!/bin/bash
# paper-to-contract.sh - Extrai metadados de papers e gera contrato factual YAML usando IA local
# Versão 2.0 - com suporte a Ollama (Qwen 2.5) para extração inteligente
# Uso: ./paper-to-contract.sh <URL_OU_DOI> [--output DIR] [--model MODELO]

set -euo pipefail

# Configurações padrão
DEFAULT_OUTPUT_DIR="knowledge-base"
DEFAULT_MODEL="qwen2.5:latest"

# Parse de argumentos
OUTPUT_DIR="$DEFAULT_OUTPUT_DIR"
MODEL="$DEFAULT_MODEL"
INPUT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --output|-o)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --model|-m)
            MODEL="$2"
            shift 2
            ;;
        --help|-h)
            echo "Uso: $0 <URL_OU_DOI> [--output DIR] [--model MODELO]"
            echo ""
            echo "Extrai metadados de papers acadêmicos e gera contratos factuais YAML usando IA local (Ollama)."
            echo ""
            echo "Argumentos:"
            echo "  URL_OU_DOI    URL do paper (arXiv, DOI.org) ou DOI direto"
            echo ""
            echo "Opções:"
            echo "  --output, -o  Diretório de saída (padrão: knowledge-base)"
            echo "  --model, -m   Modelo Ollama (padrão: qwen2.5:latest)"
            echo "  --help, -h    Mostra esta ajuda"
            echo ""
            echo "Exemplos:"
            echo "  $0 10.48550/arXiv.2603.10163"
            echo "  $0 https://arxiv.org/abs/2603.10163"
            echo "  $0 https://doi.org/10.1145/3597066 --output meus-papers"
            echo "  $0 10.1145/3597066 --model qwen2.5:9b"
            exit 0
            ;;
        *)
            if [ -z "$INPUT" ]; then
                INPUT="$1"
            else
                echo "Erro: Argumento desconhecido '$1'"
                exit 1
            fi
            shift
            ;;
    esac
done

if [ -z "$INPUT" ]; then
    echo "Erro: URL ou DOI não fornecido"
    echo "Use --help para ver como usar"
    exit 1
fi

TEMP_DIR=$(mktemp -d)
LOG_FILE="$OUTPUT_DIR/paper-to-contract.log"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função de log
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Função de erro
error() {
    log "${RED}❌ ERRO: $1${NC}"
    exit 1
}

# Verifica dependências básicas
command -v curl >/dev/null 2>&1 || error "curl é necessário. Instale com: sudo apt install curl"
command -v jq >/dev/null 2>&1 || error "jq é necessário. Instale com: sudo apt install jq"

# Cria diretório de saída se não existir
mkdir -p "$OUTPUT_DIR"

# Início
log "${GREEN}📄 Paper to Contract v2.0 - Extração Inteligente com IA Local${NC}"
log "${CYAN}URL/DOI: $INPUT${NC}"
log "${CYAN}Output dir: $OUTPUT_DIR${NC}"
log "${CYAN}Modelo Ollama: $MODEL${NC}"
echo ""

# Função para extrair DOI de diferentes formatos
extract_doi() {
    local input="$1"
    # Se já é um DOI (10.xxxx/yyyy)
    if [[ "$input" =~ ^10\. ]]; then
        echo "$input"
        return
    fi
    # Se é URL do DOI
    if [[ "$input" =~ doi\.org/(10\.[^/]+/.+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi
    # Se é arXiv (extrair ID)
    if [[ "$input" =~ arxiv\.org/(abs|pdf)/([0-9]+\.[0-9]+) ]]; then
        echo "arXiv:${BASH_REMATCH[2]}"
        return
    fi
    # Tenta extrair de página (simples)
    local page=$(curl -sL "$input" 2>/dev/null || echo "")
    if [ -n "$page" ]; then
        doi=$(echo "$page" | grep -oP '10\.\d{4,9}/[-._;()/:A-Z0-9]+' | head -1 || echo "")
        if [ -n "$doi" ]; then
            echo "$doi"
            return
        fi
    fi
    echo ""
}

# Extrai metadados via Crossref (se DOI)
fetch_metadata_crossref() {
    local doi="$1"
    log "${YELLOW}🔍 Consultando Crossref para DOI: $doi${NC}"
    local response=$(curl -s "https://api.crossref.org/works/$doi" 2>/dev/null || echo '{"status":"error"}')
    if echo "$response" | jq -e '.status == "ok"' >/dev/null 2>&1; then
        title=$(echo "$response" | jq -r '.message.title[0] // "No title"')
        authors=$(echo "$response" | jq -r '.message.author // [] | map(.family + ", " + .given) | join("; ")' | sed 's/^, //')
        year=$(echo "$response" | jq -r '.message.created."date-parts"[0][0] // ""')
        abstract=$(echo "$response" | jq -r '.message.abstract // ""')
        log "   ${GREEN}✓ Título:${NC} $title"
        log "   ${GREEN}✓ Autores:${NC} $authors"
        log "   ${GREEN}✓ Ano:${NC} $year"
        return 0
    else
        log "${RED}   Crossref não retornou dados válidos${NC}"
        return 1
    fi
}

# Extrai metadados de arXiv
fetch_metadata_arxiv() {
    local arxiv_id="$1"
    log "${YELLOW}🔍 Consultando arXiv para ID: $arxiv_id${NC}"
    local response=$(curl -s "http://export.arxiv.org/api/query?id_list=$arxiv_id" 2>/dev/null || echo "")
    if [ -n "$response" ]; then
        title=$(echo "$response" | grep -o '<title>[^<]*' | head -1 | sed 's/<title>//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        authors=$(echo "$response" | grep -o '<author>[^<]*<name>[^<]*' | sed 's/<author>//;s/<name>//' | paste -sd '; ')
        year=$(echo "$response" | grep -o '<published>[^<]*' | head -1 | cut -d'-' -f1 | sed 's/<published>//')
        abstract=$(echo "$response" | grep -o '<summary>[^<]*' | head -1 | sed 's/<summary>//' | tr '\n' ' ' | sed 's/  */ /g')
        log "   ${GREEN}✓ Título:${NC} $title"
        log "   ${GREEN}✓ Autores:${NC} $authors"
        log "   ${GREEN}✓ Ano:${NC} $year"
        return 0
    else
        log "${RED}   arXiv não retornou dados válidos${NC}"
        return 1
    fi
}

# Gera contrato factual usando Ollama
generate_contract_with_ollama() {
    local title="$1"
    local authors="$2"
    local year="$3"
    local abstract="$4"
    local url="$5"
    local citekey="$6"

    log "${YELLOW}🧠 Gerando contrato factual com Ollama (modelo: $MODEL)...${NC}"

    # Verifica se Ollama está rodando
    if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        log "${RED}   Ollama não está rodando. Use template manual.${NC}"
        return 1
    fi

    # Prepara prompt
    local prompt="Extraia do seguinte paper acadêmico os elementos para um contrato factual.

Título: $title
Autores: $authors
Ano: $year
Abstract: $abstract

Gere um YAML com a seguinte estrutura (preencha com base no conteúdo):

source:
  title: \"$title\"
  authors: \"$authors\"
  year: $year
  url: \"$url\"

facts:
  - id: \"F001\"
    statement: \"[fato principal 1]\"
    type: \"fact\"
    relevance: \"[relevância para segurança/portabilidade]\"
  - id: \"F002\"
    statement: \"[fato principal 2]\"
    type: \"fact\"
    relevance: \"...\"

patterns:
  - id: \"P001\"
    description: \"[padrão observado no paper]\"
    evidence: [\"F001\"]
  - id: \"P002\"
    description: \"[outro padrão]\"
    evidence: [\"F002\"]

rules:
  - id: \"R001\"
    principle: \"[regra derivada para implementação]\"
    derived_from: [\"P001\"]
    action: \"[ação concreta: ex: implementar detector X]\"

cases:
  - id: \"C001\"
    description: \"[exemplo concreto de aplicação ou ataque]\"
    attack_vector: \"[vetor de ataque]\"
    mitigation: \"[mitigação proposta]\"

Responda APENAS com o YAML, sem explicações adicionais."

    # Chama Ollama
    local response=$(curl -s -X POST http://localhost:11434/api/generate \
        -H "Content-Type: application/json" \
        -d '{
            "model": "'"$MODEL"'",
            "prompt": '"$(echo "$prompt" | jq -Rs .)"',
            "stream": false,
            "temperature": 0.3
        }' 2>/dev/null || echo "")

    local yaml=$(echo "$response" | jq -r '.response // ""' 2>/dev/null || echo "")
    if [ -n "$yaml" ]; then
        echo "$yaml"
        return 0
    else
        return 1
    fi
}

# Gera template manual de contrato factual
generate_manual_template() {
    local title="$1"
    local authors="$2"
    local year="$3"
    local url="$4"
    local citekey="$5"

    cat << EOF
# Contrato Factual - $title
# Gerado automaticamente por paper-to-contract.sh
# Preencha os campos abaixo com base na leitura do paper

source:
  title: "$title"
  authors: "$authors"
  year: ${year:-"unknown"}
  url: "$url"
  doi: "${DOI:-}"
  extracted_at: "$(date -Iseconds)"

# Fatos extraídos do paper
# Cada fato deve ser uma afirmação verificável e objetiva
facts:
  - id: "F001"
    statement: "[Descreva o fato principal do paper]"
    type: "fact"  # fact, claim, observation
    relevance: "security"  # security, portability, performance, compatibility
    location: "Section X.X"  # opcional: onde no paper

  - id: "F002"
    statement: "[Segundo fato importante]"
    type: "fact"
    relevance: "portability"

# Padrões observados
# Padrões são regularidades identificadas nos fatos
patterns:
  - id: "P001"
    description: "[Descreva o padrão observado]"
    evidence: ["F001", "F002"]  # fatos que suportam este padrão
    confidence: "high"  # high, medium, low

  - id: "P002"
    description: "[Outro padrão identificado]"
    evidence: ["F001"]
    confidence: "medium"

# Regras derivadas
# Regras são princípios de implementação derivados dos padrões
rules:
  - id: "R001"
    principle: "[Princípio geral derivado do padrão]"
    derived_from: ["P001"]
    action: "implement_detector"  # ação concreta: implement_detector, add_test, create_polyfill
    detector_name: "[Nome do detector se aplicável]"
    priority: "high"  # high, medium, low

  - id: "R002"
    principle: "[Outro princípio]"
    derived_from: ["P002"]
    action: "create_polyfill"
    priority: "medium"

# Casos de aplicação/ataque
# Casos concretos que ilustram os conceitos
cases:
  - id: "C001"
    description: "[Descrição do caso concreto]"
    attack_vector: "prompt_injection"  # prompt_injection, dos, data_exfiltration
    mitigation: "[Mitigação proposta]"
    related_facts: ["F001"]
    related_rules: ["R001"]

# Metadados do contrato
metadata:
  version: "1.0"
  status: "draft"  # draft, reviewed, approved
  tags: ["security", "mcp", "ai-safety"]
  related_papers: []  # citekeys de papers relacionados
EOF
}

# --- Fluxo principal ---
log "${CYAN}📥 Extraindo metadados...${NC}"

DOI=$(extract_doi "$INPUT")
if [ -n "$DOI" ]; then
    log "${GREEN}✓ DOI detectado: $DOI${NC}"
    if [[ "$DOI" =~ ^arXiv: ]]; then
        arxiv_id=${DOI#arXiv:}
        fetch_metadata_arxiv "$arxiv_id" || {
            title="Unknown Title"
            authors="Unknown Authors"
            year=""
            abstract=""
        }
        URL="https://arxiv.org/abs/$arxiv_id"
    else
        if ! fetch_metadata_crossref "$DOI"; then
            title="Unknown Title"
            authors="Unknown Authors"
            year=""
            abstract=""
        fi
        URL="https://doi.org/$DOI"
    fi
else
    log "${YELLOW}⚠️  Não foi possível extrair DOI. Tentando como URL genérica...${NC}"
    # Tenta extrair título da página
    page=$(curl -sL "$INPUT" 2>/dev/null || echo "")
    if [ -n "$page" ]; then
        title=$(echo "$page" | grep -o '<title>[^<]*' | head -1 | sed 's/<title>//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    else
        title="Unknown Title"
    fi
    authors="Unknown Authors"
    year=""
    abstract=""
    URL="$INPUT"
    DOI=""
fi

# Gera citekey (identificador único)
if [ -z "$title" ] || [ "$title" = "Unknown Title" ]; then
    citekey="unknown-$(date +%s)"
else
    citekey=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-80)
    # Remove hífens duplicados e no final
    citekey=$(echo "$citekey" | sed 's/-*$//')
fi

CONTRACT_FILE="$OUTPUT_DIR/$citekey.yaml"

log ""
log "${CYAN}📝 Gerando contrato factual...${NC}"
log "   Citekey: $citekey"
log "   Arquivo: $CONTRACT_FILE"

# Tenta gerar contrato com Ollama
if generate_contract_with_ollama "$title" "$authors" "$year" "$abstract" "$URL" "$citekey" > "$CONTRACT_FILE" 2>/dev/null; then
    log "${GREEN}✅ Contrato factual gerado com IA: $CONTRACT_FILE${NC}"
else
    log "${YELLOW}⚠️  Usando template manual (IA indisponível)${NC}"
    generate_manual_template "$title" "$authors" "$year" "$URL" "$citekey" > "$CONTRACT_FILE"
    log "   Template criado em $CONTRACT_FILE. Preencha manualmente."
fi

# Registra no Dory (se disponível)
if command -v dory &> /dev/null; then
    log "${BLUE}📝 Registrando no Dory...${NC}"
    dory create "Added paper: $title" --kind reference --tag paper --ref "$citekey" >> "$LOG_FILE" 2>&1 || true
    log "   ${GREEN}✓ Registrado no Dory${NC}"
else
    log "${YELLOW}⚠️  Dory não instalado. Pulando registro.${NC}"
fi

# Limpeza
rm -rf "$TEMP_DIR"

log ""
log "${GREEN}✅ Concluído!${NC}"
log "   Contrato: ${CYAN}$CONTRACT_FILE${NC}"
log "   Log: ${CYAN}$LOG_FILE${NC}"
log ""
log "${YELLOW}Próximos passos:${NC}"
log "   1. Revise o contrato em $CONTRACT_FILE"
log "   2. Preencha campos faltantes (se gerado manualmente)"
log "   3. Execute: escapekit analyze para identificar padrões no código"
log "   4. Registre no Obsidian: obsidian://open?vault=SeuVault&file=$citekey"
