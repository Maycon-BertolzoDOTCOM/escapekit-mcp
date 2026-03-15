# 🤝 Contributing to EscapeKit MCP

Thank you for your interest in contributing! EscapeKit is an open-source project breaking the **Ralph Loop Inverso** — we welcome contributions of all sizes.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Issue Labels](#issue-labels)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Pull Request Checklist](#pull-request-checklist)

---

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/). Be kind, be respectful, be constructive.

---

## Getting Started

1. **Fork** the repository on GitHub
2. Follow [ONBOARDING.md](ONBOARDING.md) to set up your environment
3. Browse issues labeled `good first issue` to find a starting point
4. Read [MANIFESTO.md](MANIFESTO.md) to understand our principles

---

## Issue Labels

We use labels to categorize work and guide new contributors:

### Difficulty
| Label | Description |
|-------|-------------|
| `good first issue` | Ideal for first-time contributors — self-contained, well-documented |
| `help wanted` | Open for community contributions, may require some project knowledge |
| `advanced` | Requires deep understanding of AST, parsers, or MCP protocol |

### Area
| Label | Description |
|-------|-------------|
| `analyzer` | Code analysis engine (`src/analyzers/`, `src/detectors/`) |
| `transformer` | AST transformation engine (`src/transformers/`) |
| `security` | Security detectors and supply-chain protection (`src/security/`) |
| `cli` | CLI experience (`cli/`) |
| `mcp-server` | MCP protocol and tools (`src/server.ts`, `src/tools/`) |
| `resolver` | Ghost import → real package resolution (`src/resolvers/`) |
| `diff` | Diff-based editing and fuzzy matching (`src/transformers/DiffApplyTransformer.ts`) |
| `docs` | Documentation improvements |
| `examples` | Example code and tutorials (`examples/`) |
| `tests` | Test coverage improvements |

### Priority
| Label | Description |
|-------|-------------|
| `P0-critical` | Security vulnerabilities, data loss, crash bugs |
| `P1-high` | Core feature blockers, Phase 3/4 deliverables |
| `P2-medium` | UX improvements, performance optimization |
| `P3-low` | Nice-to-haves, future features |

---

## Development Workflow

### 1. Branch Naming

```
<type>/<short-description>

# Examples:
feat/unicode-analyzer
fix/npm-registry-timeout
docs/onboarding-guide
test/mock-api-detector
```

### 2. Making Changes

```bash
# Create a feature branch
git checkout -b feat/my-feature

# Make changes
# ...

# Run checks before committing
npm run lint
npm run typecheck
npm test

# Commit with descriptive message
git commit -m "feat: add UnicodeAnalyzer for homoglyph detection"
```

### 3. Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

# Types: feat, fix, docs, test, refactor, perf, chore
# Scope: analyzer, transformer, security, cli, mcp, resolver

# Examples:
feat(security): add PostInstallDetector for malicious scripts
fix(analyzer): handle scoped packages in ghost import detection
test(transformer): add AST preservation tests for ImportReplacer
docs: update ONBOARDING.md with Linux-specific instructions
```

### 4. Submit Pull Request

- Fill in the PR template
- Link related issues
- Ensure all CI checks pass
- Request review from a maintainer

---

## Code Standards

### TypeScript Rules
- **Strict mode** enabled — no `any` unless absolutely justified
- **Tree-sitter for AST** — never use regex for code parsing
- **Explicit error handling** — use error classes from `src/errors.ts`
- **Structured logging** — use the logger from `src/logger.ts`

### Testing Rules
- **Every new feature** requires tests in `tests/` (mirror `src/` structure)
- **Framework:** Vitest
- **Target coverage:** >70% for new code
- **Include edge cases:** malformed AST, network failures, empty input

### Documentation and Examples Rules
- **Every new feature** requires documentation in appropriate docs/ file
- **API changes** must be documented with JSDoc comments
- **Examples** should be added to `examples/` directory for complex features
- **TypeDoc** should be generated for all public APIs
- **Migration guides** should be provided for breaking changes
- **README updates** required for user-facing features
- **CHANGELOG** must be updated following [Keep a Changelog](https://keepachangelog.com/)
- **Examples checklist**:
  - [ ] Working code that can be executed
  - [ ] Clear README in examples/ subdirectory
  - [ ] Comments explaining key concepts
  - [ ] Expected output documented
  - [ ] Prerequisites listed
  - [ ] Troubleshooting section

### Diff-Based Editing Guidelines (v2.0.0+)
- **New transformers** using diffs must extend `DiffApplyTransformer`
- **Fuzzy threshold** should be configurable (default: 0.8)
- **Backup option** must be provided for critical file operations
- **Diff validation** should be performed before application
- **Error handling** must include partial success reporting
- **Performance**: Target <50ms for typical files, <200ms for large files
- **Test coverage**: Minimum 90% for diff-related features
- **Multi-hunk support** required for complex diffs
- **UTF-8 handling** must be tested for international characters

### Security Rules
- Detection of malicious scripts (`postinstall`, suspicious `curl` pipes) is **P0**
- Never log or expose user source code externally
- All NPM registry calls must have timeout + retry

### File Organization
```
# New detector → src/detectors/MyDetector.ts + tests/detectors/MyDetector.test.ts
# New transformer → src/transformers/MyTransformer.ts + tests/transformers/MyTransformer.test.ts
# New security scanner → src/security/MyScanner.ts + tests/security/MyScanner.test.ts
```

---

## Pull Request Checklist

Before submitting your PR, please verify:

- [ ] Code compiles without errors (`npm run typecheck`)
- [ ] All existing tests pass (`npm test`)
- [ ] New tests have been added for new functionality
- [ ] Linter passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Commit messages follow Conventional Commits
- [ ] Documentation updated if needed (README, ONBOARDING, etc.)
- [ ] No secrets, tokens, or personal data in the code

---

## 🙏 Thank You

Every contribution — whether code, docs, issues, or ideas — helps break the Ralph Loop Inverso. Together, we're making AI-generated code truly portable.

**Let's build the escape!** 🚀
