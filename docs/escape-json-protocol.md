# escape.json Protocol v1.0

**Status:** ✅ Implemented  
**Version:** 1.0  
**Schema:** [schemas/escape-json-v1.schema.json](../schemas/escape-json-v1.schema.json)

---

## 📋 Overview

The `escape.json` protocol is the **"digital birth certificate"** for projects analyzed and transformed by EscapeKit. It provides complete traceability from the original AI-generated sandbox code to production deployment, including:

- **Provenance**: Where the code came from
- **Analysis**: What issues were detected
- **Transformations**: What was changed and why
- **Validations**: Quality checks and results
- **Deployment**: Where the code is running
- **Sovereignty**: Chinese self-reliance compliance (自主创新)

---

## 🎯 Purpose

### Why escape.json?

1. **Traceability**: Every project has a complete audit trail from source to production
2. **Auditability**: For consulting engagements ($3k+ contracts), provides documented proof of transformations
3. **Reproducibility**: Can reproduce the exact transformation process
4. **Quality Assurance**: Links to Kiwi TCMS test runs for validation
5. **Compliance**: Documents Chinese sovereignty requirements
6. **Knowledge Transfer**: Useful for team handoffs and code reviews

### Use Cases

- **Consulting Deliverable**: Include `escape.json` in client deliverables
- **Code Review**: Review what was changed and why
- **Compliance Audit**: Verify Chinese sovereignty requirements
- **Regression Analysis**: Track changes over time
- **Documentation**: Auto-generate documentation from protocol data

---

## 📁 File Structure

```
project-root/
├── escape.json              ← Protocol file (v1.0)
├── escape-contract.json     ← Legacy format (still supported)
├── src/
├── package.json
└── ...
```

The `escape.json` file should be **versioned in Git** and committed with the transformed project.

---

## 🔍 Schema Overview

### Top-Level Structure

```typescript
{
  $schema: string;              // JSON Schema URI
  version: string;              // Protocol version (semver)
  escapeId: string;             // Unique identifier
  timestamp: string;            // ISO 8601 timestamp
  
  provenance: Provenance;       // Source provenance
  analysis: AnalysisInfo;       // Analysis details
  transformations: Transformations;  // Changes applied
  validations: Validations;    // Quality checks
  deployment: DeploymentInfo;  // Deployment status
  sovereignty: SovereigntyInfo; // Chinese compliance
  metadata: Metadata;           // Additional info
}
```

### Section Breakdown

#### 1. Provenance (`provenance`)

```typescript
{
  sandbox: string;              // Source sandbox type
  sourceUrl?: string;           // Source URL (if available)
  sourceHash: string;           // SHA-256 of source code
  files: FileRecord[];         // List of original files
  detectedAt: string;          // Detection timestamp
}
```

**Purpose**: Documents where the code originated from.

#### 2. Analysis (`analysis`)

```typescript
{
  analysisId: string;          // Same as escapeId
  analysisAt: string;          // Analysis timestamp
  escapeKitVersion: string;    // EscapeKit version used
  config: AnalysisConfig;       // Configuration used
  issues: DetectedIssue[];      // Issues detected
  confidenceScore: number;     // 0-1 confidence score
  totalIssues: number;         // Total issues count
  issueBreakdown: IssueBreakdown;  // Issue statistics
}
```

**Purpose**: Documents the analysis phase, including all detected issues.

#### 3. Transformations (`transformations`)

```typescript
{
  transformedAt: string;       // Transformations timestamp
  applied: AppliedTransformation[];  // Changes made
  totalTransformations: number; // Total count
  breakdown: TransformationBreakdown;  // Statistics
}
```

**Purpose**: Documents every change made to the code.

#### 4. Validations (`validations`)

```typescript
{
  validations: ValidationRecord[];  // Validations performed
  overallStatus: string;       // pending | in_progress | passed | failed | partial
  totalValidations: number;    // Total count
  passedValidations: number;   // Passed count
  failedValidations: number;   // Failed count
  kiwiTestRunId?: number;     // Kiwi TCMS test run ID
  testResults?: TestResultsSummary;  // Test summary
}
```

**Purpose**: Links to Kiwi TCMS test runs and documents quality checks.

#### 5. Deployment (`deployment`)

```typescript
{
  status: string;              // not_deployed | deployed | failed
  target?: string;             // Deployment target
  url?: string;               // Deployment URL
  deployedAt?: string;         // Deployment timestamp
  environment?: string;        // dev | staging | production
  method?: string;            // manual | railway | vercel | docker
}
```

**Purpose**: Tracks where the code is deployed.

#### 6. Sovereignty (`sovereignty`)

```typescript
{
  compliant: boolean;          // Overall compliance
  complianceScore: number;     // 0-100 score
  checkedAt: string;          // Check timestamp
  chineseMirrors: boolean;    // Chinese mirrors used
  offlineCache: boolean;      // Offline cache used
  securityValidation: boolean; // Security validation passed
  auditLogging: boolean;      // Audit logging enabled
  packageReplacements: PackageReplacement[];  // Replacements made
}
```

