# EscapeKit MCP

Analyze AI sandbox code, detect ghost dependencies, transform and validate in real environments.

## Architecture

```
escapekit-mcp/
├── apps/
│   ├── escapekit/          # Core engine (CLI + server)
│   ├── qwen-escapekit/     # Qwen-specific integration
│   └── experimental/       # Experimental features
├── packages/
│   ├── github-action/      # GitHub Action wrapper
│   └── vscode-extension/   # VS Code extension
├── service-core/
│   └── gateway/            # LLM provider gateway (OpenAI, Wavespeed AI, etc.)
├── tools/
│   └── refactor-cli/       # Monorepo refactoring tooling
├── scripts/                # CI/CD and utility scripts
├── docs/                   # Documentation
├── config/                 # Shared configuration
└── knowledge-base/         # Academic paper references
```

## Quick Start

```bash
npm install
npm run build
npx escapekit --help
```

## Apps

### `@escapekit/core`

The main engine. Features:

- **Sandbox Detection** — detects if code runs in AI sandboxes
- **Ghost Dependency Detection** — finds phantom dependencies
- **Import Detection** — traces module imports
- **WebGL Detection** — detects WebGL usage patterns
- **Sandbox Escape Generation** — generates escape contracts
- **Validation Engine** — validates code in Browser, Docker, and Local environments
- **Auto-Fix** — MockReplacer, FallbackGenerator, PolyfillInjector
- **Academic Validation** — coverage validation, issue enrichment, knowledge base
- **Security Scanning** — deep dependency scanning, slopsquat detection, Unicode analysis
- **Audit & Reporting** — CLI, JSON, Markdown, HTML reporters

### `@escapekit/qwen`

Qwen-specific adaptation layer with paper-to-contract and diff capabilities.

## CI/CD

- **GitLab CI** — multi-stage pipeline: lint → typecheck → test → build → deploy
- **Kiwi TCMS** — test management integration for compliance tracking
- **Conformance Checks** — `npm run conformance`

## Development

```bash
# Install dependencies
npm install

# Build all workspaces
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Lint
npm run lint
```

## License

Private — all rights reserved.
