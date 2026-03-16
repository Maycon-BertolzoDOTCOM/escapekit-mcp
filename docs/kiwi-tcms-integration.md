# Kiwi TCMS Integration Guide

This guide explains how to integrate your test results with Kiwi TCMS using the EscapeKit test adapters.

## Overview

The Kiwi TCMS integration supports multiple test frameworks:
- **Vitest** - Modern JavaScript/TypeScript testing framework
- **Mocha** - Flexible JavaScript test framework with xunit XML output
- **Custom** - Extensible parser for custom JSON formats

## Quick Start

### Installation

```bash
npm install --save-dev @escapekit/kiwi-tcms-integration
```

### Basic Usage

```typescript
import { loadTestResults } from './scripts/load-test-results';

// Load test results (auto-detects framework)
const results = await loadTestResults({ source: 'test-results.json' });

console.log(`Loaded ${results.length} test results`);
console.log(`Passed: ${results.filter(r => r.outcome === 'passed').length}`);
console.log(`Failed: ${results.filter(r => r.outcome === 'failed').length}`);
```

### Command Line Interface

```bash
# Auto-detect framework
tsx scripts/load-test-results.ts test-results.json

# Specify framework explicitly
tsx scripts/load-test-results.ts test-results.json --framework vitest
```

## Framework-Specific Configuration

### Vitest Configuration

#### 1. Configure Vitest to output JSON

Create or update your `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporter: ['json', 'verbose'],
    outputFile: './test-results/vitest-results.json',
  },
});
```

#### 2. Run tests and save results

```bash
npm test
# Results are saved to ./test-results/vitest-results.json
```

#### 3. Load results with Kiwi TCMS

```typescript
import { loadTestResults } from './scripts/load-test-results';

const results = await loadTestResults({ 
  source: './test-results/vitest-results.json',
  framework: 'vitest'  // optional, auto-detected
});

// Process results for Kiwi TCMS
results.forEach(result => {
  console.log(`Test: ${result.testCase}`);
  console.log(`Status: ${result.outcome}`);
  console.log(`Duration: ${result.duration}ms`);
});
```

### Mocha Configuration

#### 1. Install Mocha xunit reporter

```bash
npm install --save-dev mocha-xunit-reporter
```

#### 2. Configure Mocha to output XML

Create or update your `.mocharc.js`:

```javascript
module.exports = {
  reporter: 'xunit',
  reporterOptions: {
    output: './test-results/mocha-results.xml',
  },
};
```

#### 3. Run tests and save results

```bash
npm test
# Results are saved to ./test-results/mocha-results.xml
```

#### 4. Load results with Kiwi TCMS

```typescript
import { loadTestResults } from './scripts/load-test-results';

const results = await loadTestResults({ 
  source: './test-results/mocha-results.xml',
  framework: 'mocha'  // optional, auto-detected
});
```

### Custom JSON Format

#### 1. Define your custom JSON schema

```typescript
interface CustomTestResult {
  version: string;
  framework: 'custom';
  tests: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    file?: string;
    message?: string;
  }>;
}
```

#### 2. Create test results in custom format

```json
{
  "version": "1.0",
  "framework": "custom",
  "tests": [
    {
      "name": "should pass",
      "status": "passed",
      "duration": 100,
      "file": "test/example.test.js"
    },
    {
      "name": "should fail",
      "status": "failed",
      "duration": 50,
      "file": "test/example.test.js",
      "message": "Expected true to be false"
    }
  ]
}
```

#### 3. Load custom results with Kiwi TCMS

```typescript
import { loadTestResults } from './scripts/load-test-results';

const results = await loadTestResults({ 
  source: './test-results/custom-results.json',
  framework: 'custom'
});
```

#### 4. Advanced Custom Format with Transform

```typescript
import { CustomTestParser } from './src/adapters/custom-parser';

const parser = new CustomTestParser({
  transform: (test) => ({
    testCase: `Custom Suite - ${test.name}`,
    outcome: mapStatus(test.status),
    duration: test.duration,
    metadata: {
      file: test.file,
      message: test.message,
    },
  }),
});

const results = await parser.load('./test-results/custom-results.json');
```

## Advanced Usage

### Loading Multiple Test Result Files

```typescript
import { loadMultipleTestResults } from './scripts/load-test-results';

const results = await loadMultipleTestResults([
  './test-results/vitest-unit.json',
  './test-results/vitest-integration.json',
  './test-results/mocha-e2e.xml',
]);

console.log(`Total results: ${results.length}`);
```

### Framework Auto-Detection

The integration automatically detects the framework based on:

1. **Mocha XML**: Contains `<testsuite>` or `<testsuites>` tags
2. **Custom JSON**: Has `framework: 'custom'` and `tests` array
3. **Vitest JSON**: Has `testResults`, `testFiles`, or `vitest` fields

