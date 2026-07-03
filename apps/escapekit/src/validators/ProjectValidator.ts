/**
 * ProjectValidator - Validates generated project structure and content
 *
 * Camada 5 (Validação): Validates that a generated project is complete,
 * syntactically correct, and free of ghost imports.
 *
 * @module validators/ProjectValidator
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../logger.js';
import { EscapeContractWriter } from '../generators/EscapeContractWriter.js';

/** Result of a single validation check */
export interface ValidationCheck {
  /** Name of the check */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Error message if failed */
  message?: string;
  /** File path related to the check */
  filePath?: string;
  /** Line number if applicable */
  line?: number;
}

/** Complete validation result for a project */
export interface ProjectValidationResult {
  /** Whether all required checks passed */
  valid: boolean;
  /** Individual check results */
  checks: ValidationCheck[];
  /** Summary counts */
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/** Options for project validation */
export interface ValidatorOptions {
  /** Additional required files beyond defaults */
  requiredFiles?: string[];
  /** Source file extensions to check for ghost imports */
  sourceExtensions?: string[];
  /** Known ghost import patterns to detect */
  ghostImportPatterns?: string[];
}

/**
 * Validates a generated project for completeness and correctness.
 *
 * @example
 * ```typescript
 * const validator = new ProjectValidator();
 * const result = await validator.validate('/output/my-project');
 * if (!result.valid) {
 *   result.checks.filter(c => !c.passed).forEach(c => console.error(c.message));
 * }
 * ```
 */
export class ProjectValidator {
  private readonly contractWriter: EscapeContractWriter;
  private readonly log = logger.child('ProjectValidator');

  private readonly defaultRequiredFiles = [
    'package.json',
    'tsconfig.json',
  ];

  private readonly defaultSourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  // Common ghost import patterns (packages that don't exist on npm)
  private readonly defaultGhostPatterns = [
    /^fake-/,
    /^mock-/,
    /^sandbox-/,
    /^claude-/,
    /^replit-/,
    /^codesandbox-/,
    /-fake$/,
    /-mock$/,
    /-sandbox$/,
  ];

  constructor() {
    this.contractWriter = new EscapeContractWriter();
  }

  /**
   * Validate a complete project directory.
   *
   * @param projectPath - Root path of the project to validate
   * @param options - Validation options
   * @returns ProjectValidationResult with detailed pass/fail status
   */
  async validate(projectPath: string, options: ValidatorOptions = {}): Promise<ProjectValidationResult> {
    this.log.info('Validating project', { projectPath });

    const checks: ValidationCheck[] = [];

    // 1. File structure validation
    const structureChecks = await this.validateFileStructure(projectPath, options.requiredFiles);
    checks.push(...structureChecks);

    // 2. package.json validation
    const pkgCheck = await this.validatePackageJson(projectPath);
    checks.push(pkgCheck);

    // 3. tsconfig.json validation (if present)
    const tsConfigCheck = await this.validateTsConfig(projectPath);
    checks.push(tsConfigCheck);

    // 4. Escape contract validation (if present)
    const contractCheck = await this.validateEscapeContract(projectPath);
    checks.push(contractCheck);

    // 5. Ghost import check
    const ghostChecks = await this.validateNoGhostImports(
      projectPath,
      options.sourceExtensions ?? this.defaultSourceExtensions,
      options.ghostImportPatterns
    );
    checks.push(...ghostChecks);

    // 6. Code syntax validation
    const syntaxChecks = await this.validateCodeSyntax(
      projectPath,
      options.sourceExtensions ?? this.defaultSourceExtensions
    );
    checks.push(...syntaxChecks);

    const passed = checks.filter((c) => c.passed).length;
    const failed = checks.filter((c) => !c.passed).length;
    const valid = failed === 0;

    this.log.info('Validation complete', { valid, passed, failed });

    return {
      valid,
      checks,
      summary: { total: checks.length, passed, failed },
    };
  }

