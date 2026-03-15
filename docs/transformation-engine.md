# EscapeKit Phase 3 — Transformation Engine

Architecture reference for the 5-layer transformation pipeline that converts sandbox code into production-ready projects.

---

## Overview

The Transformation Engine takes a `AnalysisResult` from Phase 2 and produces a fully scaffolded project with resolved dependencies, transformed source code, and an audit contract. It is organized into five layers with strict unidirectional dependencies.

```
Phase 2 Output                Phase 3 Layers
─────────────    ┌──────────────────────────────────────────┐
AnalysisResult ──► Camada 1: Foundation  (models, errors)   │
               │  Camada 2: Resolution   (resolvers)         │
               │  Camada 3: Transformation (transformers)    │
               │  Camada 4: Generation   (generators)        │
               └──► Camada 5: Validation (validators)        │
                  └──────────────────────────────────────────┘
                                │
                         EscapeKit output
                    (project files + EscapeContract)
```

---

## Layer Responsibilities

### Camada 1 — Foundation
`src/models/transformation.ts` · `src/errors.ts`

Pure data structures and enums. No I/O, no external dependencies. Every other layer imports from here; nothing imports into it.

Key types: `PackageMapping`, `TransformationRule`, `DependencyResolution`, `CodeTransformation`, `EscapeContract`, `ProjectStructure`.

Enums: `MappingStrategy` (EXACT_MATCH, SEMANTIC_MATCH, MANUAL_OVERRIDE, FALLBACK), `ResolutionMethod` (KNOWLEDGE_BASE, NPM_SEARCH, SEMANTIC_ANALYSIS, USER_PROVIDED), `TransformationType` (IMPORT_REPLACEMENT, POLYFILL_INJECTION, API_MIGRATION, CONFIGURATION_GENERATION).

### Camada 2 — Resolution
`src/resolvers/` — `KnowledgeBase`, `SemanticMatcher`, `DependencyResolver`

Resolves ghost package names to real npm packages using a three-tier priority chain:

1. **Manual overrides** — user-supplied mappings, confidence 1.0
2. **KnowledgeBase** — exact lookup in `knowledge-base.json`, confidence 0.95
3. **SemanticMatcher** — fuzzy similarity search via NPMRegistry, confidence 0.5–0.9

`DependencyResolver` orchestrates the chain, validates each candidate against the NPM registry, and caches results (target: 90% hit rate after warmup). Rate limiting (100 ms default between requests) prevents registry abuse.

### Camada 3 — Transformation
`src/transformers/` — `ASTTransformer`, `ImportReplacer`

Rewrites source code at the AST level.

- **ASTTransformer** — wraps Babel parser + `@babel/traverse` + recast. Handles ES6 imports, CommonJS `require()`, dynamic `import()`, and TypeScript type imports. Uses recast for formatting-preserving code generation.
- **ImportReplacer** — applies `DependencyResolution[]` to an AST, producing a `CodeTransformation` with diff stats.

### Camada 4 — Generation
`src/generators/` — `TemplateEngine`, `EscapeContractWriter`, `ProjectGenerator`, `TransformationPipeline`

Produces the output project on disk.

- **TransformationPipeline** — bridges Phase 2 → Phase 3: extracts ghost import issues from `AnalysisResult`, filters by `autoFixable`, emits warnings for low-confidence scores.
- **TemplateEngine** — renders Handlebars templates (`package.json.hbs`, `Dockerfile.hbs`, `README.md.hbs`, CI workflow).
- **ProjectGenerator** — creates directory structure, writes rendered files, wires up dependencies.
- **EscapeContractWriter** — generates, serializes, and validates `EscapeContract` JSON. Calculates SHA-256 hash of original code for tamper detection.

### Camada 5 — Validation
`src/validators/ProjectValidator`

Post-generation quality gate. Runs six check categories:

1. Required file existence (`package.json`, `tsconfig.json`)
2. `package.json` JSON validity and required fields
3. `tsconfig.json` JSON validity
4. `EscapeContract` schema validation
5. Ghost import detection (regex scan for `fake-*`, `mock-*`, `sandbox-*`, `claude-*`, etc.)
6. Basic syntax check (unbalanced bracket detection)

Returns `ProjectValidationResult` with per-check pass/fail and a summary count.

---

## Data Flow Sequence

```
AnalysisResult
      │
      ▼
TransformationPipeline.processAnalysisResult()
  ├─ filter issues by type === 'ghost_import'
  ├─ skip non-autoFixable (unless force=true)
  └─ emit warning if confidenceScore < 0.5
      │
      ▼ ghostImports[]
DependencyResolver.resolveBatch()
  ├─ 1. manualMappings.get(name)          → confidence 1.0
  ├─ 2. KnowledgeBase.getMapping(name)    → confidence 0.95
  └─ 3. SemanticMatcher.findSimilar(name) → confidence 0.5–0.9
       └─ NPMRegistry.packageExists() + getLatestVersion()
      │
      ▼ DependencyResolution[]
ImportReplacer.replaceImports(sourceCode, resolutions)
  └─ ASTTransformer: parse → traverse → replaceImport → generate
      │
      ▼ CodeTransformation (transformedCode + diff stats)
EscapeContractWriter.generate()
  └─ builds EscapeContract with origin hash, resolutions, transformations
      │
      ▼ EscapeContract
ProjectGenerator.generate()
  └─ TemplateEngine renders package.json, tsconfig, Dockerfile, CI
      │
      ▼ ProjectStructure (files on disk)
ProjectValidator.validate()
  └─ 6 check categories → ProjectValidationResult
      │
      ▼
EscapeKit { escapeId, outputPath, filesCreated, summary }
```

