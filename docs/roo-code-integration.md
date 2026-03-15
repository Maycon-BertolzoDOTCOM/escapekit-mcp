# Roo Code Integration - Diff-Based Editing

> Git-style code editing with fuzzy matching for automated code transformations

**Version**: 2.0.0  
**Test Coverage**: 94.46% (33 tests)  
**Performance**: <50ms for typical files, <200ms for large files

---

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [CLI Usage](#cli-usage)
- [Fuzzy Matching](#fuzzy-matching)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)

---

## Overview

### What is DiffApplyTransformer?

`DiffApplyTransformer` is a core component of EscapeKit that enables Git-style unified diff application with fuzzy matching. It's designed to:

- **Apply patches** to source code files with precision
- **Generate diffs** between code versions
- **Validate diff formats** for compatibility
- **Handle fuzzy matches** when code has slight variations
- **Support multi-hunk diffs** with complex changes

### Key Features

✅ **Git-Compatible**: Standard unified diff format  
✅ **Fuzzy Matching**: Levenshtein distance for similarity detection  
✅ **Backup & Recovery**: Automatic backup with rollback support  
✅ **Multi-Hunk Support**: Handle complex diffs with multiple change sets  
✅ **UTF-8 Support**: Full Unicode character handling  
✅ **High Performance**: <50ms for typical files  
✅ **Well-Tested**: 94.46% test coverage with 33 tests  

### Use Cases

- **Code Refactoring**: Apply automated refactorings as diffs
- **Hot Fixes**: Apply patches without full rebuilds
- **Code Generation**: Apply AI-generated changes to existing code
- **Migration Scripts**: Transform codebases with incremental diffs
- **Version Control Integration**: Custom diff application workflows

---

## Quick Start

### Installation

```bash
# Install EscapeKit MCP
npm install -g escapekit-mcp

# Or install qwen-escapekit CLI
cd qwen-escapekit && npm install && npm link
```

### Basic Usage

#### 1. Apply a Diff

```typescript
import { DiffApplyTransformer } from './transformers/DiffApplyTransformer.js';

const transformer = new DiffApplyTransformer();

const diff = `--- a/source.ts
+++ b/source.ts
@@ -1,3 +1,3 @@
 function hello() {
-  console.log('Hello');
+  console.log('Hello, World!');
 }
`;

const result = await transformer.applyDiff('source.ts', diff);

console.log(`Success: ${result.success}`);
console.log(`Hunks Applied: ${result.hunksApplied}`);
console.log(`Lines Changed: ${result.linesChanged}`);
// Output:
// Success: true
// Hunks Applied: 1
// Lines Changed: 2
```

#### 2. Apply with Fuzzy Matching

```typescript
// Apply diff even if code has slight variations
const result = await transformer.applyFuzzyDiff('source.ts', diff, 0.8);
// Threshold 0.8 = 80% similarity required
```

#### 3. Generate a Diff

```typescript
const original = readFileSync('file1.ts', 'utf-8');
const modified = readFileSync('file2.ts', 'utf-8');

const diff = transformer.generateDiff(original, modified);
writeFileSync('changes.patch', diff);
```

#### 4. Validate a Diff

```typescript
const isValid = transformer.validateDiff(diffContent);
if (!isValid) {
  throw new Error('Invalid diff format');
}
```

---

## Core Concepts

### Unified Diff Format

EscapeKit uses the standard Git unified diff format:

```diff
--- a/filename.ts
+++ b/filename.ts
@@ -line,count +line,count @@
 context line
-old line
+new line
 another context line
```

**Components**:

- **`--- a/file`**: Original file path
- **`+++ b/file`**: New file path
- **`@@ -X,Y +A,B @@`**: Hunk header
  - `X`: Starting line in original
  - `Y`: Number of lines in original
  - `A`: Starting line in new
  - `B`: Number of lines in new
- **Context lines**: Lines starting with space ` `
- **Removed lines**: Lines starting with `-`
- **Added lines**: Lines starting with `+`

### Hunks

A **hunk** is a single change block. Diffs can contain multiple hunks:

```diff
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line 1
-old line 2
+new line 2
 line 3
@@ -5,3 +5,3 @@
 line 5
-old line 6
+new line 6
 line 7
```

### Fuzzy Matching

When code has slight variations (whitespace, comments), fuzzy matching allows diffs to apply:

**Example**:
```typescript
// Original code
function hello(name) {
  console.log("Hello " + name);
}

// Diff expects
function hello(name) {
  console.log("Hello, " + name);  // Added ", "
}
```

Even with different spacing/comments, fuzzy matching can apply the diff correctly.

---

## API Reference

### DiffApplyTransformer

#### Constructor

```typescript
constructor(options?: {
  fuzzyThreshold?: number;  // Default: 0.8
  backup?: boolean;         // Default: false
})
```

#### applyDiff()

Applies a unified diff to a file.

```typescript
async applyDiff(
  filePath: string,
  diffContent: string,
  options?: {
    fuzzyThreshold?: number;  // 0.0-1.0, default: 0.8
    backup?: boolean;         // Create .backup file
  }
): Promise<DiffApplyResult>
```

**Parameters**:
- `filePath`: Path to the file to modify
- `diffContent`: Unified diff content
- `options`: Optional configuration

**Returns**: `DiffApplyResult`
```typescript
interface DiffApplyResult {
  success: boolean;
  hunksApplied: number;
  hunksFailed: number;
  linesChanged: number;
  backupPath?: string;
  errors?: string[];
}
```

**Example**:
```typescript
const result = await transformer.applyDiff('src/file.ts', diff, {
  fuzzyThreshold: 0.8,
  backup: true
});

if (!result.success) {
  console.error('Failed:', result.errors);
}
```

#### applyFuzzyDiff()

Applies a diff with fuzzy matching (alias for `applyDiff` with `fuzzyThreshold`).

```typescript
async applyFuzzyDiff(
  filePath: string,
  diffContent: string,
  threshold?: number  // Default: 0.8
): Promise<DiffApplyResult>
```

#### generateDiff()

Generates a unified diff between two strings.

```typescript
generateDiff(original: string, modified: string): string
```

**Returns**: Unified diff string

**Example**:
```typescript
const original = 'line 1\nline 2\nline 3';
const modified = 'line 1\nNEW line 2\nline 3';
const diff = transformer.generateDiff(original, modified);
// Returns: unified diff format
```

#### validateDiff()

Validates a unified diff format.

```typescript
validateDiff(diff: string): boolean
```

**Returns**: `true` if valid, `false` otherwise

**Validation Rules**:
- Must have `---` header
- Must have `+++` header
- Must have at least one hunk `@@`
- Hunk headers must be valid format
- Lines in hunks must start with ` `, `-`, or `+`

---

## CLI Usage

### Installation

```bash
cd qwen-escapekit
npm install && npm link
```

### Commands

#### `diff apply`

Apply a unified diff to a file.

```bash
qwen-escapekit diff apply <file> <diff> [options]
```

**Options**:
- `-f, --fuzzy <number>`: Fuzzy threshold (0.0-1.0) [default: 0.8]
- `-b, --backup`: Create backup file [default: false]

**Examples**:
```bash
# Basic application
qwen-escapekit diff apply src/file.ts changes.patch

# With fuzzy matching
qwen-escapekit diff apply src/file.ts changes.patch --fuzzy 0.8

# With backup
qwen-escapekit diff apply src/file.ts changes.patch --backup

# All options
qwen-escapekit diff apply src/file.ts changes.patch -f 0.8 -b
```

**Output**:
```
✅ Qwen EscapeKit - Aplicar Diff
==================================================
Arquivo: src/file.ts
Diff: changes.patch
Fuzzy threshold: 0.8
Backup: habilitado

✓ Diff aplicado com sucesso
Hunks aplicados: 2
Linhas alteradas: 4
Backup criado em: src/file.ts.backup
```

#### `diff generate`

Generate a unified diff between two files.

```bash
qwen-escapekit diff generate <original> <modified> [options]
```

**Options**:
- `-o, --output <file>`: Output file path [default: diff.patch]

**Examples**:
```bash
# Basic generation
qwen-escapekit diff generate original.ts modified.ts

# Specify output
qwen-escapekit diff generate original.ts modified.ts -o changes.patch

# View diff
qwen-escapekit diff generate original.ts modified.ts | cat
```

#### `diff validate`

Validate a unified diff file.

```bash
qwen-escapekit diff validate <diff>
```

**Examples**:
```bash
# Validate diff
qwen-escapekit diff validate changes.patch

# Output:
# ✅ Qwen EscapeKit - Validar Diff
# ==================================================
# Diff: changes.patch
# ✓ Diff válido (formato unified diff)
```

---

## Fuzzy Matching

### How It Works

Fuzzy matching uses the **Levenshtein distance** algorithm to calculate string similarity:

```
Levenshtein(a, b) = minimum number of edits to transform a into b
Similarity = 1 - (Levenshtein(a, b) / max(len(a), len(b)))
```

### Threshold Selection

| Threshold | Behavior | Use Case |
|-----------|----------|----------|
| **0.0** | Always apply (permissive) | Trusted diffs, identical codebase |
| **0.5** | Moderate similarity | Code with minor variations |
| **0.8** | High similarity (default) | Most cases, safe default |
| **1.0** | Exact match only (strict) | Critical changes, no variations |

### Example

```typescript
// Original code
function hello(name) {
  // Say hello
  console.log("Hello " + name);
}

// Diff expects
function hello(name) {
  console.log("Hello, World!");  // Different!
}

// With threshold 0.8: FAILS (not similar enough)
await applyFuzzyDiff('file.ts', diff, 0.8);
// Result: success: false

// With threshold 0.3: APPLIES (permissive)
await applyFuzzyDiff('file.ts', diff, 0.3);
// Result: success: true
```

### Tuning Guidelines

- **Start with 0.8**: Safe default for most cases
- **Lower for legacy code**: Older code may have formatting differences
- **Raise for critical code**: Ensure exact matches for security-critical changes
- **Test incrementally**: Try different thresholds and validate results

---

## Advanced Usage

### Multi-Hunk Diffs

```typescript
const multiHunkDiff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line 1
-old line 2
+new line 2
 line 3
@@ -5,3 +5,3 @@
 line 5
-old line 6
+new line 6
 line 7
`;

const result = await transformer.applyDiff('file.ts', multiHunkDiff);
console.log(`Hunks Applied: ${result.hunksApplied}`);
// Output: Hunks Applied: 2
```

### Backup & Recovery

```typescript
// Apply with backup
const result = await transformer.applyDiff('file.ts', diff, {
  backup: true
});

if (!result.success) {
  // Restore from backup
  const backup = result.backupPath;
  copyFileSync(backup, 'file.ts');
  console.log('Restored from backup');
}
```

### Integration with TransformationPipeline

```typescript
import { TransformationPipeline } from './generators/TransformationPipeline.js';

const pipeline = new TransformationPipeline();

// Apply diff after AST transformation
const result = await pipeline.transform({
  code: originalCode,
  transformations: [
    { type: 'import-replace' },
    { type: 'ast-transform' },
    { type: 'diff-apply', diff: diffContent }
  ]
});
```

### Error Handling

```typescript
try {
  const result = await transformer.applyDiff('file.ts', diff);
  
  if (!result.success) {
    console.error('Failed to apply diff');
    
    if (result.errors) {
      result.errors.forEach(err => {
        console.error(`Error: ${err}`);
      });
    }
  }
} catch (error) {
  if (error.message.includes('ENOENT')) {
    console.error('File not found');
  } else if (error.message.includes('Invalid diff')) {
    console.error('Diff format error');
  } else {
    throw error;
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid diff format"

**Problem**: Diff doesn't follow unified diff format.

**Solution**:
```bash
# Validate diff first
qwen-escapekit diff validate changes.patch

# If invalid, regenerate:
qwen-escapekit diff generate original.ts modified.ts
```

#### 2. "Hunk failed to apply"

**Problem**: Diff can't find matching context.

**Solutions**:
```bash
# Lower fuzzy threshold
qwen-escapekit diff apply file.ts diff.patch --fuzzy 0.5

# Or use exact match (if variations are expected)
qwen-escapekit diff apply file.ts diff.patch --fuzzy 0.3
```

#### 3. Partial success

**Problem**: Some hunks applied, some failed.

**Solution**:
```typescript
const result = await transformer.applyDiff('file.ts', diff);

if (result.hunksFailed > 0) {
  console.warn(`${result.hunksFailed} hunks failed`);
  // Check result.errors for details
}
```

#### 4. Encoding issues

**Problem**: Special characters not handled correctly.

**Solution**:
```typescript
// Ensure UTF-8 encoding
const content = readFileSync('file.ts', 'utf-8');
const diff = transformer.generateDiff(original, content);
writeFileSync('changes.patch', diff, 'utf-8');
```

### Debug Mode

Enable detailed logging:

```typescript
const transformer = new DiffApplyTransformer({
  debug: true  // Enable debug output
});

await transformer.applyDiff('file.ts', diff);
// Output: Detailed hunk-by-hunk progress
```

---

## Best Practices

### 1. Always Validate Diffs

```typescript
// Before applying
if (!transformer.validateDiff(diffContent)) {
  throw new Error('Invalid diff format');
}

// Then apply
await transformer.applyDiff('file.ts', diffContent);
```

### 2. Use Backups for Critical Files

```typescript
const result = await transformer.applyDiff('file.ts', diff, {
  backup: true
});

// Save backup path for recovery
if (!result.success && result.backupPath) {
  console.log(`Backup: ${result.backupPath}`);
}
```

### 3. Handle Partial Success

```typescript
const result = await transformer.applyDiff('file.ts', diff);

if (result.hunksFailed > 0) {
  console.warn(`Partial success: ${result.hunksApplied}/${result.hunksApplied + result.hunksFailed} hunks`);
  // Review errors and decide if acceptable
}
```

### 4. Choose Appropriate Thresholds

```typescript
// For trusted diffs (e.g., from CI)
await transformer.applyFuzzyDiff('file.ts', diff, 1.0);  // Exact match

// For legacy code with formatting variations
await transformer.applyFuzzyDiff('file.ts', diff, 0.7);  // More permissive

// For AI-generated code (default)
await transformer.applyFuzzyDiff('file.ts', diff, 0.8);  // Balanced
```

### 5. Test Before Production

```typescript
// Test on copy first
copyFileSync('production.ts', 'test.ts');
const result = await transformer.applyDiff('test.ts', diff);

if (result.success) {
  // Apply to production
  await transformer.applyDiff('production.ts', diff);
} else {
  console.error('Test failed, not applying to production');
}
```

---

## Migration Guide

### From Manual Code Changes

**Before**:
```typescript
const code = readFileSync('file.ts', 'utf-8');
const modified = code.replace(/old/g, 'new');
writeFileSync('file.ts', modified);
```

**After**:
```typescript
const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,1 +1,1 @@
-old
+new
`;
await transformer.applyDiff('file.ts', diff);
```

**Benefits**:
- Safer: Validates format before applying
- Traceable: Diff can be reviewed
- Reversible: Backup support
- Flexible: Fuzzy matching for variations

### From Other Diff Libraries

**jsdiff**:
```typescript
// jsdiff
import * as diff from 'diff';
const patch = diff.createPatch('file.ts', original, modified);

// DiffApplyTransformer
const patch = transformer.generateDiff(original, modified);
```

**diff-match-patch**:
```typescript
// diff-match-patch
import { diff_match_patch } from 'diff-match-patch';
const dmp = new diff_match_patch();
const patches = dmp.patch_make(original, modified);

// DiffApplyTransformer
const patches = transformer.generateDiff(original, modified);
```

### Performance Considerations

| File Size | Performance |
|-----------|-------------|
| < 100 lines | <10ms |
| 100-1000 lines | 10-50ms |
| 1000-5000 lines | 50-200ms |
| > 5000 lines | 200ms+ |

For large files (>5000 lines), consider:
- Splitting diffs into smaller hunks
- Using exact matching (threshold 1.0)
- Processing in batches

---

## Additional Resources

- [EscapeKit Main README](../README.md)
- [qwen-escapekit CLI Documentation](../qwen-escapekit/README.md)
- [Git Diff Format Spec](https://git-scm.com/docs/diff-format)
- [Unified Diff Wikipedia](https://en.wikipedia.org/wiki/Diff_utility#Unified_format)

---

**Version**: 2.0.0  
**Last Updated**: 2026-03-15  
**Maintainers**: EscapeKit Team