#!/bin/bash
# validate-github-action.sh
# Usage in workflow: npx tsx cli/index.ts validate $PROJECT_PATH --json > validation-report.json

set -euo pipefail

PROJECT_PATH="${1:-.}"
OUTPUT_FILE="${2:-validation-report.json}"

echo "🔍 Running EscapeKit Validation on $PROJECT_PATH..."

# Run validation with JSON output (suppresses logs internally)
if ! npx tsx cli/index.ts validate "$PROJECT_PATH" --level standard --json > "$OUTPUT_FILE" 2>/dev/null; then
  echo "⚠️ Validation command returned non-zero, but checking output..."
fi

# Verify JSON output file exists and is valid
if [ ! -s "$OUTPUT_FILE" ]; then
  echo "❌ Error: No valid JSON output generated"
  exit 1
fi

# Check if output is valid JSON
if ! jq -e . "$OUTPUT_FILE" > /dev/null 2>&1; then
  echo "❌ Error: Output file is not valid JSON"
  cat "$OUTPUT_FILE"
  exit 1
fi

# Parse JSON output - use '// null' to handle missing keys gracefully
CAN_DEPLOY=$(jq -r '.canDeploy // "false"' "$OUTPUT_FILE")
CONFIDENCE=$(jq -r '.confidence // "0"' "$OUTPUT_FILE")
FIXES=$(jq -r '.fixesApplied | length // 0' "$OUTPUT_FILE")

# Write to GitHub output if available (for GitHub Actions)
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "canDeploy=$CAN_DEPLOY" >> "$GITHUB_OUTPUT"
  echo "confidence=$CONFIDENCE" >> "$GITHUB_OUTPUT"
fi

echo ""
echo "📊 Results:"
echo "   canDeploy: $CAN_DEPLOY"
echo "   confidence: $CONFIDENCE"
echo "   fixes: $FIXES"

if [ "$CAN_DEPLOY" != "true" ]; then
  echo ""
  echo "❌ Validation failed. Issues:"
  jq -r '.remainingIssues[]? | "   - [\(.severity)] \(.type): \(.message)"' "$OUTPUT_FILE" 2>/dev/null || true
  exit 1
fi

echo ""
echo "✅ Ready for deployment!"
