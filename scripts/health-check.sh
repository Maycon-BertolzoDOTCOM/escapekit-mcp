#!/usr/bin/env bash
# =============================================================================
# EscapeKit MCP — Project Health Check Script
# Run: bash scripts/health-check.sh
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       🏥 EscapeKit MCP — Health Check Report           ║"
echo "║       $(date '+%Y-%m-%d %H:%M:%S')                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── 1. Project Stats ────────────────────────────────────────────────────────
echo "📁 Project Stats"
echo "────────────────────────────────────────"

TS_FILES=$(find src -name '*.ts' -not -path '*/node_modules/*' | wc -l)
TEST_FILES=$(find tests -name '*.test.ts' -not -path '*/node_modules/*' 2>/dev/null | wc -l)
TOTAL_LINES=$(find src -name '*.ts' -not -path '*/node_modules/*' -exec cat {} + | wc -l)

echo "  TypeScript source files:  $TS_FILES"
echo "  Test files:               $TEST_FILES"
echo "  Total source lines:       $TOTAL_LINES"
echo ""

# ─── 2. Code Quality Indicators ──────────────────────────────────────────────
echo "🔍 Code Quality Indicators"
echo "────────────────────────────────────────"

TODOS=$(grep -rc "TODO" src/ --include="*.ts" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}' || true)
FIXMES=$(grep -rc "FIXME" src/ --include="*.ts" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}' || true)
HACKS=$(grep -rc "HACK\|WORKAROUND\|XXX" src/ --include="*.ts" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}' || true)
ANY_COUNT=$(grep -rc ": any" src/ --include="*.ts" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}' || true)

echo "  TODOs in source:          $TODOS"
echo "  FIXMEs in source:         $FIXMES"
echo "  HACKs/WORKAROUNDs:        $HACKS"
echo "  'any' type usage:         $ANY_COUNT"
echo ""

# ─── 3. Knowledge Base Coverage ──────────────────────────────────────────────
echo "📚 Knowledge Base"
echo "────────────────────────────────────────"

if [ -f knowledge-base.json ]; then
  KB_ENTRIES=$(grep -c '"realPackage"' knowledge-base.json 2>/dev/null || echo "0")
  echo "  Ghost → Real mappings:    $KB_ENTRIES"
else
  echo "  ⚠️  knowledge-base.json not found"
fi
echo ""

# ─── 4. Security Detectors ──────────────────────────────────────────────────
echo "🛡️  Security Detectors"
echo "────────────────────────────────────────"

SECURITY_FILES=$(find src/security -name '*.ts' -not -name 'types.ts' -not -name 'index.ts' 2>/dev/null | wc -l || echo "0")
SECURITY_TESTS=$(find tests/security -name '*.test.ts' 2>/dev/null | wc -l || echo "0")

echo "  Detectors implemented:    $SECURITY_FILES"
echo "  Detector test files:      $SECURITY_TESTS"
echo ""

# ─── 5. Dependencies ────────────────────────────────────────────────────────
echo "📦 Dependencies"
echo "────────────────────────────────────────"

DEPS=$(node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies||{}).length)" 2>/dev/null || echo "?")
DEV_DEPS=$(node -e "const p=require('./package.json'); console.log(Object.keys(p.devDependencies||{}).length)" 2>/dev/null || echo "?")

echo "  Production deps:          $DEPS"
echo "  Dev deps:                 $DEV_DEPS"
echo ""

# ─── 6. Tests ────────────────────────────────────────────────────────────────
echo "🧪 Running Tests..."
echo "────────────────────────────────────────"

if npx vitest run --reporter=verbose 2>&1 | tail -5; then
  echo "  ✅ Tests passed"
else
  echo "  ⚠️  Some tests failed (check output above)"
fi
echo ""

# ─── 7. TypeScript Check ────────────────────────────────────────────────────
echo "🔧 TypeScript Check"
echo "────────────────────────────────────────"

if npx tsc --noEmit 2>&1 | tail -3; then
  echo "  ✅ No type errors"
else
  TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l || echo "?")
  echo "  ⚠️  TypeScript errors: $TS_ERRORS"
fi
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    📊 Summary                          ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Source files: $TS_FILES  |  Tests: $TEST_FILES  |  Lines: $TOTAL_LINES"
echo "║  TODOs: $TODOS  |  FIXMEs: $FIXMES  |  any: $ANY_COUNT"
echo "║  KB Mappings: ${KB_ENTRIES:-0}  |  Security Detectors: $SECURITY_FILES"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Update PROJECT_HEALTH.md with these metrics!"
