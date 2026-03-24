#!/usr/bin/env node

/**
 * EscapeKit CLI
 *
 * Command-line interface for EscapeKit MCP tools
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { dirname, join } from 'path';
import { CodeAnalyzer } from '../analyzers/CodeAnalyzer.js';
import { LockFileParser } from '../security/LockFileParser.js';
import { RateLimiter } from '../ratelimit/RateLimiter.js';
import { PatternMatcher } from '../security/PatternMatcher.js';
import { RiskScorer } from '../security/RiskScorer.js';
import { IssueGenerator } from '../security/IssueGenerator.js';
import { PackageJsonParser } from '../security/PackageJsonParser.js';
import { PostInstallDetector } from '../security/PostInstallDetector.js';
import { DeepDependencyScanner } from '../security/DeepDependencyScanner.js';
import { NPMRegistry } from '../services/NPMRegistry.js';

const program = new Command();

program
  .name('escapekit')
  .description(
    'EscapeKit: Breaking Ralph Loop Inverso - Transform AI sandbox code into production-ready projects'
  )
  .version('0.1.0');

/**
 * Analyze command
 */
program
  .command('analyze')
  .description('Analyze AI-generated code to identify sandbox dependencies and issues')
  .argument('[file]', 'Path to file to analyze')
  .option('--code <string>', 'Code string to analyze (alternative to file)')
  .option('--from <sandbox>', 'Source sandbox type (ai-studio, bolt, replit)')
  .option('--to <platform>', 'Target platform (nextjs, vercel, node)')
  .option('--json', 'Output results as JSON')
  .option('--deep-scan', 'Enable transitive dependency analysis')
  .option('--max-depth <n>', 'Maximum dependency depth to analyze (default: 3)', '3')
  .option('--recommend', 'Show recommendations for detected issues', true)
  .option('--recommend-only', 'Show only recommendations, hide analysis')
  .action(async (file, options) => {
    try {
      let code: string;

      if (options.code) {
        code = options.code;
      } else if (file) {
        const filePath = resolve(file);
        if (!existsSync(filePath)) {
          console.error(`Error: File not found: ${filePath}`);
          process.exit(1);
        }
        code = readFileSync(filePath, 'utf-8');
      } else {
        // Read from stdin
        code = await readStdin();
      }

      if (!code || code.trim().length === 0) {
        console.error(
          'Error: No code provided. Use --code, specify a file, or pipe code via stdin.'
        );
        process.exit(1);
      }

      // Analyze code
      const analyzer = new CodeAnalyzer();
      const result = await analyzer.analyze(code, {
        sandboxType: options.from,
        language: 'javascript',
        checkNPMRegistry: true,
      });

      console.log('🔍 Analyzing code...');
      console.log(`   Analysis ID: ${result.analysisId}`);
      console.log(`   Sandbox: ${result.sandboxType || 'auto-detected'}`);
      console.log(`   Language: ${result.language}`);

      console.log('\n✅ Analysis complete!');
      console.log('\nSummary:');
      console.log(`   Total Issues: ${result.summary.totalIssues}`);
      console.log(`   Ghost Imports: ${result.summary.ghostImports}`);
      console.log(`   Mock APIs: ${result.summary.mockApis}`);
      console.log(`   Unrealistic Assumptions: ${result.summary.unrealisticAssumptions}`);
      console.log(`   Security Risks: ${result.summary.securityRisks}`);
      console.log(`   Confidence Score: ${result.confidenceScore.toFixed(2)}`);

      if (result.issues.length > 0) {
        console.log('\nIssues found:');
        for (const issue of result.issues) {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          console.log(`\n  ${icon} [${issue.type.toUpperCase()}] Line ${issue.location.line}`);
          console.log(`     ${issue.message}`);
          if (issue.suggestion) {
            console.log(`     💡 ${issue.suggestion}`);
          }
        }
      }

      // ── Deep dependency scan ───────────────────────────────────────────────
      if (options.deepScan) {
        const baseDir = file ? dirname(resolve(file)) : process.cwd();
        const packageJsonPath = join(baseDir, 'package.json');

        // Locate lockfile — prefer package-lock.json over yarn.lock
        let lockfilePath: string | null = null;
        const npmLock = join(baseDir, 'package-lock.json');
        const yarnLock = join(baseDir, 'yarn.lock');
        if (existsSync(npmLock)) {
          lockfilePath = npmLock;
        } else if (existsSync(yarnLock)) {
          lockfilePath = yarnLock;
        }

        if (lockfilePath === null) {
          console.log('\n⚠️  No lockfile found — running in shallow mode');
        }

        const registry = new NPMRegistry();
        const lockFileParser = new LockFileParser();
        const rateLimiter = new RateLimiter();
        const patternMatcher = new PatternMatcher();
        const riskScorer = new RiskScorer();
        const issueGenerator = new IssueGenerator();
        const packageJsonParser = new PackageJsonParser();
        const postInstallDetector = new PostInstallDetector(
          registry,
          packageJsonParser,
          patternMatcher,
          riskScorer,
          issueGenerator
        );
        const scanner = new DeepDependencyScanner(
          registry,
          lockFileParser,
          patternMatcher,
          riskScorer,
          issueGenerator,
          postInstallDetector,
          rateLimiter
        );

        const deepResult = await scanner.deepScan(packageJsonPath, lockfilePath, {
          mode: 'deep',
          maxDepth: parseInt(options.maxDepth),
        });

        console.log('\n🔒 Deep dependency scan:');
        console.log(`   Transitive deps analyzed: ${deepResult.stats.analyzed}`);
        console.log(`   Cache hits: ${deepResult.stats.cacheHits}`);
        console.log(`   Duration: ${deepResult.stats.durationMs}ms`);

        if (deepResult.issues.length > 0) {
          for (const issue of deepResult.issues) {
            const icon = issue.severity === 'error' ? '❌' : '⚠️';
            console.log(`\n  ${icon} ${issue.message}`);
            if (issue.description) {
              console.log(`     ${issue.description}`);
            }
            if (issue.suggestion) {
              console.log(`     💡 ${issue.suggestion}`);
            }
          }
        } else {
          console.log('   ✅ No suspicious transitive dependencies found');
        }
      }

      if (options.json) {
        console.log('\n' + JSON.stringify(result, null, 2));
      }

      console.log(`\n💡 Next step: escapekit generate ${result.analysisId}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Generate command
 */
program
  .command('generate')
  .description('Generate a portable project based on analysis results')
  .argument('[analysis_file]', 'Path to analysis result JSON file (or use --code to re-analyze)')
  .option('--analysis-id <id>', 'Analysis ID (used with --code to re-analyze)')
  .option('--code <file>', 'Source code file to analyze and generate from')
  .option('--output <dir>', 'Output directory', './escape_output')
  .option('--platform <platform>', 'Target platform (vercel, netlify, docker, local)', 'local')
  .option('--include-docker', 'Include Dockerfile', false)
  .option('--include-ci', 'Include CI/CD configuration', false)
  .option('--escape-json', 'Generate escape.json protocol file', true)
  .option('--no-escape-json', 'Disable escape.json generation')
  .option('--force', 'Force processing of non-autoFixable issues', false)
  .option('--dry-run', 'Preview changes without writing files', false)
  .option('--json', 'Output results as JSON')
  .action(async (analysisFile, options) => {
    try {
      let analysisResult: import('../models/schemas.js').AnalysisResult | null = null;
      let sourceCode = '';

      // ── Load or create AnalysisResult ──────────────────────────────────────
      if (analysisFile) {
        // Load from JSON file
        const filePath = resolve(analysisFile);
        if (!existsSync(filePath)) {
          console.error(`Error: Analysis file not found: ${filePath}`);
          process.exit(1);
        }
        try {
          const raw = readFileSync(filePath, 'utf-8');
          analysisResult = JSON.parse(raw);
        } catch (err) {
          console.error(`Error: Could not parse analysis file: ${(err as Error).message}`);
          process.exit(1);
        }
      } else if (options.code) {
        // Re-analyze from source code file
        const codePath = resolve(options.code);
        if (!existsSync(codePath)) {
          console.error(`Error: Source code file not found: ${codePath}`);
          process.exit(1);
        }
        sourceCode = readFileSync(codePath, 'utf-8');

        console.log('🔍 Analyzing source code...');
        const analyzer = new CodeAnalyzer();
        analysisResult = await analyzer.analyze(sourceCode, {
          language: 'javascript',
          checkNPMRegistry: false, // fast analysis for CLI
        });
        console.log(`   Analysis ID: ${analysisResult.analysisId}`);
        console.log(`   Issues found: ${analysisResult.summary.totalIssues}`);
      } else {
        console.error('Error: Provide an analysis JSON file or use --code <file> to re-analyze.');
        console.error('Example: escapekit generate analysis.json');
        console.error('Example: escapekit generate --code src/app.ts');
        process.exit(1);
      }

      if (!analysisResult) {
        console.error('Error: Could not load or create analysis result.');
        process.exit(1);
      }

      // ── Run generation pipeline ────────────────────────────────────────────
      const { generateEscapeKit } = await import('../tools/generate.js');
      type EscapeKit = import('../models/schemas.js').EscapeKit;

      if (!options.dryRun) {
        console.log('\n🚀 Generating escape kit...');
        console.log(`   Analysis ID: ${analysisResult.analysisId}`);
        console.log(`   Platform: ${options.platform}`);
        console.log(`   Output: ${options.output}`);
        if (options.includeDocker) console.log('   Including Dockerfile');
        if (options.includeCi) console.log('   Including CI/CD workflow');
      } else {
        console.log('\n🔍 Dry run - previewing changes...');
      }

      const response = await generateEscapeKit(
        analysisResult,
        sourceCode,
        options.platform,
        options.output,
        {
          includeDocker: options.includeDocker ?? false,
          includeCI: options.includeCi ?? false,
          force: options.force ?? false,
          dryRun: options.dryRun ?? false,
        }
      );

      if (!response.success || !response.data) {
        const errMsg = response.errors[0]?.message ?? 'Unknown error';
        console.error(`\n❌ Generation failed: ${errMsg}`);
        process.exit(1);
      }

      const kit = response.data as EscapeKit;

      if (options.json) {
        console.log(JSON.stringify(kit, null, 2));
        return;
      }

      if (options.dryRun) {
        console.log('\n✅ Dry run complete - no files written.');
        console.log(`   Ghost imports to resolve: ${kit.summary.ghostImportsResolved}`);
        console.log(`   Dependencies to install: ${kit.summary.dependenciesInstalled}`);
        return;
      }

      console.log('\n✅ Escape kit generated!');
      console.log(`   Escape ID: ${kit.escapeId}`);
      console.log(`   Output: ${kit.outputPath}`);
      console.log(`   Ghost imports resolved: ${kit.summary.ghostImportsResolved}`);
      console.log(`   Dependencies: ${kit.summary.dependenciesInstalled}`);

      if (kit.filesCreated.length > 0) {
        console.log('\nFiles created:');
        kit.filesCreated.slice(0, 10).forEach(f => console.log(`   - ${f}`));
        if (kit.filesCreated.length > 10) {
          console.log(`   ... and ${kit.filesCreated.length - 10} more`);
        }
      }

      console.log('\n💡 Next steps:');
      console.log(`   cd ${kit.outputPath}`);
      console.log('   npm install');
      console.log('   npm run dev');
      console.log(`\n💡 Validate: escapekit validate ${kit.outputPath}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Validate command
 */
program
  .command('validate')
  .description('Validate generated code in real environment')
  .argument('<project_path>', 'Path to project to validate')
  .option('--env <environment>', 'Validation environment (docker, local, both)', 'local')
  .option('--level <level>', 'Validation level (basic, standard, thorough)', 'standard')
  .option('--auto-fix', 'Automatically fix detected issues', false)
  .option('--timeout <ms>', 'Timeout in milliseconds', '300000')
  .option('--json', 'Output results as JSON')
  .option('--quiet', 'Suppress verbose output', false)
  .option('--academic', 'Show academic paper references for each issue', false)
  .action(async (projectPath, options) => {
    try {
      const { resolve } = await import('path');
      const resolvedPath = resolve(projectPath);

      if (!existsSync(resolvedPath)) {
        console.error(`Error: Project path not found: ${resolvedPath}`);
        process.exit(1);
      }

      // Suppress logs when JSON output is requested
      const isJsonMode = options.json || options.quiet;
      const originalWrite = process.stdout.write.bind(process.stdout);

      if (isJsonMode) {
        // Discard stdout during validation to keep JSON clean
        process.stdout.write = () => true;
      }

      const { ValidationEngine } = await import('../validate/ValidationEngine.js');

      const engine = new ValidationEngine();

      const result = await engine.validate(resolvedPath, {
        environment: options.env as 'local' | 'docker' | 'both',
        level: options.level as 'basic' | 'standard' | 'thorough',
        autoFix: options.autoFix ?? false,
        timeout: parseInt(options.timeout),
      });

      // Restore stdout
      process.stdout.write = originalWrite;

      // Task 8.3: Enrich issues with academic references (both JSON and terminal modes)
      if (options.academic) {
        const { KnowledgeBase } = await import('../resolvers/KnowledgeBase.js');
        const { enrichIssues } = await import('../academic/IssueEnricher.js');
        const kb = new KnowledgeBase();
        await kb.loadPaperContracts('knowledge-base/registry.yaml');
        // Cast to schemas.Issue[] for enrichment (structurally compatible)
        type SchemasIssue = import('../models/schemas.js').Issue;
        const enriched = enrichIssues(result.remainingIssues as unknown as SchemasIssue[], kb);
        result.remainingIssues = enriched as unknown as typeof result.remainingIssues;
      }

      if (options.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      }

      // Task 8.1: Display academic references in terminal mode
      if (options.academic && !options.json) {
        type SchemasIssue = import('../models/schemas.js').Issue;
        const enriched = result.remainingIssues as unknown as SchemasIssue[];
        if (enriched.some(i => i.academicReference)) {
          console.log('\n📚 Academic References:');
          for (const issue of enriched) {
            if (issue.academicReference) {
              const ref = issue.academicReference;
              console.log(`  [${issue.type}] 📄 Ref: ${ref.title} (${ref.venue}, ${ref.year}) — Regra ${ref.ruleId}`);
            }
          }
        }
      }

      process.exit(result.canDeploy ? 0 : 1);
    } catch (error) {
      // Restore stdout in case of error
      process.stdout.write = process.stdout.write.bind(process.stdout);
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Audit command
 */
program
  .command('audit')
  .description('Audit an escape.json file and generate a report')
  .option('-f, --file <path>', 'Path to escape.json file', './escape.json')
  .option('--format <format>', 'Output format (markdown, html, json, terminal)', 'terminal')
  .option('--output <path>', 'Output file path')
  .option('--academic', 'Show academic paper references', false)
  .option('--verbose', 'Verbose output', false)
  .action(async (options) => {
    try {
      const { auditCommand } = await import('../commands/audit.js');
      const report = await auditCommand({
        file: options.file,
        format: options.format,
        output: options.output,
        verbose: options.verbose,
        academic: options.academic,
      });
      if (!options.output) {
        console.log(report);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Coverage command
 */
program
  .command('coverage')
  .description('Show academic paper coverage report for knowledge-base contracts')
  .option('--registry <path>', 'Path to registry.yaml', 'knowledge-base/registry.yaml')
  .option('--output <path>', 'Write Markdown report to file')
  .action(async (options) => {
    try {
      const { readFile } = await import('fs/promises');
      const { parse: parseYaml } = await import('yaml');
      const { dirname, join, resolve } = await import('path');
      const { CoverageValidator } = await import('../academic/CoverageValidator.js');
      const { existsSync } = await import('fs');

      const registryPath = resolve(options.registry);
      if (!existsSync(registryPath)) {
        console.error(`Error: Registry not found: ${registryPath}`);
        process.exit(1);
      }

      const registryContent = await readFile(registryPath, 'utf-8');
      const registry = parseYaml(registryContent) as { papers: Array<{ contractFile: string; paperId: string }> };
      const registryDir = dirname(registryPath);

      const contracts = [];
      for (const paper of registry.papers ?? []) {
        const contractPath = join(registryDir, paper.contractFile);
        if (!existsSync(contractPath)) {
          console.warn(`Warning: Contract not found: ${contractPath}`);
          continue;
        }
        const content = await readFile(contractPath, 'utf-8');
        const contract = parseYaml(content) as import('../models/academic.js').ContratoYAML;
        // Attach paperId via metadata for CoverageValidator
        contract.metadata = { ...contract.metadata, paperId: paper.paperId, contractFile: paper.contractFile };
        contracts.push(contract);
      }

      const validator = new CoverageValidator();
      const report = validator.validate(contracts);

      console.log(validator.formatReport(report));

      if (options.output) {
        const { writeFile } = await import('fs/promises');
        await writeFile(resolve(options.output), validator.formatMarkdown(report), 'utf-8');
        console.log(`\n✅ Markdown report written to: ${options.output}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Monitor command (future feature)
 */
program
  .command('monitor')
  .description('Monitor production deployment (Enterprise feature - coming soon)')
  .argument('<production_url>', 'Production URL to monitor')
  .option('--kit-id <id>', 'Escape Kit ID')
  .action((url, options) => {
    console.log('📊 Monitor command is coming soon in Enterprise edition!');
    console.log(`   URL: ${url}`);
    if (options.kitId) {
      console.log(`   Kit ID: ${options.kitId}`);
    }
    console.log('\nSign up at https://escapekit.dev/enterprise for early access.');
  });

/**
 * Read from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', reject);
  });
}

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
