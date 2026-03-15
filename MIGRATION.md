# Migration Guide - v2.0.0 Roo Code Integration

> Guide for migrating to EscapeKit v2.0.0 with Diff-Based Editing

**Version**: 2.0.0  
**Release Date**: 2026-03-15  
**Breaking Changes**: None (backward compatible)  
**Migration Effort**: Low

---

## 📋 Table of Contents

- [Overview](#overview)
- [What's New in v2.0.0](#whats-new-in-v200)
- [Migration from v1.0.0](#migration-from-v100)
- [Migration from Other Diff Libraries](#migration-from-other-diff-libraries)
- [Migration Checklist](#migration-checklist)
- [Troubleshooting](#troubleshooting)
- [Rollback Plan](#rollback-plan)

---

## Overview

EscapeKit v2.0.0 introduces **Diff-Based Editing** with fuzzy matching using Levenshtein distance. This is a major new feature that does not introduce breaking changes to existing functionality.

**Key Highlights**:
- ✅ **No Breaking Changes**: All existing v1.x code continues to work
- ✅ **New Feature**: `DiffApplyTransformer` for Git-style diff application
- ✅ **CLI Commands**: `diff apply`, `diff generate`, `diff validate`
- ✅ **Fuzzy Matching**: Configurable similarity threshold (0.0-1.0)
- ✅ **Test Coverage**: 94.46% (33 tests)
- ✅ **Performance**: <50ms for typical files

---

## What's New in v2.0.0

### New Core Feature: DiffApplyTransformer

A new transformer for applying unified diffs with fuzzy matching:

```typescript
import { DiffApplyTransformer } from './transformers/DiffApplyTransformer.js';

const transformer = new DiffApplyTransformer();

// Apply diff
const result = await transformer.applyDiff('file.ts', diffContent);

// Fuzzy matching
await transformer.applyFuzzyDiff('file.ts', diffContent, 0.8);

// Generate diff
const diff = transformer.generateDiff(original, modified);

// Validate diff
const isValid = transformer.validateDiff(diff);
```

### New CLI Commands

```bash
# Generate diff
qwen-escapekit diff generate original.ts modified.ts -o changes.patch

# Validate diff
qwen-escapekit diff validate changes.patch

# Apply diff
qwen-escapekit diff apply source.ts changes.patch --fuzzy 0.8 --backup
```

### Enhanced TransformationPipeline

The `TransformationPipeline` now supports diff-based transformations:

```typescript
const pipeline = new TransformationPipeline();

await pipeline.transform({
  code: originalCode,
  transformations: [
    { type: 'import-replace' },
    { type: 'ast-transform' },
    { type: 'diff-apply', diff: diffContent }  // NEW!
  ]
});
```

---

## Migration from v1.0.0

### Quick Start

**Good News**: No code changes required! v2.0.0 is fully backward compatible.

```bash
# Upgrade to v2.0.0
npm install escapekit-mcp@2.0.0

# Or for qwen-escapekit
cd qwen-escapekit
npm install
```

### Optional: Adopt New Features

If you want to use the new diff-based editing:

#### 1. Add DiffApplyTransformer to Your Code

```typescript
// Before (v1.0.0)
import { ASTTransformer } from './transformers/ASTTransformer.js';

// After (v2.0.0) - add new import
import { ASTTransformer, DiffApplyTransformer } from './transformers/index.js';

const diffTransformer = new DiffApplyTransformer();
```

#### 2. Use CLI Diff Commands

```bash
# Before (v1.0.0)
qwen-escapekit analyze
qwen-escapekit generate
qwen-escapekit validate

# After (v2.0.0) - add diff commands
qwen-escapekit diff apply <file> <diff>
qwen-escapekit diff generate <original> <modified>
qwen-escapekit diff validate <diff>
```

#### 3. Update TransformationPipeline (Optional)

```typescript
// Before (v1.0.0)
const pipeline = new TransformationPipeline();
await pipeline.transform({
  code: code,
  transformations: [
    { type: 'import-replace' },
    { type: 'ast-transform' }
  ]
});

// After (v2.0.0) - add diff step (optional)
await pipeline.transform({
  code: code,
  transformations: [
    { type: 'import-replace' },
    { type: 'ast-transform' },
    { type: 'diff-apply', diff: diffContent }  // Optional new step
  ]
});
```

### Deprecation Notices

**None!** All v1.0.0 APIs remain fully supported.

---

## Migration from Other Diff Libraries

### From jsdiff

**Before** (using jsdiff):
```typescript
import * as diff from 'diff';

// Generate diff
const patch = diff.createPatch('file.ts', original, modified);

// Apply diff (not directly supported in jsdiff)
// Need to use additional libraries like diff-match-patch
```

**After** (using EscapeKit v2.0.0):
```typescript
import { DiffApplyTransformer } from './transformers/DiffApplyTransformer.js';

const transformer = new DiffApplyTransformer();

// Generate diff
const patch = transformer.generateDiff(original, modified);

// Apply diff (built-in support!)
await transformer.applyDiff('file.ts', patch);
```

**Benefits**:
- ✅ Unified API for both generation and application
- ✅ Built-in fuzzy matching
- ✅ Backup and recovery support
- ✅ Better error handling

---

### From diff-match-patch

**Before** (using diff-match-patch):
```typescript
import { diff_match_patch } from 'diff-match-patch';

const dmp = new diff_match_patch();
const patches = dmp.patch_make(original, modified);

// Apply patches
const result = dmp.patch_apply(patches, modified);
```

**After** (using EscapeKit v2.0.0):
```typescript
import { DiffApplyTransformer } from './transformers/DiffApplyTransformer.js';

const transformer = new DiffApplyTransformer();

// Generate diff (Git-compatible format)
const diff = transformer.generateDiff(original, modified);

// Apply diff with fuzzy matching
await transformer.applyDiff('file.ts', diff, {
  fuzzyThreshold: 0.8,
  backup: true
});
```

**Benefits**:
- ✅ Git-compatible unified diff format
- ✅ Configurable fuzzy matching (not just diff-match-patch's heuristic)
- ✅ Better TypeScript support
- ✅ More comprehensive documentation

---

### From Manual String Replacement

**Before** (manual replacement):
```typescript
const code = readFileSync('file.ts', 'utf-8');
const modified = code.replace(/old/g, 'new');
writeFileSync('file.ts', modified);

// Issues:
// - No validation
// - No backup
// - No fuzzy matching
// - No diff review
```

**After** (using EscapeKit v2.0.0):
```typescript
import { DiffApplyTransformer } from './transformers/DiffApplyTransformer.js';

const transformer = new DiffApplyTransformer();

const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,1 +1,1 @@
-old
+new
`;

const result = await transformer.applyDiff('file.ts', diff, {
  fuzzyThreshold: 0.8,
  backup: true
});

// Benefits:
// - Validates format before applying
// - Creates backup automatically
// - Supports fuzzy matching
// - Reviewable diff
// - Detailed results
```

---

## Migration Checklist

Use this checklist to ensure a smooth migration to v2.0.0:

### Pre-Migration

- [ ] **Backup your codebase**
  ```bash
  git commit -am "Backup before v2.0.0 upgrade"
  ```
  
- [ ] **Read the documentation**
  - [ ] [docs/roo-code-integration.md](docs/roo-code-integration.md)
  - [ ] [CHANGELOG.md](CHANGELOG.md)
  - [ ] [README.md](README.md)

- [ ] **Review new features**
  - [ ] DiffApplyTransformer API
  - [ ] CLI diff commands
  - [ ] Fuzzy matching

### Migration Steps

- [ ] **Update dependencies**
  ```bash
  npm install escapekit-mcp@2.0.0
  ```

- [ ] **Run existing tests** (ensure no regressions)
  ```bash
  npm test
  ```
  Expected: All existing tests pass ✅

- [ ] **Run new diff tests** (verify new functionality)
  ```bash
  npm test -- tests/transformers/DiffApplyTransformer.test.ts
  ```
  Expected: 33 tests passing ✅

- [ ] **Try CLI diff commands**
  ```bash
  # Generate a test diff
  qwen-escapekit diff generate test1.ts test2.ts -o test.patch
  
  # Validate it
  qwen-escapekit diff validate test.patch
  
  # Apply it
  qwen-escapekit diff apply target.ts test.patch --backup
  ```

### Post-Migration

- [ ] **Review backup files** (if using `--backup` flag)
- [ ] **Check performance** (should be <50ms for typical files)
- [ ] **Test fuzzy matching** (adjust threshold as needed)
- [ ] **Update team documentation** (add diff workflow to onboarding)

---

## Troubleshooting

### Issue: "Module not found" after upgrade

**Solution**: Rebuild the project
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: "Diff validation failed"

**Solution**: Ensure diff follows unified diff format
```bash
# Validate before applying
qwen-escapekit diff validate changes.patch

# If invalid, regenerate
qwen-escapekit diff generate original.ts modified.ts -o changes.patch
```

### Issue: "Hunk failed to apply"

**Solution**: Lower fuzzy threshold
```bash
# Try with more permissive threshold
qwen-escapekit diff apply file.ts diff.patch --fuzzy 0.5
```

### Issue: "Performance degraded"

**Solution**: Use exact matching for production
```typescript
await transformer.applyDiff('file.ts', diff, {
  fuzzyThreshold: 1.0  // Exact match only
});
```

---

## Rollback Plan

If you encounter issues with v2.0.0, rollback to v1.0.0:

```bash
# Rollback package
npm install escapekit-mcp@1.0.0

# Restore from git if needed
git checkout HEAD~1 -- .

# Reinstall dependencies
npm install
npm run build
```

**Note**: All v1.0.0 code will work immediately after rollback.

---

## Support

If you need help with migration:

1. **Documentation**: [docs/roo-code-integration.md](docs/roo-code-integration.md)
2. **Examples**: [examples/roo-code-integration/](examples/roo-code-integration/)
3. **Issues**: [GitHub Issues](https://github.com/escapekit/escapekit-mcp/issues)
4. **Discord**: [EscapeKit Discord](https://discord.gg/escapekit)

---

## Next Steps

After migrating to v2.0.0:

1. **Explore Examples**: Check out [examples/roo-code-integration/](examples/roo-code-integration/)
2. **Read Full Docs**: See [docs/roo-code-integration.md](docs/roo-code-integration.md)
3. **Customize Thresholds**: Adjust fuzzy matching for your use case
4. **Integrate into Pipeline**: Add diff steps to your transformation workflows
5. **Contribute**: Submit PRs for improvements!

---

**Version**: 2.0.0  
**Last Updated**: 2026-03-15  
**Migration Difficulty**: Low (no breaking changes)  
**Support**: Full backward compatibility with v1.0.0