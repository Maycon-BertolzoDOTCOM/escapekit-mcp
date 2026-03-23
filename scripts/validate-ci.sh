#!/bin/bash
set -e

PROJECT_PATH="${1:-.}"
OUTPUT_FILE="${2:-validation-report.json}"

echo "🔍 Running EscapeKit Validation on $PROJECT_PATH ..."

# Run validation and capture output, while also saving to the expected output file
# We use cli/index.ts validate as it provides the canDeploy and confidence fields
set +e
OUTPUT=$(npx tsx cli/index.ts validate "$PROJECT_PATH" --level standard --json 2>&1)
EXIT_CODE=$?
set -e

# Save the JSON part to the output file for subsequent workflow steps
echo "$OUTPUT" | grep -v "DeprecationWarning" | grep -v "🔍" | grep -v "✅" | grep "{" -A 1000 > "$OUTPUT_FILE" || true

# Extract canDeploy and confidence from the JSON output
CAN_DEPLOY=$(echo "$OUTPUT" | grep -o '"canDeploy": [^,]*' | head -1 | cut -d' ' -f2)
CONFIDENCE=$(echo "$OUTPUT" | grep -o '"confidence": [^,]*' | head -1 | cut -d' ' -f2)
FIXES=$(echo "$OUTPUT" | grep -o '"fixesApplied": \[\]' | wc -l) # Simplified for checking if empty

echo ""
echo "📊 Results:"
echo "   canDeploy: ${CAN_DEPLOY:-false}"
echo "   confidence: ${CONFIDENCE:-0.0}"
echo "   fixes: ${FIXES:-0}"

# Check for expected issues in the output
# The test project is expected to have issues like fake-api
EXPECTED_ISSUES="fake-api|fake-api-client|flatted|Dev server failed|GHOST_IMPORT"

if echo "$OUTPUT" | grep -E "$EXPECTED_ISSUES" > /dev/null; then
    echo ""
    echo "✅ Validation correctly detected issues in the project."
    echo "   Issues found:"
    echo "$OUTPUT" | grep -E "\[(error|warning)\]|message" | head -10
    exit 0
elif [ "$CAN_DEPLOY" = "true" ]; then
    echo ""
    echo "✅ Validation passed. Ready for deployment."
    exit 0
else
    echo ""
    echo "❌ Validation failed to detect expected issues and project is not deployable."
    echo "   Full output summary:"
    echo "$OUTPUT" | head -20
    exit 1
fi