Example:

```typescript
import { detectFramework } from './scripts/load-test-results';

console.log(detectFramework('{"testResults":[]}'));  // 'vitest'
console.log(detectFramework('<?xml version="1.0"?><testsuite></testsuite>'));  // 'mocha'
console.log(detectFramework('{"framework":"custom","tests":[]}'));  // 'custom'
```

### Status Mapping

Each adapter maps framework-specific statuses to unified outcomes:

| Framework | Original Status | Mapped Outcome |
|-----------|----------------|----------------|
| Vitest | `pass` | `passed` |
| Vitest | `fail` | `failed` |
| Vitest | `skip` | `skipped` |
| Vitest | `todo` | `skipped` |
| Mocha | `pass` | `passed` |
| Mocha | `fail` | `failed` |
| Mocha | `pending` | `skipped` |
| Custom | `passed` | `passed` |
| Custom | `failed` | `failed` |
| Custom | `skipped` | `skipped` |

## Troubleshooting

### Issue: "Auto-detected framework: vitest" but file is custom format

**Cause**: Custom JSON file missing `framework: 'custom'` field.

**Solution**: Ensure your custom JSON includes the framework field:
```json
{
  "framework": "custom",
  "tests": [...]
}
```

### Issue: "Loaded 0 tests from file"

**Cause**: Test result format doesn't match expected structure.

**Solution**: 
1. For Vitest: Ensure file has `testResults` array with nested `result.state` field
2. For Mocha: Ensure XML has proper `<testcase>` elements
3. For Custom: Ensure JSON validates against schema

### Issue: VitestAdapter returns empty array

**Cause**: Vitest JSON format mismatch. The adapter expects nested `result` objects.

**Solution**: Use correct Vitest JSON format:
```json
{
  "testResults": [
    {
      "name": "test.js",
      "filepath": "test.js",
      "result": {
        "state": "pass",
        "duration": 100
      },
      "tests": []
    }
  ]
}
```

### Issue: MochaAdapter doesn't parse self-closing tags

**Cause**: XML parser doesn't handle self-closing `<testcase />` tags.

**Solution**: The MochaAdapter now handles both self-closing and non-self-closing tags. Ensure you're using the latest version.

### Issue: Custom parser schema validation fails

**Cause**: Custom JSON doesn't match expected schema.

**Solution**: Ensure your JSON includes required fields:
```json
{
  "version": "1.0",
  "framework": "custom",
  "tests": [
    {
      "name": "required",
      "status": "passed|failed|skipped",
      "duration": 0
    }
  ]
}
```

## Performance Considerations

- **Parsing Speed**: ~100ms per 100 tests
- **Memory Usage**: Approximately 1MB per 1000 tests
- **Large Files**: Use `loadMultipleTestResults` for batches of files to avoid memory issues

## API Reference

### loadTestResults

Loads test results from a file or string.

```typescript
function loadTestResults(options: LoadTestResultsOptions): Promise<TestResult[]>
```

**Parameters:**
- `options.framework`: Optional framework type (`'vitest' | 'mocha' | 'custom'`)
- `options.source`: File path or JSON/XML string
- `options.adapterConfig`: Optional configuration for adapter

**Returns:** Promise resolving to array of `TestResult` objects

**Example:**
```typescript
const results = await loadTestResults({
  source: './test-results.json',
  framework: 'vitest'  // optional
});
```

### detectFramework

Auto-detects the test framework from source.

```typescript
function detectFramework(source: string): 'vitest' | 'mocha' | 'custom'
```

**Parameters:**
- `source`: File path or JSON/XML string

**Returns:** Detected framework type

**Example:**
```typescript
const framework = detectFramework('{"testResults":[]}');
console.log(framework);  // 'vitest'
```

### loadMultipleTestResults

Loads test results from multiple files.

```typescript
function loadMultipleTestResults(
  sources: string[],
  options?: Omit<LoadTestResultsOptions, 'source'>
): Promise<TestResult[]>
```

**Parameters:**
- `sources`: Array of file paths
- `options`: Optional LoadTestResultsOptions (except source)

**Returns:** Promise resolving to aggregated array of `TestResult` objects

**Example:**
```typescript
const results = await loadMultipleTestResults([
  './test-results/vitest.json',
  './test-results/mocha.xml'
]);
```

## Contributing

To add support for a new test framework:

1. Create a new adapter in `src/adapters/[framework]-adapter.ts`
2. Implement the `TestAdapter` interface
3. Add framework detection logic in `scripts/load-test-results.ts`
4. Create comprehensive unit tests
5. Update this documentation

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [repository/issues]
- Documentation: [repository/docs]
- Email: support@example.com