# GitHub Actions Workflows for Audit Reports

EscapeKit includes automated GitHub Actions workflows to generate audit reports on Pull Requests and on-demand.

## 📊 Automated PR Reports

### Workflow: `audit-pr.yml`

This workflow automatically runs on every Pull Request targeting `main` or `develop` branches and comments the audit report on the PR.

### Triggers

- Pull Request opened
- Pull Request synchronized (new commits pushed)
- Pull Request reopened

### What it does

1. **Checks for `escape.json`**: If found, generates reports
2. **Generates two reports**:
   - Markdown report (for PR comment)
   - HTML report with charts (for download as artifact)
3. **Uploads artifacts**: Reports are stored for 30 days
4. **Comments on PR**: Adds or updates a comment with the audit report

### Example PR Comment

```markdown
## 📊 EscapeKit Report

<details>
<summary>Click to expand full report</summary>

# EscapeKit Audit Report
**Generated:** 18/03/2026, 17:34:19
...

</details>

---

*This report was generated automatically by [EscapeKit]*
*📥 Download full reports: [Workflow Artifacts]*
```

### No `escape.json` Found?

If no `escape.json` is found, the workflow will add a helpful comment explaining what `escape.json` is and how to create one.

## 🔧 Manual Report Generation

### Workflow: `audit-manual.yml`

Generate audit reports on-demand for any branch.

### How to Trigger

1. Go to **Actions** tab in GitHub
2. Select **Audit Report (Manual)** workflow
3. Click **Run workflow**
4. Choose options:
   - **Format**: `html`, `markdown`, `terminal`, or `json`
   - **Include Kiwi TCMS Details**: `true` or `false`
   - **Include Charts** (HTML only): `true` or `false`

### Options Explained

| Option | Description | Default |
|--------|-------------|---------|
| `format` | Output format | `html` |
| `include_kiwi_details` | Include Kiwi TCMS integration details | `false` |
| `with_charts` | Include interactive charts (HTML format only) | `true` |

### Accessing the Report

1. Go to the workflow run page
2. Scroll to **Artifacts** section
3. Download `audit-report-{run_id}`
4. OR check the **Summary** section for report content

## 🔐 Permissions

Both workflows require:

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

These permissions are automatically handled by GitHub Actions - no configuration needed.

## 📝 Adding to Your Repository

The workflows are already included in EscapeKit. To enable them in your project:

1. Copy `.github/workflows/audit-pr.yml` to your repository
2. Optionally copy `.github/workflows/audit-manual.yml` for manual reports
3. Ensure `escape.json` exists in your repository root
4. Create a Pull Request - the workflow will automatically run!

## 🎯 Best Practices

### For Open Source Projects

- **Enable PR Reports**: Automatically provides transparency to contributors
- **Use HTML Format**: Professional-looking reports for documentation
- **Include Charts**: Visual representation helps quick understanding

### For Private/Enterprise Projects

- **Enable Kiwi Details**: Connect reports to test management
- **Manual Reports**: Generate on-demand for audits and reviews
- **Archive Reports**: Use artifacts for historical tracking

### For Consulting Engagements

- **HTML + Charts**: High-value deliverables for clients
- **Include Kiwi Details**: Show test coverage and quality metrics
- **Manual Trigger**: Generate reports at milestone reviews

## 🔍 Troubleshooting

### Workflow Not Running

Check workflow triggers:
- Only runs on PRs to `main` or `develop` branches
- Check `.github/workflows/audit-pr.yml` exists in your repository

### No Comment on PR

Check GitHub Actions logs:
- Verify `escape.json` exists at repository root
- Check permissions (should be auto-configured)
- Look for errors in the workflow run

### Report Shows "No escape.json Found"

Create an `escape.json` file:

```bash
npx escapekit-mcp analyze
```

Or create a minimal one:

```json
{
  "$schema": "https://raw.githubusercontent.com/escapekit/escapekit-mcp/main/schemas/escape-json-v1.schema.json",
  "version": "1.0",
  "escapeId": "my-project-001",
  "timestamp": "2026-03-18T17:34:19.000Z",
  "provenance": {
    "sandbox": "unknown",
    "sourceHash": "",
    "files": [],
    "detectedAt": "2026-03-18T17:34:19.000Z"
  },
  "analysis": {
    "analysisId": "my-project-001",
    "analysisAt": "2026-03-18T17:34:19.000Z",
    "escapeKitVersion": "2.0.0",
    "config": {
      "targetPlatform": "unknown",
      "targetRuntime": "node",
      "strictness": "standard",
      "useChineseMirrors": false
    },
    "issues": [],
    "confidenceScore": 0,
    "totalIssues": 0,
    "issueBreakdown": {
      "ghostImports": 0,
      "mockApis": 0,
      "sandboxApis": 0,
      "unrealisticAssumptions": 0,
      "securityRisks": 0,
      "performanceIssues": 0,
      "codeQuality": 0,
      "missingDependencies": 0,
      "versionMismatches": 0,
      "webglFallbacksNeeded": 0
    }
  },
  "transformations": {
    "transformedAt": "2026-03-18T17:34:19.000Z",
    "applied": [],
    "totalTransformations": 0,
    "breakdown": {
      "importReplacements": 0,
      "apiReplacements": 0,
      "polyfillAdditions": 0,
      "fallbackImplementations": 0,
      "versionUpdates": 0,
      "dependencyAdditions": 0,
      "configGenerations": 0,
      "codeRefactorings": 0
    }
  },
  "validations": {
    "validations": [],
    "overallStatus": "pending",
    "totalValidations": 0,
    "passedValidations": 0,
    "failedValidations": 0
  },
  "deployment": {
    "status": "not_deployed"
  },
  "sovereignty": {
    "compliant": false,
    "complianceScore": 0,
    "checkedAt": "2026-03-18T17:34:19.000Z",
    "chineseMirrors": false,
    "offlineCache": false,
    "securityValidation": false,
    "auditLogging": false,
    "packageReplacements": []
  },
  "metadata": {}
}
```

## 📚 Related Documentation

- [EscapeKit Documentation](../../README.md)
- [escape.json Protocol v1.0](../../schemas/escape-json-v1.schema.json)
- [Audit Command Usage](../../README.md#audit-command)
- [Kiwi TCMS Integration](./kiwi-tcms-integration.md)

## 🤝 Contributing

To improve these workflows:

1. Edit `.github/workflows/audit-pr.yml` or `.github/workflows/audit-manual.yml`
2. Test in a fork or feature branch
3. Submit a Pull Request

---

**Need help?** Open an issue on [EscapeKit](https://github.com/escapekit/escapekit-mcp/issues)
