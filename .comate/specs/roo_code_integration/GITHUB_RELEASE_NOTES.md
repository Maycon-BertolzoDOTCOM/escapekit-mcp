# 🚀 EscapeKit v2.0.0 - Roo Code Integration

> Git-style code editing with fuzzy matching for automated code transformations

---

## 🎉 What's New

### Diff-Based Editing (Major Feature)

**DiffApplyTransformer**: A powerful new transformer for applying unified diffs with fuzzy matching using Levenshtein distance.

**Key Features**:
- ✅ Git-compatible unified diff format
- ✅ Fuzzy matching with configurable threshold (0.0-1.0)
- ✅ Multi-hunk support for complex changes
- ✅ Backup and recovery functionality
- ✅ UTF-8 character handling
- ✅ 94.46% test coverage (33 tests)
- ✅ High performance (<50ms for typical files)

### CLI Commands

New `diff` subcommands in `qwen-escapekit`:

```bash
# Generate diff between files
qwen-escapekit diff generate original.ts modified.ts -o changes.patch

# Validate diff format
qwen-escapekit diff validate changes.patch

# Apply diff with fuzzy matching
qwen-escapekit diff apply source.ts changes.patch --fuzzy 0.8 --backup
```

### Enhanced Integration

- **TransformationPipeline**: Now supports diff-based transformations
- **EscapeContract**: Diff metadata support
- **Full Integration**: Seamless workflow with ImportReplacer and ASTTransformer

---

## 📦 Installation

```bash
# Install escapekit-mcp
npm install escapekit-mcp@2.0.0

# Install qwen-escapekit CLI
cd qwen-escapekit
npm install
npm link
```

---

## 🔧 Usage

### API Usage

```typescript
import { DiffApplyTransformer } from './transformers/DiffApplyTransformer.js';

const transformer = new DiffApplyTransformer();

// Apply diff
const result = await transformer.applyDiff('file.ts', diffContent, {
  fuzzyThreshold: 0.8,
  backup: true
});

// Generate diff
const diff = transformer.generateDiff(original, modified);

// Validate diff
const isValid = transformer.validateDiff(diff);
```

### CLI Usage

```bash
# Generate a patch
qwen-escapekit diff generate original.ts modified.ts -o changes.patch

# Apply with fuzzy matching
qwen-escapekit diff apply source.ts changes.patch --fuzzy 0.8 --backup

# Validate before applying
qwen-escapekit diff validate changes.patch
```

---

## 📚 Documentation

### Comprehensive Guides

- **[docs/roo-code-integration.md](docs/roo-code-integration.md)**: Complete integration guide with API reference, CLI usage, fuzzy matching, troubleshooting, and best practices (~700 lines)

### Examples

- **[examples/roo-code-integration/](examples/roo-code-integration/)**: 4 working examples demonstrating:
  - Basic diff application
  - Fuzzy matching scenarios
  - Multi-hunk diffs
  - CLI workflow
  - Complete README with troubleshooting

### Migration Guide

- **[MIGRATION.md](MIGRATION.md)**: Complete guide for migrating from v1.0.0 and other diff libraries (jsdiff, diff-match-patch)

### Contributing

- **[CONTRIBUTING.md](CONTRIBUTING.md)**: Updated with documentation guidelines, examples requirements, and diff-based editing standards

---

## 📊 Changes

### Added

**DiffApplyTransformer** (`src/transformers/DiffApplyTransformer.ts`):
- `applyDiff()`: Apply patches with backup and error recovery
- `generateDiff()`: Generate unified diffs between versions
- `validateDiff()`: Validate Git-compatible diff format
- `applyFuzzyDiff()`: Apply diffs with configurable similarity threshold

**CLI Commands** (`qwen-escapekit`):
- `diff apply <file> <diff>`: Apply unified diff
- `diff generate <original> <modified>`: Generate diff
- `diff validate <diff>`: Validate diff format

**Quality**:
- Test coverage: 94.46% (33 tests, all passing)
- Performance: <50ms typical, <200ms large files
- Zero regressions: All 670 existing tests passing

### Changed

