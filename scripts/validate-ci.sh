#!/bin/bash
# validate-github-action.sh
# Usage in workflow: npx tsx cli/index.ts validate $PROJECT_PATH --json > validation-report.json

set -euo pipefail

PROJECT_PATH="${1:-.}"
OUTPUT_FILE="${2:-validation-report.json}"

echo "🔍 Running EscapeKit Validation on $PROJECT_PATH..."

npx tsx cli/index.ts validate "$PROJECT_PATH" --level standard --json > "$OUTPUT_FILE" 2>/dev/null || true

CAN_DEPLOY=$(jq -r '.canDeploy' "$OUTPUT_FILE")
CONFIDENCE=$(jq -r '.confidence' "$OUTPUT_FILE")
FIXES=$(jq '.fixesApplied | length' "$OUTPUT_FILE")

echo "canDeploy=$CAN_DEPLOY" >> "$GITHUB_OUTPUT" 2>/dev/null || true
echo "confidence=$CONFIDENCE" >> "$GITHUB_OUTPUT" 2>/dev/null || true

echo ""
echo "📊 Results:"
echo "   canDeploy: $CAN_DEPLOY"
echo "   confidence: $CONFIDENCE"
echo "   fixes: $FIXES"

if [ "$CAN_DEPLOY" != "true" ]; then
  echo ""
  echo "❌ Validation failed. Issues:"
  jq -r '.remainingIssues[] | "   - [\(.severity)] \(.type): \(.message)"' "$OUTPUT_FILE"
  exit 1
fi

echo ""
echo "✅ Ready for deployment!"
