# SystemEval Integration for EscapeKit MCP

## Overview

SystemEval is integrated with EscapeKit MCP to provide standardized JSON output for MCP agent consumption. This integration allows AI agents to deterministically consume test results from Vitest.

## Architecture

```
Vitest Tests → Vitest JSON → Python Adapter → SystemEval JSON → MCP Agents
```

### Components

1. **Vitest Runner**: Executes test suite and generates JSON output
2. **Python Adapter** (`vitest-adapter.py`): Converts Vitest JSON to SystemEval format
3. **Shell Script** (`run-systemeval.sh`): Automates the entire process
4. **SystemEval JSON**: Standardized format for MCP agent consumption

## Installation

### Prerequisites

- Python 3.7+
- Node.js 18.0+
- Git (for branch/commit metadata)

### Setup

No installation required. The integration is included in the EscapeKit MCP repository.

## Usage

### Run SystemEval

```bash
# Using npm script
npm run test:systemeval

# Or directly
bash .comate/systemeval/run-systemeval.sh
```

### Output Files

The integration generates two output files:

1. **Vitest JSON**: `.comate/systemeval/vitest-results.json`
   - Raw Vitest output in JSON format

2. **SystemEval JSON**: `.comate/systemeval/systemeval-results.json`
   - Standardized SystemEval format for MCP agents

## SystemEval JSON Format

### Structure

```json
{
  "execution": {
    "uuid": "unique-execution-id",
    "timestamp": "2026-03-15T17:30:25.112150Z",
    "branch": "master",
    "commit": "29c8fcf981127eaf23fb070fc76f76a692fbc6f8",
    "environment": "development"
  },
  "summary": {
    "total": 700,
    "passed": 696,
    "failed": 0,
    "skipped": 4,
    "duration": 25016
  },
  "test_files": [
    {
      "name": "/path/to/test.file.ts",
      "duration": 60,
      "tests": [
        {
          "name": "should pass",
          "status": "passed",
          "duration": 10,
          "verdict": "PASS"
        }
      ]
    }
  ],
  "verdict": "PASS"
}
```

### Fields

#### Execution Metadata

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Unique execution identifier (UUID v4) |
| `timestamp` | string | ISO 8601 timestamp in UTC |
| `branch` | string | Git branch name |
| `commit` | string | Git commit hash |
| `environment` | string | Environment (development, production, etc.) |

#### Summary

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total number of tests |
| `passed` | integer | Number of passed tests |
| `failed` | integer | Number of failed tests |
| `skipped` | integer | Number of skipped tests |
| `duration` | integer | Total duration in milliseconds |

#### Test File

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | File path |
| `duration` | integer | Total duration in milliseconds |
| `tests` | array | Array of test results |

#### Test

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Test name |
| `status` | string | Test status (passed, failed, skipped, pending) |
| `duration` | integer | Duration in milliseconds |
| `verdict` | string | SystemEval verdict (PASS, FAIL, SKIP, ERROR) |
| `error` | object | Error details (only for failed tests) |

#### Error

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Error message |
| `stack` | string | Stack trace |
| `diff` | object | Assertion diff (if available) |

#### Verdict

| Value | Description |
|-------|-------------|
| `PASS` | All tests passed |
| `FAIL` | One or more tests failed |
| `SKIP` | All tests skipped |
| `ERROR` | No tests or execution error |

## Consumption by MCP Agents

### Example: Parse SystemEval Results

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

interface SystemEvalResults {
  execution: {
    uuid: string;
    timestamp: string;
    branch: string;
    commit: string;
    environment: string;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  test_files: Array<{
    name: string;
    duration: number;
    tests: Array<{
      name: string;
      status: string;
      duration: number;
      verdict: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
      error?: object;
    }>;
  }>;
  verdict: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
}

// Read SystemEval results
const resultsPath = join(process.cwd(), '.comate/systemeval/systemeval-results.json');
const results: SystemEvalResults = JSON.parse(readFileSync(resultsPath, 'utf-8'));

// Use results
console.log(`Verdict: ${results.verdict}`);
console.log(`Passed: ${results.summary.passed}/${results.summary.total}`);
console.log(`Execution ID: ${results.execution.uuid}`);

// Filter failed tests
const failedTests = results.test_files
  .flatMap(file => file.tests)
  .filter(test => test.verdict === 'FAIL');

if (failedTests.length > 0) {
  console.log('Failed tests:');
  failedTests.forEach(test => console.log(`  - ${test.name}`));
}
```

### Example: Consume with jq

```bash
# Get verdict
jq -r '.verdict' .comate/systemeval/systemeval-results.json

# Get summary
jq '.summary' .comate/systemeval/systemeval-results.json

# Get failed tests
jq '.test_files[].tests[] | select(.verdict == "FAIL") | .name' \
  .comate/systemeval/systemeval-results.json

# Get execution metadata
jq '.execution' .comate/systemeval/systemeval-results.json

# Count failed tests
jq '[.test_files[].tests[] | select(.verdict == "FAIL")] | length' \
  .comate/systemeval/systemeval-results.json
```

## Verdict Determination

The overall verdict is determined by the following rules:

1. **FAIL**: If any test failed
2. **ERROR**: If no tests were executed
3. **SKIP**: If all tests were skipped
4. **PASS**: Otherwise (all tests passed)

This ensures deterministic veredicts that can be consumed by MCP agents.

## Integration with CI/CD

### GitHub Actions

```yaml
name: Test with SystemEval

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - run: npm ci
      - run: npm run test:systemeval
      
      - name: Upload SystemEval Results
        uses: actions/upload-artifact@v3
        with:
          name: systemeval-results
          path: .comate/systemeval/systemeval-results.json
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh 'npm ci'
                sh 'npm run test:systemeval'
            }
        }
        stage('Archive Results') {
            steps {
                archiveArtifacts artifacts: '.comate/systemeval/systemeval-results.json'
            }
        }
    }
}
```

## Troubleshooting

### Issue: "python3 is not installed"

**Solution**: Install Python 3.7+

```bash
# Ubuntu/Debian
sudo apt-get install python3 python3-pip

# macOS
brew install python3

# Windows
# Download from https://www.python.org/
```

### Issue: "Vitest JSON file not found"

**Solution**: Ensure Vitest runs successfully and generates JSON output.

```bash
# Run Vitest manually
npx vitest run --reporter=json --outputFile=.comate/systemeval/vitest-results.json
```

### Issue: "No test files found"

**Solution**: Ensure test files exist and match Vitest configuration.

```bash
# List test files
find tests -name "*.test.ts"

# Run Vitest with verbose output
npx vitest run --reporter=verbose
```

## Performance

### Baseline Metrics

- **Test Suite Size**: 700 tests
- **Execution Time**: ~25 seconds
- **JSON Generation**: < 1 second
- **Adapter Parsing**: < 1 second
- **Total Overhead**: ~2 seconds (~8% of total execution time)

### Optimization Tips

1. **Parallel Execution**: Use Vitest's parallel mode for faster execution
2. **Selective Testing**: Run only relevant tests for faster feedback
3. **Caching**: Enable Vitest caching for faster subsequent runs

## Contributing

To contribute to the SystemEval integration:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run test:systemeval`
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- GitHub Issues: https://github.com/escapekit/escapekit-mcp/issues
- Documentation: https://github.com/escapekit/escapekit-mcp#readme