**Purpose**: Documents Chinese sovereignty compliance requirements (自主创新).

#### 7. Metadata (`metadata`)

```typescript
{
  projectName?: string;       // Project name
  projectDescription?: string; // Project description
  projectVersion?: string;     // Project version
  author?: string;            // Author name
  organization?: string;      // Organization name
  tags?: string[];           // Categorization tags
  customFields?: Record<string, any>;  // Extensible fields
}
```

**Purpose**: Additional metadata for categorization and customization.

---

## 📝 Usage Examples

### Generating escape.json

```typescript
import { EscapeJsonWriter } from '@escapekit/generators';
import type { AnalysisResult } from '@escapekit/models';

const writer = new EscapeJsonWriter();

const escapeJson = writer.generate({
  analysisResult,
  resolutions,
  transformations,
  kiwiTestRunId: 8,
  testResults: {
    total: 1168,
    passed: 1102,
    failed: 62,
    skipped: 4,
    passRate: 94.35,
    framework: 'vitest',
    executedAt: new Date().toISOString(),
  },
  metadata: {
    projectName: 'My AI-Generated App',
    tags: ['ai-generated', 'nextjs', 'escapekit-transformed'],
  },
});

await writer.writeToFile(escapeJson, './output/escape.json');
```

### Reading escape.json

```typescript
import { readFile } from 'fs/promises';

const content = await readFile('./output/escape.json', 'utf-8');
const escapeJson = JSON.parse(content);

// Validate against schema
const Ajv = require('ajv');
const ajv = new Ajv();
const schema = require('../schemas/escape-json-v1.schema.json');
const validate = ajv.compile(schema);

if (!validate(escapeJson)) {
  console.error('Invalid escape.json:', validate.errors);
  process.exit(1);
}

console.log(`Project: ${escapeJson.metadata.projectName}`);
console.log(`Issues detected: ${escapeJson.analysis.totalIssues}`);
console.log(`Transformations: ${escapeJson.transformations.totalTransformations}`);
console.log(`Kiwi TestRun ID: ${escapeJson.validations.kiwiTestRunId}`);
```

### Integrating with Kiwi TCMS

```typescript
// After uploading tests to Kiwi TCMS
const testRunId = await uploadTestsToKiwi(testResults);

// Update escape.json with test run ID
escapeJson.validations.kiwiTestRunId = testRunId;
escapeJson.validations.testResults = {
  total: testResults.length,
  passed: testResults.filter(r => r.status === 'passed').length,
  failed: testResults.filter(r => r.status === 'failed').length,
  skipped: testResults.filter(r => r.status === 'skipped').length,
  passRate: (passedCount / totalCount * 100),
  framework: 'vitest',
  executedAt: new Date().toISOString(),
};

// Write updated escape.json
await writeFile('./output/escape.json', JSON.stringify(escapeJson, null, 2));
```

---

## 🔍 Validation

### Using JSON Schema

```bash
npm install -g ajv-cli
ajv validate -s schemas/escape-json-v1.schema.json -d escape.json
```

### Using TypeScript

```typescript
import type { EscapeJson } from '@escapekit/models/escape-json-schema';

const escapeJson: EscapeJson = JSON.parse(content);
// TypeScript will validate at compile time
```

---

## 📊 Example Output

See [examples/escape.json.example](../examples/escape.json.example) for a complete example.

---

## 🔄 Version History

### v1.0 (2026-03-18)

- Initial release
- Supports provenance, analysis, transformations, validations, deployment, sovereignty
- Kiwi TCMS integration via `kiwiTestRunId`
- JSON Schema validation
- TypeScript types

---

## 🚀 Roadmap

### v1.1 (Planned)

- [ ] Digital signature support for integrity verification
- [ ] Compression of large code snippets
- [ ] Differential updates (diff-based)
- [ ] Obsidian integration support

### v2.0 (Future)

- [ ] GraphQL schema support
- [ ] Real-time sync with Kiwi TCMS
- [ ] AI-powered insights and recommendations
- [ ] Multi-project dependency tracking

---

## 📚 References

- [Schema Definition](../schemas/escape-json-v1.schema.json)
- [TypeScript Types](../src/models/escape-json-schema.ts)
- [Writer Implementation](../src/generators/EscapeJsonWriter.ts)
- [Kiwi TCMS Integration](./kiwi-tcms-integration.md)

---

## 🤝 Contributing

When contributing to the escape.json protocol:

1. Update the JSON schema in `schemas/escape-json-v1.schema.json`
2. Update TypeScript types in `src/models/escape-json-schema.ts`
3. Update the `EscapeJsonWriter` implementation
4. Update this documentation
5. Provide examples in `examples/escape.json.example`

---

## 📄 License

This protocol is part of EscapeKit and is licensed under the MIT License.

---

**Last Updated:** 2026-03-18  
**Maintainer:** EscapeKit Team