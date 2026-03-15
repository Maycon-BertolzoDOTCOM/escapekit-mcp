# generateEscapeKit() — MCP Tool Usage Examples

## Basic Usage

```typescript
import { generateEscapeKit } from './src/tools/generate.js';
import type { AnalysisResult } from './src/models/schemas.js';

// Assumes you already have an AnalysisResult from the analyze step
const response = await generateEscapeKit(
  analysisResult,   // AnalysisResult from CodeAnalyzer
  sourceCode,       // original source code string
  'local',          // target platform
  './escape_output' // output directory
);

if (response.success) {
  const kit = response.data;
  console.log(`Escape ID: ${kit.escapeId}`);
  console.log(`Output:    ${kit.outputPath}`);
}
```

## Using Options

```typescript
const response = await generateEscapeKit(
  analysisResult,
  sourceCode,
  'vercel',
  './my-project',
  {
    includeDocker: true,   // add Dockerfile
    includeCI: true,       // add .github/workflows/ci.yml
    dryRun: false,         // set true to preview without writing files
    force: false,          // set true to process non-autoFixable issues
  }
);
```

## Dry Run — Preview Without Writing Files

```typescript
const preview = await generateEscapeKit(
  analysisResult,
  sourceCode,
  'netlify',
  './output',
  { dryRun: true }
);

if (preview.success) {
  const { ghostImportsResolved, dependenciesInstalled } = preview.data.summary;
  console.log(`Would resolve ${ghostImportsResolved} ghost imports`);
  console.log(`Would install ${dependenciesInstalled} dependencies`);
}
```

## Handling the Response

```typescript
const response = await generateEscapeKit(analysisResult, sourceCode);

if (!response.success) {
  const err = response.errors[0];
  console.error(`[${err.code}] ${err.message}`);
  process.exit(1);
}

const kit = response.data;
console.log(`Files created: ${kit.filesCreated.length}`);
console.log(`Contract:      ${kit.escapeContractPath}`);
console.log(`Summary:`, kit.summary);
// { ghostImportsResolved: 3, polyfillsAdded: 0, dependenciesInstalled: 3 }
```

## Real-World Scenario: Claude Artifacts Sandbox Code

Claude Artifacts often uses `three.js`, `fake-fetch`, or `mockapi.io` — none of which are real npm packages.

```typescript
import { CodeAnalyzer } from './src/analyzers/CodeAnalyzer.js';
import { generateEscapeKit } from './src/tools/generate.js';

const artifactCode = `
import * as THREE from 'three.js';
import { get } from 'fake-fetch';

const scene = new THREE.Scene();
const data = await get('https://mockapi.io/users');
`;

// Step 1: analyze
const analyzer = new CodeAnalyzer();
const analysis = await analyzer.analyze(artifactCode, {
  sandboxType: 'claude-artifacts',
  language: 'javascript',
  checkNPMRegistry: true,
});

// Step 2: generate — three.js → three, fake-fetch → node-fetch
const response = await generateEscapeKit(
  analysis,
  artifactCode,
  'vercel',
  './artifact-output',
  { includeDocker: false, includeCI: true }
);

console.log(`Resolved: ${response.data?.summary.ghostImportsResolved} ghost imports`);
// Resolved: 2 ghost imports
```
