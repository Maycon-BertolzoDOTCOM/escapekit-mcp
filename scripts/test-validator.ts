<![import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ValidationResult {
  total: number;
  passed: number;
  failed: number;
  successRate: number;
  errors: string[];
  warnings: string[];
}

export class TestValidator {
  async validate(testFiles: string[]): Promise<ValidationResult> {
    const results: ValidationResult = {
      total: testFiles.length,
      passed: 0,
      failed: 0,
      successRate: 0,
      errors: [],
      warnings: []
    };

    for (const testFile of testFiles) {
      try {
        // First check syntax
        await this.validateSyntax(testFile);
        
        // Then run tests
        await execAsync(`npx vitest run ${testFile} --reporter=verbose`, {
          timeout: 60000 // 60 second timeout
        });
        results.passed++;
      } catch (error: any) {
        results.failed++;
        const errorMsg = `${testFile}: ${error.message}`;
        results.errors.push(errorMsg);
        
        // Check if it's a syntax error vs test failure
        if (error.stderr && error.stderr.includes('Unexpected token')) {
          results.warnings.push(`Syntax error in ${testFile}`);
        }
      }
    }

    if (results.total > 0) {
      results.successRate = (results.passed / results.total) * 100;
    }

    return results;
  }

  async validateSyntax(testCode: string): Promise<boolean> {
    try {
      await execAsync('npx tsc --noEmit --stdin', {
        input: testCode
      });
      return true;
    } catch {
      return false;
    }
  }

  async validateFile(testFilePath: string): Promise<boolean> {
    try {
      const code = await fs.readFile(testFilePath, 'utf-8');
      return await this.validateSyntax(code);
    } catch {
      return false;
    }
  }

  async runSingleTest(testFilePath: string): Promise<{
    passed: boolean;
    output: string;
  }> {
    try {
      const { stdout, stderr } = await execAsync(
        `npx vitest run ${testFilePath} --reporter=verbose`,
        { timeout: 60000 }
      );
      
      return {
        passed: true,
        output: stdout || stderr
      };
    } catch (error: any) {
      return {
        passed: false,
        output: error.stderr || error.stdout || error.message
      };
    }
  }
}
