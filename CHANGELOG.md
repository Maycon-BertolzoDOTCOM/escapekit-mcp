# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Phase 5: Roo Code Integration (Diff-Based Editing) 🚀

**DiffApplyTransformer** (src/transformers/DiffApplyTransformer.ts):
- New core transformer for applying unified diffs with fuzzy matching
- `applyDiff()`: Apply patches to files with backup support and error recovery
- `generateDiff()`: Generate unified diffs between two code versions
- `validateDiff()`: Validate unified diff format (Git-compatible)
- `applyFuzzyDiff()`: Apply diffs with configurable similarity threshold (0.0-1.0)
- Private methods: `applyDiffToContent()`, `parseDiffHunks()`, `applyHunk()`, `findBestContextMatch()`, `calculateSimilarity()`, `levenshteinDistance()`, `applyHunkAtPosition()`
- Full support for multi-hunk diffs
- UTF-8 character handling
- Large file support (>1000 lines)
- Backup file generation with `.backup` extension

**CLI Commands** (qwen-escapekit):
- `diff apply <file> <diff>`: Apply unified diff to file with fuzzy matching
- `diff generate <original> <modified>`: Generate diff between files
- `diff validate <diff>`: Validate diff format
- Options: `--fuzzy <0-1>` (threshold), `--backup`, `-o <output>`
- Colorized output with chalk
- Detailed success/failure reporting

**Quality Metrics**:
- Test Coverage: 94.46% (33 tests, exceeds 90% target)
- Performance: <50ms for typical files, <200ms for large files
- Zero regressions: All existing 670 tests passing
- Lint: Passing without errors
- Typecheck: Passing without errors

**Integration**:
- TransformationPipeline updated to include DiffApplyTransformer
- EscapeContract supports diff metadata
- Full integration with ImportReplacer and ASTTransformer
- Diff application can be orchestrated in transformation workflows

**Testing**:
- 33 comprehensive unit tests covering all public and private methods
- Integration tests for end-to-end workflows
- Edge case testing: empty files, multi-hunk, UTF-8, large files
- Fuzzy matching tests with various thresholds
- Backup and recovery tests

### Changed

- Updated README.md to include Diff-Based Editing feature section
- Added CLI commands documentation for diff operations
- Updated qwen-escapekit/src/index.ts to register diff subcommands
- Improved test coverage from 55.55% to 94.46% for DiffApplyTransformer
- Enhanced error reporting with detailed messages

### Fixed

- Fixed fuzzy matching algorithm with proper Levenshtein distance implementation
- Fixed multi-hunk diff application with correct positioning
- Fixed backup creation and recovery logic
- Fixed edge cases: empty file handling, partial success on failed hunks
- Fixed context similarity calculation for fuzzy matching
- Fixed threshold clamping to valid range [0.0, 1.0]

### Technical Details

**Fuzzy Matching Algorithm**:
- Levenshtein distance for string similarity calculation
- Context-based matching (lines before/after target)
- Configurable threshold: 0.0 (permissive) to 1.0 (strict)
- Default threshold: 0.8
- Similarity score normalized to [0.0, 1.0]

**Unified Diff Format**:
```
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 context line
-old content
+new content
 another context line
```

**API Usage Example**:
```typescript
import { DiffApplyTransformer } from './transformers/DiffApplyTransformer.js';

const transformer = new DiffApplyTransformer();

// Apply diff
const result = await transformer.applyDiff('src/file.ts', diffContent);
console.log(`Success: ${result.success}, Hunks: ${result.hunksApplied}`);

// Fuzzy matching
await transformer.applyFuzzyDiff('src/file.ts', diffContent, 0.8);

// Generate diff
const diff = transformer.generateDiff(original, modified);

// Validate
const isValid = transformer.validateDiff(diff);
```

**CLI Usage Example**:
```bash
# Apply diff with fuzzy matching
qwen-escapekit diff apply source.ts changes.patch --fuzzy 0.8 --backup

# Generate diff
qwen-escapekit diff generate original.ts modified.ts -o changes.patch

# Validate diff
qwen-escapekit diff validate changes.patch
```

### Migration Notes

- No breaking changes for existing functionality
- DiffApplyTransformer is opt-in (not applied automatically)
- Must be explicitly called in transformation workflows
- Backup files use `.backup` extension
- Fuzzy threshold can be tuned per use case

### Documentation

- docs/roo-code-integration.md (coming soon)
- examples/roo-code-integration/ (coming soon)
- API documentation with TypeDoc (coming soon)

---

## [Unreleased]

### Added - Phase 3: Transformation Engine

- **DependencyResolver**: KnowledgeBase (exact match) + SemanticMatcher (fuzzy) + NPMRegistry integration
- **ASTTransformer**: Babel + recast for AST-based code transformation with formatting preservation
- **ProjectGenerator**: Handlebars templates for package.json, tsconfig, Dockerfile, and CI workflows
- **EscapeContractWriter**: YAML/JSON contract documenting all applied transformations
- **Chinese Sovereignty (自主创新)**: Chinese mirror support, offline package cache, security validation, audit logging
- **TransformationPipeline**: End-to-end orchestration of resolve → transform → generate steps

### Added - Phase 2: Analysis Engine

- **CodeAnalyzer**: Ghost import detection, mock API detection, WebGL detection
- **SandboxDetector**: Identifies AI Studio, Bolt.new, Replit environments
- **ConfidenceScoring**: Calculates code quality score based on detected issues
- **MCP Integration**: Tools for analyze_sandbox_code, generate_escape_kit, validate_reality

### Added - Phase 1: Project Init

- **Project Structure**: Monorepo setup with src/, tests/, docs/
- **Testing Framework**: Vitest with 670+ tests
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Documentation**: Comprehensive README and API documentation

---

## [0.1.0] - Initial Release

### Added
- Initial project structure
- Basic MCP server implementation
- Ghost import detection
- Mock API detection
- Core transformation engine
- Project generation templates
- CLI interface (analyze, generate, validate)

---

[Unreleased]: https://github.com/escapekit/escapekit-mcp/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/escapekit/escapekit-mcp/compare/v0.1.0...v2.0.0
[0.1.0]: https://github.com/escapekit/escapekit-mcp/releases/tag/v0.1.0