#!/bin/bash
#
# SystemEval Runner for EscapeKit MCP
# Executes Vitest tests and generates SystemEval-compatible JSON output
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
ADAPTER="$SCRIPT_DIR/vitest-adapter.py"
VITEST_JSON_OUTPUT="$SCRIPT_DIR/vitest-results.json"
SYSTESEVAL_OUTPUT="$SCRIPT_DIR/systemeval-results.json"

# Check Python availability
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 is not installed${NC}"
    echo "Please install Python 3.7+ to use SystemEval integration"
    exit 1
fi

# Check Node.js availability
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: node is not installed${NC}"
    echo "Please install Node.js to run Vitest tests"
    exit 1
fi

# Create output directory if not exists
mkdir -p "$PROJECT_ROOT/.comate/systemeval"

echo -e "${GREEN}SystemEval Runner for EscapeKit MCP${NC}"
echo "======================================"
echo ""

# Step 1: Run Vitest with JSON output
echo -e "${YELLOW}Step 1: Running Vitest tests...${NC}"
cd "$PROJECT_ROOT"

if ! npx vitest run --reporter=json --outputFile="$VITEST_JSON_OUTPUT" 2>&1; then
    echo -e "${RED}Warning: Some tests failed${NC}"
    # Continue anyway - we still want to process results
fi

# Step 2: Parse Vitest results with SystemEval adapter
echo -e "${YELLOW}Step 2: Parsing Vitest results...${NC}"

if ! python3 "$ADAPTER" "$VITEST_JSON_OUTPUT" "$SYSTESEVAL_OUTPUT" --print-summary; then
    echo -e "${RED}Error: Failed to parse Vitest results${NC}"
    exit 1
fi

# Step 3: Display results summary
echo -e "${GREEN}SystemEval execution completed successfully!${NC}"
echo ""
echo "Results files:"
echo "  - Vitest JSON: $VITEST_JSON_OUTPUT"
echo "  - SystemEval JSON: $SYSTESEVAL_OUTPUT"
echo ""

# Optional: Display quick summary
if [ -f "$SYSTESEVAL_OUTPUT" ]; then
    echo -e "${YELLOW}Quick Summary:${NC}"
    python3 -c "
import json
with open('$SYSTESEVAL_OUTPUT', 'r') as f:
    data = json.load(f)
    summary = data['summary']
    execution = data['execution']
    
    verdict_color = '✅' if summary['failed'] == 0 else '❌'
    print(f'Verdict: {verdict_color} {data[\"verdict\"]}')
    print(f'Total:   {summary[\"total\"]}')
    print(f'Passed:  {summary[\"passed\"]}')
    print(f'Failed:  {summary[\"failed\"]}')
    print(f'Skipped: {summary[\"skipped\"]}')
    print(f'Duration: {summary[\"duration\"]}ms')
    print(f'Execution ID: {execution[\"uuid\"]}')
    print(f'Timestamp: {execution[\"timestamp\"]}')
"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
echo "You can now consume $SYSTESEVAL_OUTPUT with MCP agents."
echo "Example: cat $SYSTESEVAL_OUTPUT | jq"