# Roo Code Integration - Examples

Welcome to the examples directory for the Roo Code Integration (Diff-Based Editing) feature in EscapeKit. These examples demonstrate practical usage of the `DiffApplyTransformer` API and CLI commands.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Examples](#examples)
- [Running the Examples](#running-the-examples)
- [CLI Workflow](#cli-workflow)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)

---

## Overview

The Roo Code Integration feature enables Git-style code editing with fuzzy matching using Levenshtein distance. It's designed for:

- **Automated Refactoring**: Apply code changes as diffs
- **Code Migration**: Transform codebases incrementally
- **Hot Fixes**: Apply patches without full rebuilds
- **AI Integration**: Apply AI-generated changes to existing code

**Key Features**:
- ✅ Git-compatible unified diff format
- ✅ Fuzzy matching (0.0-1.0 threshold)
- ✅ Multi-hunk support
- ✅ Backup & recovery
- ✅ UTF-8 character handling
- ✅ 94.46% test coverage

---

## Prerequisites

### Install EscapeKit

```bash
# Clone repository
git clone https://github.com/escapekit/escapekit-mcp.git
cd escapekit-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### CLI Installation

```bash
cd qwen-escapekit
npm install
npm link
```

### TypeScript Examples

The TypeScript examples require Node.js 18+ and TypeScript:

```bash
# Install ts-node for running examples
npm install -g ts-node

# Or use tsx for faster execution
npm install -g tsx
```

---

## Examples

### 1. Basic Diff Apply (`basic-diff-apply.ts`)

**Purpose**: Demonstrates the basic workflow of applying a unified diff to a TypeScript file.

**What You'll Learn**:
- How to initialize `DiffApplyTransformer`
- How to validate diff format
- How to apply a diff with backup
- How to interpret results

**Run**:
```bash
# Using ts-node
ts-node examples/roo-code-integration/basic-diff-apply.ts

# Or using tsx
tsx examples/roo-code-integration/basic-diff-apply.ts
```

**Expected Output**:
```
=== Basic Diff Apply Example ===

✓ Created sample.ts

Original code:
---
function hello(name: string) {
  console.log('Hello ' + name);
}

hello('World');
---

Diff to apply:
---
--- a/sample.ts
+++ b/sample.ts
@@ -1,4 +1,4 @@
 function hello(name: string) {
-  console.log('Hello ' + name);
+  console.log('Hello, ' + name + '!');
 }
 
 hello('World');
---

✓ DiffApplyTransformer initialized

Diff valid: Yes ✓

Applying diff...

--- Results ---
Success: Yes ✓
Hunks Applied: 1
Hunks Failed: 0
Lines Changed: 2
Backup: sample.ts.backup

--- Modified code ---
function hello(name: string) {
  console.log('Hello, ' + name + '!');
}

hello('World');
---
```

---

### 2. Fuzzy Matching Demo (`fuzzy-matching-demo.ts`)

**Purpose**: Demonstrates how fuzzy matching allows diffs to apply even when code has slight variations (whitespace, comments, formatting).

**What You'll Learn**:
- How fuzzy matching works
- How to choose appropriate thresholds
- How different code variations affect application
- When to use exact vs. fuzzy matching

**Run**:
```bash
ts-node examples/roo-code-integration/fuzzy-matching-demo.ts
```

**Scenarios Covered**:
- Code with extra comments
- Code with different whitespace
- Code with minor variations

**Key Takeaway**: Use lower thresholds (0.5-0.7) for legacy code or AI-generated code with variations. Use higher thresholds (0.8-1.0) for exact matches in production.

---

### 3. Multi-Hunk Example (`multi-hunk-example.ts`)

**Purpose**: Demonstrates applying diffs with multiple hunks (multiple change blocks) in a single diff file.

**What You'll Learn**:
- How multi-hunk diffs work
- How to track application of each hunk
- How to handle partial success
- How to analyze failed hunks

**Run**:
```bash
ts-node examples/roo-code-integration/multi-hunk-example.ts
```

**Expected Output**:
```
=== Multi-Hunk Diff Example ===

✓ Created multi-hunk-sample.ts

--- Results ---
Success: Yes ✓
Hunks Applied: 3
Hunks Failed: 0
Lines Changed: 8
Backup: multi-hunk-sample.ts.backup

--- Hunk Analysis ---
Total hunks in diff: 3
Hunks successfully applied: 3
Hunks that failed: 0
✓ All hunks applied successfully!

--- Changes Summary ---
1. Added comments to calculateSum()
2. Added comments to calculateDifference()
3. Renamed calculateProduct() to calculateSquare()
4. Updated function calls with labels
```

---

### 4. CLI Workflow (`cli-workflow.sh`)

**Purpose**: Demonstrates the complete workflow using `qwen-escapekit` CLI commands for diff operations.

**What You'll Learn**:
- How to generate diffs between files
- How to validate diff format
- How to apply diffs with different thresholds
- How to use backup option
- How to handle fuzzy matching in CLI

**Run**:
```bash
# Make script executable
chmod +x examples/roo-code-integration/cli-workflow.sh

# Run the workflow
./examples/roo-code-integration/cli-workflow.sh
```

**Workflow Steps**:
1. Create original file
2. Create modified version
3. Generate diff (`diff generate`)
4. Validate diff (`diff validate`)
5. Apply diff with exact match (`diff apply --fuzzy 1.0`)
6. Apply diff with fuzzy matching (`diff apply --fuzzy 0.7`)

**Output**: Complete terminal session showing each step with colorized output.

---

## Running the Examples

### TypeScript Examples

**Using ts-node**:
```bash
# Install ts-node globally
npm install -g ts-node

# Run an example
ts-node examples/roo-code-integration/basic-diff-apply.ts
```

**Using tsx** (faster):
```bash
# Install tsx globally
npm install -g tsx

# Run an example
tsx examples/roo-code-integration/basic-diff-apply.ts
```

**Building and running**:
```bash
# Build the project
npm run build

# Run with node
node -r @swc/register examples/roo-code-integration/basic-diff-apply.ts
```

### CLI Workflow Script

```bash
# Make executable
chmod +x examples/roo-code-integration/cli-workflow.sh

# Run
./examples/roo-code-integration/cli-workflow.sh
```

---

## CLI Workflow

### Generate a Diff

Create a patch between two files:

```bash
qwen-escapekit diff generate original.ts modified.ts -o changes.patch
```

**Options**:
- `-o, --output <file>`: Output file path [default: diff.patch]

### Validate a Diff

Check if diff format is valid:

```bash
qwen-escapekit diff validate changes.patch
```

### Apply a Diff

Apply a patch to a file:

```bash
# Basic application
qwen-escapekit diff apply source.ts changes.patch

# With fuzzy matching
qwen-escapekit diff apply source.ts changes.patch --fuzzy 0.8

# With backup
qwen-escapekit diff apply source.ts changes.patch --backup

# All options combined
qwen-escapekit diff apply source.ts changes.patch --fuzzy 0.8 --backup
```

**Options**:
- `-f, --fuzzy <number>`: Threshold (0.0-1.0) [default: 0.8]
- `-b, --backup`: Create backup file [default: false]

---

## Best Practices

### 1. Always Validate Diffs

```typescript
const transformer = new DiffApplyTransformer();

if (!transformer.validateDiff(diffContent)) {
  throw new Error('Invalid diff format');
}

await transformer.applyDiff('file.ts', diffContent);
```

### 2. Use Backups for Critical Files

```typescript
await transformer.applyDiff('file.ts', diff, {
  backup: true
});

// Backup saved as file.ts.backup
```

### 3. Handle Partial Success

```typescript
const result = await transformer.applyDiff('file.ts', diff);

if (result.hunksFailed > 0) {
  console.warn(`Partial: ${result.hunksApplied}/${result.hunksApplied + result.hunksFailed}`);
  // Review result.errors
}
```

### 4. Choose Appropriate Thresholds

| Scenario | Threshold | Reason |
|----------|-----------|--------|
| Production code | 1.0 | Exact match only |
| Legacy code | 0.7 | Allow variations |
| AI-generated code | 0.8 | Balanced |
| Trusted diffs | 0.9 | High similarity |

### 5. Test Before Production

```typescript
// Test on copy first
copyFileSync('production.ts', 'test.ts');
const result = await transformer.applyDiff('test.ts', diff);

if (result.success) {
  await transformer.applyDiff('production.ts', diff);
}
```

---

## Troubleshooting

### Issue: "Invalid diff format"

**Solution**: Validate diff before applying
```bash
qwen-escapekit diff validate changes.patch
```

### Issue: "Hunk failed to apply"

**Solution**: Lower fuzzy threshold
```bash
qwen-escapekit diff apply file.ts diff.patch --fuzzy 0.5
```

### Issue: "Partial success"

**Solution**: Check errors and decide if acceptable
```typescript
if (result.errors) {
  console.error('Errors:', result.errors);
}
```

### Issue: Encoding problems

**Solution**: Ensure UTF-8 encoding
```typescript
const content = readFileSync('file.ts', 'utf-8');
writeFileSync('diff.patch', diff, 'utf-8');
```

---

## Additional Resources

- **Full Documentation**: [docs/roo-code-integration.md](../../docs/roo-code-integration.md)
- **API Reference**: See DiffApplyTransformer class in src/transformers/DiffApplyTransformer.ts
- **Changelog**: [CHANGELOG.md](../../CHANGELOG.md)
- **Main README**: [README.md](../../README.md)
- **qwen-escapekit README**: [qwen-escapekit/README.md](../../qwen-escapekit/README.md)

---

## Contributing

Found an issue with an example? Want to add a new example?

1. Check the [CONTRIBUTING.md](../../CONTRIBUTING.md) guide
2. Follow the code style and documentation patterns
3. Add tests for new examples
4. Submit a pull request

---

## License

MIT License - See [LICENSE](../../LICENSE) for details.

---

**Version**: 2.0.0  
**Last Updated**: 2026-03-15  
**Maintainers**: EscapeKit Team