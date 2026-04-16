#!/usr/bin/env bash

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
APPLY_CHANGES=0
PRUNE_TEMP=0

MOVE_RULES=(
  "cleanup.sh:scripts/cleanup.sh"
  "test-invariants.js:scripts/test-invariants.js"
  "ANALISE_ESTRUTURA_PROJETO.md:docs/analise-estrutura-projeto.md"
)

LEGACY_FRONTEND_FILES=(
  "utils.ts"
  "types.ts"
  "env.d.ts"
)

TEMP_FILE_NAMES=(
  "test-output.log"
  "test-output.txt"
  "ts-errors.log"
  "cli-output.log"
)

TEMP_FILE_GLOBS=(
  "logs-*.zip"
)

print_usage() {
  cat <<EOF
Uso:
  $(basename "$0") [--apply] [--prune-temp] [--project-root CAMINHO]

Fluxo:
  - Sem flags: apenas inspeciona a raiz e mostra o que faria.
  - --apply: cria diretórios e move arquivos conhecidos.
  - --prune-temp: também remove artefatos temporários conhecidos.

Exemplos:
  $(basename "$0")
  $(basename "$0") --apply
  $(basename "$0") --apply --prune-temp
EOF
}

while (($# > 0)); do
  case "$1" in
    --apply)
      APPLY_CHANGES=1
      ;;
    --prune-temp)
      PRUNE_TEMP=1
      ;;
    --project-root)
      shift
      if (($# == 0)); then
        echo "Erro: --project-root exige um caminho." >&2
        exit 1
      fi
      PROJECT_ROOT="$1"
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      echo "Erro: opção desconhecida: $1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "Erro: diretório do projeto não encontrado: $PROJECT_ROOT" >&2
  exit 1
fi

PROJECT_ROOT="$(cd -- "$PROJECT_ROOT" && pwd)"

info() {
  printf '%s\n' "$*"
}

act() {
  if ((APPLY_CHANGES)); then
    "$@"
  else
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
  fi
}

list_root_files() {
  find "$PROJECT_ROOT" -maxdepth 1 -type f ! -name '.*' -printf '%f\n' | sort
}

is_known_candidate() {
  local name="$1"
  local rule
  local legacy
  local temp
  local glob

  for rule in "${MOVE_RULES[@]}"; do
    if [[ "$name" == "${rule%%:*}" ]]; then
      return 0
    fi
  done

  for legacy in "${LEGACY_FRONTEND_FILES[@]}"; do
    if [[ "$name" == "$legacy" ]]; then
      return 0
    fi
  done

  for temp in "${TEMP_FILE_NAMES[@]}"; do
    if [[ "$name" == "$temp" ]]; then
      return 0
    fi
  done

  for glob in "${TEMP_FILE_GLOBS[@]}"; do
    if [[ "$name" == $glob ]]; then
      return 0
    fi
  done

  return 1
}

list_candidates() {
  local had_candidate=0
  local file_name

  while IFS= read -r file_name; do
    if is_known_candidate "$file_name"; then
      printf ' - %s\n' "$file_name"
      had_candidate=1
    fi
  done < <(list_root_files)

  if ((had_candidate == 0)); then
    info " - nenhum dos candidatos conhecidos foi encontrado na raiz"
  fi
}

move_if_present() {
  local source_name="$1"
  local relative_target="$2"
  local source_path="$PROJECT_ROOT/$source_name"
  local target_path="$PROJECT_ROOT/$relative_target"
  local target_dir

  if [[ ! -e "$source_path" ]]; then
    info " - ausente, ignorando: $source_name"
    return 0
  fi

  target_dir="$(dirname "$target_path")"
  act mkdir -p "$target_dir"

  if [[ -e "$target_path" ]]; then
    info " - destino já existe, não movido: ${relative_target}"
    return 0
  fi

  act mv "$source_path" "$target_path"
}

move_to_legacy_frontend() {
  local source_name="$1"
  local source_path="$PROJECT_ROOT/$source_name"
  local target_dir="$PROJECT_ROOT/legacy_frontend_code"
  local target_path="$target_dir/$source_name"

  if [[ ! -e "$source_path" ]]; then
    info " - ausente, ignorando: $source_name"
    return 0
  fi

  act mkdir -p "$target_dir"

  if [[ -e "$target_path" ]]; then
    info " - destino já existe, não movido: legacy_frontend_code/$source_name"
    return 0
  fi

  act mv "$source_path" "$target_path"
}

prune_temp_files() {
  local temp_name
  local glob
  local matched
  local file_path

  if ((PRUNE_TEMP == 0)); then
    info "Etapa 4 — remoção de temporários: desabilitada (use --prune-temp)"
    return 0
  fi

  info "Etapa 4 — remoção de temporários conhecidos"

  for temp_name in "${TEMP_FILE_NAMES[@]}"; do
    file_path="$PROJECT_ROOT/$temp_name"
    if [[ -e "$file_path" ]]; then
      act rm -f "$file_path"
    else
      info " - ausente, ignorando: $temp_name"
    fi
  done

  for glob in "${TEMP_FILE_GLOBS[@]}"; do
    matched=0
    while IFS= read -r file_path; do
      matched=1
      act rm -f "$file_path"
    done < <(find "$PROJECT_ROOT" -maxdepth 1 -type f -name "$glob" -print | sort)

    if ((matched == 0)); then
      info " - nenhum arquivo encontrado para o padrão: $glob"
    fi
  done
}

info "Projeto: $PROJECT_ROOT"
if ((APPLY_CHANGES)); then
  info "Modo: APPLY"
else
  info "Modo: DRY-RUN"
fi

info
info "Etapa 1 — arquivos visíveis na raiz"
list_root_files

info
info "Suspeitos/candidatos conhecidos"
list_candidates

info
info "Etapa 2 — mover scripts e documentação"
for rule in "${MOVE_RULES[@]}"; do
  move_if_present "${rule%%:*}" "${rule#*:}"
done

info
info "Etapa 3 — isolar resíduos de frontend legado"
for legacy_file in "${LEGACY_FRONTEND_FILES[@]}"; do
  move_to_legacy_frontend "$legacy_file"
done

info
prune_temp_files

info
if ((APPLY_CHANGES)); then
  info "Concluído."
else
  info "Simulação concluída. Use --apply para executar as mudanças."
fi