- Updated README.md with Diff-Based Editing feature and CLI commands
- Enhanced TransformationPipeline to support diff transformations
- Improved error reporting with detailed messages
- Better test coverage from 55% to 94.46% for diff features

### Fixed

- Fuzzy matching algorithm with proper Levenshtein distance implementation
- Multi-hunk diff application with correct positioning
- Backup creation and recovery logic
- Edge cases: empty file handling, partial success on failed hunks
- Context similarity calculation for fuzzy matching
- Threshold clamping to valid range [0.0, 1.0]

---

## 🎯 Technical Details

### Fuzzy Matching Algorithm

Uses **Levenshtein distance** for string similarity calculation:

```
Levenshtein(a, b) = minimum number of edits to transform a into b
Similarity = 1 - (Levenshtein(a, b) / max(len(a), len(b)))
```

**Threshold Selection**:
| Threshold | Behavior | Use Case |
|-----------|----------|----------|
| **0.0** | Always apply (permissive) | Trusted diffs |
| **0.5** | Moderate similarity | Legacy code with variations |
| **0.8** | High similarity (default) | Most cases |
| **1.0** | Exact match only (strict) | Critical changes |

### Unified Diff Format

```diff
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 function hello() {
-  console.log('Hello');
+  console.log('Hello, World!');
 }
```

---

## 📈 Metrics

### Test Coverage

- **Total Tests**: 703 (670 existing + 33 new)
- **Coverage**: 94.46% for DiffApplyTransformer
- **Passing**: 100%
- **Performance**: All tests <200ms

### Documentation

- **Total Lines**: ~1800+
- **Files**: 10+ created/updated
- **Examples**: 4 working examples
- **Sections**: 40+ content sections

---

## 🔄 Migration

### From v1.0.0

**No breaking changes!** All v1.x code continues to work.

To adopt new features:
1. Update dependencies: `npm install escapekit-mcp@2.0.0`
2. Review [MIGRATION.md](MIGRATION.md)
3. Try examples in [examples/roo-code-integration/](examples/roo-code-integration/)

### From Other Diff Libraries

See [MIGRATION.md](MIGRATION.md) for detailed guides:
- [From jsdiff](MIGRATION.md#from-jsdiff)
- [From diff-match-patch](MIGRATION.md#from-diff-match-patch)
- [From manual string replacement](MIGRATION.md#from-manual-string-replacement)

---

## 🙏 Acknowledgments

Special thanks to the contributors and testers who helped refine the diff-based editing feature.

---

## 📝 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history and detailed changes.

---

## 🔗 Links

- **Documentation**: [docs/roo-code-integration.md](docs/roo-code-integration.md)
- **Examples**: [examples/roo-code-integration/](examples/roo-code-integration/)
- **Migration Guide**: [MIGRATION.md](MIGRATION.md)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Issues**: [GitHub Issues](https://github.com/escapekit/escapekit-mcp/issues)
- **Discord**: [EscapeKit Discord](https://discord.gg/escapekit)

---

## ⚠️ Breaking Changes

**None!** This is a fully backward-compatible release.

---

## 🎉 Highlights

- ✅ **Git-compatible**: Standard unified diff format
- ✅ **Fuzzy matching**: Handle code variations intelligently
- ✅ **Well-tested**: 94.46% coverage, 33 tests
- ✅ **Well-documented**: 1800+ lines of documentation
- ✅ **Practical examples**: 4 working examples
- ✅ **High performance**: <50ms for typical files
- ✅ **Zero regressions**: All existing tests pass
- ✅ **Production-ready**: Backup, recovery, error handling

---

**Version**: 2.0.0  
**Release Date**: 2026-03-16  
**License**: MIT  
**Breaking Changes**: None 🎉

---

## 🚀 Quick Start

```bash
# Install
npm install escapekit-mcp@2.0.0

# Try an example
cd examples/roo-code-integration
tsx basic-diff-apply.ts

# Or use CLI
qwen-escapekit diff generate original.ts modified.ts -o changes.patch
qwen-escapekit diff validate changes.patch
qwen-escapekit diff apply target.ts changes.patch --fuzzy 0.8 --backup
```

**Enjoy effortless code transformations! 🎉**