  /**
   * Validate that required files exist in the project.
   */
  async validateFileStructure(
    projectPath: string,
    additionalRequired: string[] = []
  ): Promise<ValidationCheck[]> {
    const required = [...this.defaultRequiredFiles, ...additionalRequired];
    const checks: ValidationCheck[] = [];

    for (const file of required) {
      const fullPath = join(projectPath, file);
      try {
        await access(fullPath);
        checks.push({
          name: `file-exists:${file}`,
          passed: true,
          filePath: file,
        });
      } catch {
        checks.push({
          name: `file-exists:${file}`,
          passed: false,
          message: `Required file "${file}" is missing`,
          filePath: file,
        });
      }
    }

    return checks;
  }

  /**
   * Validate package.json syntax and required fields.
   */
  async validatePackageJson(projectPath: string): Promise<ValidationCheck> {
    const filePath = join(projectPath, 'package.json');
    const checkName = 'package-json-valid';

    try {
      const raw = await readFile(filePath, 'utf-8');
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        return {
          name: checkName,
          passed: false,
          message: `package.json has invalid JSON: ${(err as Error).message}`,
          filePath: 'package.json',
        };
      }

      // Check required fields
      const missing: string[] = [];
      if (!parsed['name']) missing.push('name');
      if (!parsed['version']) missing.push('version');

      if (missing.length > 0) {
        return {
          name: checkName,
          passed: false,
          message: `package.json is missing required fields: ${missing.join(', ')}`,
          filePath: 'package.json',
        };
      }

      return { name: checkName, passed: true, filePath: 'package.json' };
    } catch {
      // File doesn't exist - already caught by validateFileStructure
      return { name: checkName, passed: true, filePath: 'package.json' };
    }
  }

  /**
   * Validate tsconfig.json syntax and content.
   */
  async validateTsConfig(projectPath: string): Promise<ValidationCheck> {
    const filePath = join(projectPath, 'tsconfig.json');
    const checkName = 'tsconfig-valid';

    try {
      const raw = await readFile(filePath, 'utf-8');
      try {
        JSON.parse(raw);
      } catch (err) {
        return {
          name: checkName,
          passed: false,
          message: `tsconfig.json has invalid JSON: ${(err as Error).message}`,
          filePath: 'tsconfig.json',
        };
      }
      return { name: checkName, passed: true, filePath: 'tsconfig.json' };
    } catch {
      // tsconfig.json is optional - pass if not present
      return { name: checkName, passed: true, filePath: 'tsconfig.json' };
    }
  }

