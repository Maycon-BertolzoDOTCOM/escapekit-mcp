#!/bin/bash

# CLI Workflow Example for Diff-Based Editing
# This script demonstrates the complete workflow using qwen-escapekit CLI
# for diff operations: generate, validate, and apply

set -e  # Exit on any error

echo "=== qwen-escapekit CLI Workflow Example ==="
echo ""

# Create temporary directory for this example
WORK_DIR=$(mktemp -d)
echo "📁 Working directory: $WORK_DIR"
echo ""

# Step 1: Create original file
echo "--- Step 1: Creating original file ---"
cat > "$WORK_DIR/calculator.ts" << 'EOF'
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}

const calc = new Calculator();
console.log(calc.add(5, 3));
console.log(calc.subtract(10, 4));
EOF

echo "✓ Created calculator.ts"
echo "Original content:"
cat "$WORK_DIR/calculator.ts"
echo ""
echo "---"

# Step 2: Create modified version
echo ""
echo "--- Step 2: Creating modified version ---"
cat > "$WORK_DIR/calculator-modified.ts" << 'EOF'
class Calculator {
  // Add two numbers
  add(a: number, b: number): number {
    return a + b;
  }

  // Subtract two numbers
  subtract(a: number, b: number): number {
    return a - b;
  }

  // Multiply two numbers (NEW!)
  multiply(a: number, b: number): number {
    return a * b;
  }
}

const calc = new Calculator();
console.log('Sum:', calc.add(5, 3));
console.log('Difference:', calc.subtract(10, 4));
console.log('Product:', calc.multiply(6, 7));
EOF

echo "✓ Created calculator-modified.ts"
echo "Modified content:"
cat "$WORK_DIR/calculator-modified.ts"
echo ""
echo "---"

# Step 3: Generate diff
echo ""
echo "--- Step 3: Generating diff ---"
qwen-escapekit diff generate \
  "$WORK_DIR/calculator.ts" \
  "$WORK_DIR/calculator-modified.ts" \
  -o "$WORK_DIR/changes.patch"

echo ""
echo "✓ Generated diff: changes.patch"
echo ""
echo "Diff content:"
cat "$WORK_DIR/changes.patch"
echo ""
echo "---"

# Step 4: Validate diff
echo ""
echo "--- Step 4: Validating diff ---"
qwen-escapekit diff validate "$WORK_DIR/changes.patch"
echo ""

# Step 5: Create a test file to apply the diff
echo ""
echo "--- Step 5: Creating test file for application ---"
cp "$WORK_DIR/calculator.ts" "$WORK_DIR/test-calculator.ts"
echo "✓ Created test-calculator.ts"
echo ""

# Step 6: Apply diff without fuzzy matching (exact match)
echo ""
echo "--- Step 6: Applying diff (exact match, threshold=1.0) ---"
qwen-escapekit diff apply \
  "$WORK_DIR/test-calculator.ts" \
  "$WORK_DIR/changes.patch" \
  --fuzzy 1.0 \
  --backup

echo ""
echo "--- After application ---"
echo "Modified test-calculator.ts:"
cat "$WORK_DIR/test-calculator.ts"
echo ""
echo "---"

# Verify backup was created
if [ -f "$WORK_DIR/test-calculator.ts.backup" ]; then
  echo ""
  echo "✓ Backup created: test-calculator.ts.backup"
  echo ""
  echo "Backup content:"
  cat "$WORK_DIR/test-calculator.ts.backup"
  echo ""
fi

# Step 7: Test with fuzzy matching on a slightly different file
echo ""
echo "--- Step 7: Testing fuzzy matching ---"
cat > "$WORK_DIR/fuzzy-test.ts" << 'EOF'
class Calculator {
  // This has different spacing
  add(a:number, b:number):number{
    return a + b;
  }

  // Different comments
  subtract(a:number,b:number):number{
    return a - b;
  }
}

const calc = new Calculator();
console.log(calc.add(5, 3));
console.log(calc.subtract(10, 4));
EOF

echo "✓ Created fuzzy-test.ts with different spacing"
echo ""
echo "Original fuzzy-test.ts:"
cat "$WORK_DIR/fuzzy-test.ts"
echo ""
echo "---"

echo ""
echo "Trying exact match (threshold=1.0) - Should fail:"
qwen-escapekit diff apply \
  "$WORK_DIR/fuzzy-test.ts" \
  "$WORK_DIR/changes.patch" \
  --fuzzy 1.0 \
  --backup || echo "⚠️  Failed as expected (exact match)"
echo ""

echo "Trying fuzzy match (threshold=0.7) - Should succeed:"
qwen-escapekit diff apply \
  "$WORK_DIR/fuzzy-test.ts" \
  "$WORK_DIR/changes.patch" \
  --fuzzy 0.7 \
  --backup

echo ""
echo "--- After fuzzy application ---"
echo "Modified fuzzy-test.ts:"
cat "$WORK_DIR/fuzzy-test.ts"
echo ""
echo "---"

# Summary
echo ""
echo "=== Summary ==="
echo "✓ Generated diff: changes.patch"
echo "✓ Validated diff format"
echo "✓ Applied diff with exact match (threshold=1.0)"
echo "✓ Applied diff with fuzzy matching (threshold=0.7)"
echo "✓ Backup files created for safety"
echo ""

# Cleanup
echo "Cleaning up temporary files..."
rm -rf "$WORK_DIR"
echo "✓ Cleanup completed"
echo ""
echo "=== CLI Workflow Example Complete ==="
echo ""
echo "Key Takeaways:"
echo "1. Use 'diff generate' to create patches between files"
echo "2. Use 'diff validate' to ensure patch format is correct"
echo "3. Use 'diff apply' with --fuzzy threshold for flexible application"
echo "4. Use --backup to preserve original files"
echo "5. Adjust fuzzy threshold (0.0-1.0) based on code similarity"
echo ""
echo "For more information, see docs/roo-code-integration.md"