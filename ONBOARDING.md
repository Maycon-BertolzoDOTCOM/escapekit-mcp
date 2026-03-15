# 🚀 EscapeKit MCP — Onboarding Guide

> **Goal:** Go from `git clone` to running your first escape analysis in under 10 minutes.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | ≥ 18.0.0 | `node -v` |
| npm | ≥ 9.0.0 | `npm -v` |
| Git | any | `git --version` |

---

## 1. Clone & Install (~2 min)

```bash
git clone https://github.com/escapekit/escapekit-mcp.git
cd escapekit-mcp
npm install
```

## 2. Build (~1 min)

```bash
npm run build
```

## 3. Run Your First Analysis (~1 min)

### Option A: Analyze a file

```bash
npx tsx cli/index.ts analyze examples/sample-ai-code.js
```

### Option B: Analyze inline code

```bash
npx tsx cli/index.ts analyze --code "import { api } from 'mockapi.io'; import * as THREE from 'three.js';"
```

You should see output like:

```
🔍 Analyzing code...
   Sandbox: ai-studio
   Language: javascript

✅ Analysis complete!

Summary:
   Total Issues: 2
   Ghost Imports: 2
   Confidence Score: 0.40

Issues found:
  ❌ [GHOST_IMPORT] Package "mockapi.io" does not exist on npm
  ❌ [GHOST_IMPORT] Package "three.js" should be "three"
```

## 4. Generate a Portable Project (~2 min)

Use the `analysis_id` from the previous output:

```bash
npx tsx cli/index.ts generate <analysis_id> --target nextjs --output ./my-escaped-app
```

This generates a complete Next.js project with real dependencies replacing ghost imports.

## 5. Explore the MCP Server (Optional)

Connect EscapeKit to Claude Desktop:

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
// %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "escapekit": {
      "command": "node",
      "args": ["<path-to-project>/dist/server.js"]
    }
  }
}
```

Then ask Claude: *"Analyze this code for sandbox dependencies"*

---

## 🏗️ Project Architecture (Quick Overview)

```
src/
├── analyzers/        # Code analysis engine (Tree-sitter AST)
├── detectors/        # Ghost imports, Mock APIs, WebGL, Sandbox patterns
├── transformers/     # AST transformation (Babel + recast)
├── resolvers/        # Ghost import → real package mapping
├── generators/       # Project scaffolding (Handlebars templates)
├── security/         # Supply-chain attack detection
├── services/         # NPM Registry client (with cache + retry)
├── validators/       # Runtime validation engine
├── models/           # TypeScript interfaces & data models
├── tools/            # MCP tool definitions
├── config.ts         # Configuration management
├── errors.ts         # Error hierarchy
├── logger.ts         # Structured logging
└── server.ts         # MCP server entry point

cli/
└── index.ts          # CLI entry point (Commander.js)

tests/                # Vitest tests (mirroring src/ structure)
templates/            # Handlebars templates for project generation
```

## 🧪 Run Tests

```bash
npm test                 # Run all tests
npm test -- --watch      # Watch mode
npm run test:coverage    # Coverage report
```

## 📚 Next Steps

- Read [README.md](README.md) for full feature documentation
- Read [CONTRIBUTING.md](CONTRIBUTING.md) to start contributing
- Read [MANIFESTO.md](MANIFESTO.md) to understand the project philosophy
- Check [PROJECT_HEALTH.md](PROJECT_HEALTH.md) for current project status
- Explore `.ai-templates/` for AI-assisted coding prompts

---

**Welcome aboard! Let's break the Ralph Loop Inverso together.** 🎯