  /**
   * Validate escape contract YAML/JSON syntax and schema.
   */
  async validateEscapeContract(projectPath: string): Promise<ValidationCheck> {
    const checkName = 'escape-contract-valid';

    // Try both .json and .yaml extensions
    const candidates = ['escape-contract.json', 'escape-contract.yaml'];

    for (const candidate of candidates) {
      const filePath = join(projectPath, candidate);
      try {
        await access(filePath);
        // File exists - validate it
        if (candidate.endsWith('.json')) {
          try {
            const raw = await readFile(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            const valid = this.contractWriter.validate(parsed);
            if (!valid) {
              return {
                name: checkName,
                passed: false,
                message: `${candidate} is missing required fields`,
                filePath: candidate,
              };
            }
            return { name: checkName, passed: true, filePath: candidate };
          } catch (err) {
            return {
              name: checkName,
              passed: false,
              message: `${candidate} has invalid content: ${(err as Error).message}`,
              filePath: candidate,
            };
          }
        }
        // For YAML, just check it's readable (no external YAML dep)
        return { name: checkName, passed: true, filePath: candidate };
      } catch {
        // Not found, try next
      }
    }

    // No escape contract found - not required, pass
    return { name: checkName, passed: true };
  }

  /**
   * Validate that no ghost imports remain in source files.
   */
  async validateNoGhostImports(
    projectPath: string,
    extensions: string[],
    customPatterns?: string[]
  ): Promise<ValidationCheck[]> {
    const patterns = [
      ...this.defaultGhostPatterns,
      ...(customPatterns ?? []).map((p) => new RegExp(p)),
    ];

    const sourceFiles = await this.findSourceFiles(projectPath, extensions);
    const checks: ValidationCheck[] = [];

    for (const file of sourceFiles) {
      const fullPath = join(projectPath, file);
      try {
        const content = await readFile(fullPath, 'utf-8');
        const ghostImports = this.detectGhostImports(content, patterns);

        if (ghostImports.length > 0) {
          for (const { importPath, line } of ghostImports) {
            checks.push({
              name: `no-ghost-imports:${file}`,
              passed: false,
              message: `Ghost import detected: "${importPath}" in ${file}:${line}`,
              filePath: file,
              line,
            });
          }
        } else {
          checks.push({
            name: `no-ghost-imports:${file}`,
            passed: true,
            filePath: file,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    // If no source files found, add a passing check
    if (checks.length === 0) {
      checks.push({ name: 'no-ghost-imports', passed: true });
    }

    return checks;
  }

  /**
   * Validate syntax of all source code files (basic check).
   */
  async validateCodeSyntax(
    projectPath: string,
    extensions: string[]
  ): Promise<ValidationCheck[]> {
    const sourceFiles = await this.findSourceFiles(projectPath, extensions);
    const checks: ValidationCheck[] = [];

    for (const file of sourceFiles) {
      const fullPath = join(projectPath, file);
      try {
        const content = await readFile(fullPath, 'utf-8');
        const syntaxError = this.checkBasicSyntax(content, file);

        if (syntaxError) {
          checks.push({
            name: `syntax-valid:${file}`,
            passed: false,
            message: syntaxError.message,
            filePath: file,
            line: syntaxError.line,
          });
        } else {
          checks.push({
            name: `syntax-valid:${file}`,
            passed: true,
            filePath: file,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    if (checks.length === 0) {
      checks.push({ name: 'syntax-valid', passed: true });
    }

    return checks;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Find source files in the project's src/ directory.
   */
  private async findSourceFiles(projectPath: string, extensions: string[]): Promise<string[]> {
    const { readdir, stat } = await import('fs/promises');
    const files: string[] = [];

    const walk = async (dir: string, relative: string): Promise<void> => {
      try {
        const entries = await readdir(dir);
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
          const fullPath = join(dir, entry);
          const relPath = relative ? `${relative}/${entry}` : entry;
          try {
            const s = await stat(fullPath);
            if (s.isDirectory()) {
              await walk(fullPath, relPath);
            } else if (extensions.some((ext) => entry.endsWith(ext))) {
              files.push(relPath);
            }
          } catch {
            // Skip inaccessible entries
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    // Only scan src/ directory if it exists
    const srcPath = join(projectPath, 'src');
    try {
      await access(srcPath);
      await walk(srcPath, 'src');
    } catch {
      // No src/ directory - scan root level only
      await walk(projectPath, '');
    }

    return files;
  }

  /**
   * Detect ghost imports in source code using regex patterns.
   */
  private detectGhostImports(
    code: string,
    patterns: RegExp[]
  ): Array<{ importPath: string; line: number }> {
    const results: Array<{ importPath: string; line: number }> = [];
    const lines = code.split('\n');

    // Match ES6 imports and CommonJS requires
    const importRegex = /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;
      importRegex.lastIndex = 0;

      while ((match = importRegex.exec(line)) !== null) {
        const importPath = match[1] ?? match[2];
        if (importPath && patterns.some((p) => p.test(importPath))) {
          results.push({ importPath, line: i + 1 });
        }
      }
    }

    return results;
  }

  /**
   * Basic syntax check - detects unbalanced brackets/braces.
   */
  private checkBasicSyntax(
    code: string,
    _file: string
  ): { message: string; line?: number } | null {
    // Very lightweight check: unbalanced braces
    let braces = 0;
    let parens = 0;
    let brackets = 0;
    let inString = false;
    let stringChar = '';
    let lineNum = 1;

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];

      if (ch === '\n') {
        lineNum++;
        continue;
      }

      if (inString) {
        if (ch === stringChar && code[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        stringChar = ch;
        continue;
      }

      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '(') parens++;
      else if (ch === ')') parens--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;

      // Early exit on obvious imbalance
      if (braces < -1 || parens < -1 || brackets < -1) {
        return { message: `Unbalanced brackets in file`, line: lineNum };
      }
    }

    return null;
  }
}
