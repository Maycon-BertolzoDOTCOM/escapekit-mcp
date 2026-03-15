# EscapeKit CLI — Usage Examples

## Basic Workflow

```bash
# Step 1: analyze your code
escapekit analyze src/app.ts

# Step 2: generate the escape kit using the analysis JSON
escapekit generate analysis.json --output ./my-project
```

Or combine both steps in one command:

```bash
escapekit generate --code src/app.ts --output ./my-project
```

## generate — All Flags

```bash
escapekit generate [analysis_file]
  --code <file>          # source file to analyze + generate from
  --analysis-id <id>     # analysis ID (informational)
  --output <dir>         # output directory (default: ./escape_output)
  --platform <platform>  # vercel | netlify | docker | local (default: local)
  --include-docker       # add a Dockerfile to the output
  --include-ci           # add .github/workflows/ci.yml
  --force                # process non-autoFixable issues
  --dry-run              # preview changes without writing files
  --json                 # print result as JSON
```

## Examples

```bash
# Target Vercel with Docker and CI
escapekit generate analysis.json \
  --output ./vercel-app \
  --platform vercel \
  --include-docker \
  --include-ci

# Dry run to preview what would be generated
escapekit generate --code src/app.ts --dry-run

# Force-process all issues and output JSON
escapekit generate analysis.json --force --json
```

## Example Output

```
🚀 Generating escape kit...
   Analysis ID: analysis_a1b2c3d4
   Platform: vercel
   Output: ./vercel-app
   Including Dockerfile
   Including CI/CD workflow

✅ Escape kit generated!
   Escape ID: escape_x9y8z7w6
   Output: ./vercel-app/escape_x9y8z7w6
   Ghost imports resolved: 3
   Dependencies: 3

Files created:
   - package.json
   - tsconfig.json
   - src/index.ts
   - Dockerfile
   - .github/workflows/ci.yml
   - escape-contract.json
   ... and 2 more

💡 Next steps:
   cd ./vercel-app/escape_x9y8z7w6
   npm install
   npm run dev

💡 Validate: escapekit validate ./vercel-app/escape_x9y8z7w6
```

## Dry Run Output

```
🔍 Dry run - previewing changes...

✅ Dry run complete - no files written.
   Ghost imports to resolve: 2
   Dependencies to install: 2
```

## Error Handling

```bash
# Missing input
$ escapekit generate
Error: Provide an analysis JSON file or use --code <file> to re-analyze.
Example: escapekit generate analysis.json
Example: escapekit generate --code src/app.ts

# File not found
$ escapekit generate missing.json
Error: Analysis file not found: /path/to/missing.json

# Generation failure (exit code 1)
$ escapekit generate bad-analysis.json
❌ Generation failed: GENERATION_ERROR — <reason>
```

## analyze Command

```bash
escapekit analyze src/app.ts --from ai-studio --to vercel

# Output:
# 🔍 Analyzing code...
#    Analysis ID: analysis_a1b2c3d4
#    Sandbox: ai-studio
#    Language: javascript
#
# ✅ Analysis complete!
# ...
# 💡 Next step: escapekit generate analysis_a1b2c3d4
```
