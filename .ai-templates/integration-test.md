# 🧪 AI Template: Integration Test (End-to-End)

## Context
We are creating an integration test for the EscapeKit MCP pipeline. Integration tests validate the full flow: **analyze → generate → validate**, ensuring all components work together correctly.

## Task
Create an integration test that validates **[description of the scenario being tested]**.

## Technical Requirements

### 1. File Location
- Tests: `tests/integration/[scenario-name].integration.test.ts`
- Fixtures: `tests/fixtures/[scenario-name]/` (input files)

### 2. Test Structure
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JavaScriptAnalyzer } from '../../src/analyzers/JavaScriptAnalyzer';
import { CodeAnalyzer } from '../../src/analyzers/CodeAnalyzer';
import { NPMRegistry } from '../../src/services/NPMRegistry';
import fs from 'fs';
import path from 'path';

describe('Integration: [Scenario Name]', () => {
  let analyzer: CodeAnalyzer;
  
  beforeAll(() => {
    analyzer = new CodeAnalyzer({
      // Use test config with shorter timeouts
      timeout: 5000,
      retries: 1,
    });
  });

  describe('Phase 1: Analysis', () => {
    it('should detect all issues in the sample project', async () => {
      const code = fs.readFileSync(
        path.join(__dirname, '../fixtures/[scenario]/input.js'),
        'utf-8'
      );
      const result = await analyzer.analyze(code);
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.analysisId).toBeDefined();
      // Validate specific issues...
    });
  });

  describe('Phase 2: Transformation', () => {
    it('should transform ghost imports to real packages', async () => {
      // Use analysis result from Phase 1
      // Validate transformed code compiles
      // Validate all ghost imports were replaced
    });
  });

  describe('Phase 3: Validation', () => {
    it('should generate a valid project structure', async () => {
      // Verify generated files exist
      // Verify package.json has correct dependencies
      // Verify no ghost imports remain in output
    });
  });
});
```

### 3. Fixture Requirements
Create realistic test fixtures that represent real-world AI-generated code:

```
tests/fixtures/[scenario-name]/
├── input.js          # Original AI-generated code (with ghost imports, mock APIs)
├── expected/         # Expected outputs for assertions
│   ├── package.json  # Expected dependencies
│   └── output.js     # Expected transformed code (optional, for snapshots)
└── README.md         # Description of what this fixture tests
```

### 4. Key Test Categories

| Category | What to Test | Assertion |
|----------|-------------|-----------|
| **Ghost Imports** | All ghost imports detected and replaced | `issues.filter(i => i.type === 'GHOST_IMPORT')` |
| **Mock APIs** | localhost/mockapi.io URLs flagged | `issues.filter(i => i.type === 'MOCK_API')` |
| **WebGL** | Three.js/Canvas patterns detected | `issues.filter(i => i.type === 'UNREALISTIC_ASSUMPTION')` |
| **Confidence Score** | Score reflects issue severity | `result.confidence >= 0 && result.confidence <= 1` |
| **No Crash** | Malformed code doesn't crash the pipeline | `expect(analyze(badCode)).resolves.toBeDefined()` |
| **Performance** | Analysis completes within time budget | `expect(duration).toBeLessThan(5000)` |

### 5. Network Considerations
- Mock NPM registry calls in unit tests
- For integration tests, use `nock` or similar to intercept HTTP
- Always set explicit timeouts to prevent test hangs

### 6. Cleanup
```typescript
afterAll(async () => {
  // Clean up any generated files/directories
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
});
```

## Example Fixture (Ghost Import Scenario)
```javascript
// tests/fixtures/ghost-imports/input.js
import React from 'react';
import * as THREE from 'three.js';         // ghost: should be 'three'
import { api } from 'mockapi.io';           // ghost: doesn't exist
import { Canvas } from '@react-three/fiber'; // real: exists on npm

const App = () => {
  const data = api.get('/users');
  return <Canvas><mesh /></Canvas>;
};

export default App;
```

## Reference
- Analyzer: `src/analyzers/CodeAnalyzer.ts`, `src/analyzers/JavaScriptAnalyzer.ts`
- Transformer: `src/transformers/ASTTransformer.ts`
- Generator: `src/generators/`
- Existing tests: `tests/` (mirror the directory structure)