---

## Integration with Phase 2

| Phase 2 Component | How Phase 3 Uses It |
|---|---|
| `AnalysisResult` | Entry point for `TransformationPipeline`; provides `issues[]`, `confidenceScore`, `sandboxType`, `analysisId` |
| `Issue` (type: `ghost_import`) | Each issue's `message` is parsed to extract the package name for resolution |
| `NPMRegistry` | Called by `DependencyResolver` to verify package existence and fetch latest version; also used by `SemanticMatcher` for candidate search |
| `SandboxDetector` | `sandboxType` from analysis is recorded in `EscapeContract.origin.sandboxType` for audit purposes |
| `CodeAnalyzer` | Produces the `AnalysisResult` that feeds the pipeline; `analysisId` is preserved through the entire chain |

---

## Key Data Types

### PackageMapping
```typescript
interface PackageMapping {
  ghostPackage: string;          // e.g. 'fake-api-client'
  realPackages: string[];        // ranked: ['axios', 'node-fetch']
  confidence: number;            // 0.0 – 1.0
  mappingStrategy: MappingStrategy;
  metadata?: {
    reason?: string;
    alternatives?: string[];
    source?: string;             // 'knowledge-base.json' | 'npm-search'
  };
}
```

### TransformationRule
```typescript
interface TransformationRule {
  ruleId: string;                // 'import-replacement-001'
  ruleType: TransformationType;
  sourcePattern: string;         // ghost package name or regex
  targetPattern: string;         // real package name
  metadata?: {
    description?: string;
    examples?: string[];         // ["import x from 'fake' → import x from 'axios'"]
    tags?: string[];
  };
}
```

### EscapeContract
```typescript
interface EscapeContract {
  contractId: string;
  analysisId: string;
  origin: {
    sandboxType?: string;        // 'claude-artifacts' | 'replit' | 'codesandbox'
    originalCodeHash: string;    // 'sha256:abc123...'
    detectedIssues: number;
  };
  transformations: {
    ghostImportResolutions: DependencyResolution[];
    codeTransformations: CodeTransformation[];
    appliedRules: TransformationRule[];
  };
  assumptions: string[];         // low-confidence or unverified packages
  validationStatus: 'PENDING' | 'PASSED' | 'FAILED';
  metadata: {
    generatedBy: string;         // 'EscapeKit MCP'
    toolVersion: string;
    targetPlatform: string;      // 'vercel' | 'netlify' | 'docker' | 'local'
    timestamp: string;           // ISO 8601
  };
}
```

---

## Chinese Sovereignty Features (自主创新)

Six components provide supply-chain independence and air-gapped operation support.

### MirrorRegistry (`src/mirrors/MirrorRegistry.ts`)
Routes npm registry requests through Chinese mirrors with sequential fallback:

```
Priority 1: npmmirror  → https://registry.npmmirror.com  (timeout: 5s)
Priority 2: taobao     → https://registry.npm.taobao.org (timeout: 5s)
Priority 3: npmjs      → https://registry.npmjs.org      (timeout: 10s)
```

Set `enableChineseMirrors: false` to use only the global registry. Set `offlineMode: true` to disable all network requests.

### SecurityValidator (`src/security/SecurityValidator.ts`)
Validates packages before inclusion:
- **CVE check** — known vulnerable packages (event-stream, ua-parser-js, node-ipc, colors, etc.)
- **License check** — allowlist: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, and others
- **Maintenance check** — warns if last update > 12 months ago (configurable)
- **Deprecation check** — flags deprecated packages

Returns `SecurityValidationResult { safe, vulnerabilities[], warnings[], licenseCompatible, maintained, deprecated }`.

### OfflinePackageCache (`src/cache/OfflinePackageCache.ts`)
Pre-populates an in-memory + disk cache of `CachedPackageInfo` records for air-gapped environments. Cache can be exported to a distributable JSON file and loaded on isolated machines.

### LockFileGenerator (`src/lockfile/LockFileGenerator.ts`)
Generates `package-lock.json` (lockfileVersion 3) with SHA-256 integrity hashes for every resolved dependency, ensuring reproducible installs across environments.

### AuditLogger (`src/audit/AuditLogger.ts`)
Appends an `AuditEntry` for every external operation (mirror used, package name, duration, success/failure). Exports to JSON. Provides `getStatistics()` with per-mirror usage breakdown and success rate.

### RateLimiter (`src/ratelimit/RateLimiter.ts`)
Token-bucket rate limiter protecting against registry abuse. Configurable `maxRequests` per `windowMs` window plus a `minDelayMs` floor between consecutive requests. Used by `DependencyResolver` (default: 100 ms between npm calls).

---

## Entry Points

### MCP Tool — `src/tools/generate.ts`
```typescript
generateEscapeKit(
  analysisResult: AnalysisResult,
  sourceCode: string,
  targetPlatform = 'local',    // 'vercel' | 'netlify' | 'docker' | 'local'
  outputDir = './escape_output',
  options: GenerateOptions      // { includeDocker, includeCI, force, dryRun }
): Promise<MCPResponse<EscapeKit>>
```

Runs the full pipeline in sequence: TransformationPipeline → DependencyResolver → ImportReplacer → EscapeContractWriter → ProjectGenerator.

### CLI — `cli/index.ts`
```
escapekit generate --analysis-id <id> --platform vercel --output ./out
```

Thin wrapper around `generateEscapeKit()` with argument parsing and console output.
