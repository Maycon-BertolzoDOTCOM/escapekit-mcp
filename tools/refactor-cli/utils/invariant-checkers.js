/**
 * Sistema de validação de invariantes sistêmicos
 * Princípios: autoconsistência, transitividade, idempotência, reversibilidade, traceabilidade
 */

import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import chalk from 'chalk';

class InvariantChecker {
  constructor(config = {}) {
    this.config = {
      projectRoot: process.cwd(),
      allowedImportPatterns: [],
      forbiddenImportPatterns: [],
      buildTargets: ['es2015', 'commonjs'],
      dependencyRules: {
        circularDeps: false,
        unusedDeps: true,
        missingDeps: true
      },
      ...config
    };
    
    this.violations = [];
    this.autoFixEnabled = false;
  }

  /** Validar autoconsistência: compilação sem erros */
  async validateCompilation() {
    const results = [];
    
    try {
      // Verificar TypeScript
      const tscResult = await execa('npx', ['tsc', '--noEmit'], {
        cwd: this.config.projectRoot,
        reject: false
      });
      
      if (tscResult.exitCode !== 0) {
        results.push({
          type: 'compilation',
          severity: 'error',
          message: 'Falha na compilação TypeScript',
          details: tscResult.stderr,
          fixable: false
        });
      }
      
      // Validar ES modules (se aplicável)
      const packageJson = await this.readPackageJson();
      if (packageJson?.type === 'module') {
        const esmResult = await this.validateESModules();
        results.push(...esmResult);
      }
      
    } catch (error) {
      results.push({
        type: 'compilation',
        severity: 'error',
        message: 'Erro ao validar compilação',
        details: error.message,
        fixable: false
      });
    }
    
    return results;
  }

  /** Validar imports e dependências */
  async validateImportsAndDeps() {
    const results = [];
    
    // Verificar dependências circulares
    if (this.config.dependencyRules.circularDeps) {
      results.push(...await this.findCircularDeps());
    }
    
    // Verificar dependências não utilizadas
    if (this.config.dependencyRules.unusedDeps) {
      results.push(...await this.findUnusedDeps());
    }
    
    // Verificar dependências ausentes
    if (this.config.dependencyRules.missingDeps) {
      results.push(...await this.findMissingDeps());
    }
    
    // Validar padrões de importação
    results.push(...await this.validateImportPatterns());
    
    return results;
  }

  /** Sistema de invariantes configuráveis */
  async configureProjectInvariants() {
    const configPath = path.join(this.config.projectRoot, '.invariants.json');
    
    const defaultInvariants = {
      compilation: {
        required: true,
        autoFix: false
      },
      imports: {
        allowedPatterns: this.config.allowedImportPatterns,
        forbiddenPatterns: this.config.forbiddenImportPatterns,
        autoFix: true
      },
      dependencies: {
        circularDeps: false,
        unusedDeps: true,
        missingDeps: true,
        autoFix: true
      }
    };
    
    if (!await fs.pathExists(configPath)) {
      await fs.writeJson(configPath, defaultInvariants, { spaces: 2 });
    }
    
    return await fs.readJson(configPath);
  }

  /** Mecanismo de auto-reparo */
  async autoFixViolations(violations) {
    if (!this.autoFixEnabled) return violations;
    
    const remainingViolations = [];
    
    for (const violation of violations) {
      if (violation.fixable && await this.applyFix(violation)) {
        console.log(chalk.green(`✓ Auto-fix aplicado: ${violation.message}`));
      } else {
        remainingViolations.push(violation);
      }
    }
    
    return remainingViolations;
  }

  // ===== MÉTODOS PRIVADOS =====

  async validateESModules() {
    const results = [];
    
    try {
      // Verificar se todos os arquivos .js usam imports ES
      const jsFiles = await this.findFiles('**/*.js');
      
      for (const file of jsFiles) {
        const content = await fs.readFile(file, 'utf8');
        if (content.includes('require(') && content.includes('module.exports')) {
          results.push({
            type: 'es-modules',
            severity: 'warning',
            message: `Arquivo usa CommonJS em projeto ES modules: ${file}`,
            details: 'Converter require para import e module.exports para export',
            fixable: true,
            filePath: file
          });
        }
      }
    } catch (error) {
      results.push({
        type: 'es-modules',
        severity: 'error',
        message: 'Erro ao validar ES modules',
        details: error.message,
        fixable: false
      });
    }
    
    return results;
  }

  async findCircularDeps() {
    // Implementação simplificada - usar depcheck ou similar em produção
    const results = [];
    // TODO: Implementar detecção de dependências circulares
    return results;
  }

  async findUnusedDeps() {
    const results = [];
    
    try {
      const packageJson = await this.readPackageJson();
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // TODO: Implementar detecção de dependências não utilizadas
      // Usar depcheck ou análise AST em produção
      
    } catch (error) {
      results.push({
        type: 'unused-deps',
        severity: 'error',
        message: 'Erro ao verificar dependências não utilizadas',
        details: error.message,
        fixable: false
      });
    }
    
    return results;
  }

  async findMissingDeps() {
    const results = [];
    
    try {
      const packageJson = await this.readPackageJson();
      const tsFiles = await this.findFiles('**/*.ts');
      const jsFiles = await this.findFiles('**/*.js');
      const allFiles = [...tsFiles, ...jsFiles];
      
      // Analisar imports nos arquivos e verificar se estão em package.json
      // Implementação simplificada
      
    } catch (error) {
      results.push({
        type: 'missing-deps',
        severity: 'error',
        message: 'Erro ao verificar dependências ausentes',
        details: error.message,
        fixable: false
      });
    }
    
    return results;
  }

  async validateImportPatterns() {
    const results = [];
    
    try {
      const tsFiles = await this.findFiles('**/*.ts');
      const jsFiles = await this.findFiles('**/*.js');
      const allFiles = [...tsFiles, ...jsFiles];
      
      for (const file of allFiles) {
        const content = await fs.readFile(file, 'utf8');
        const importLines = content.match(/(import|require).*['"].*['"]/g) || [];
        
        for (const importLine of importLines) {
          const importedPath = importLine.match(/['"]([^'"]+)['"]/)?.[1];
          if (importedPath) {
            // Verificar padrões proibidos
            for (const pattern of this.config.forbiddenImportPatterns) {
              if (new RegExp(pattern).test(importedPath)) {
                results.push({
                  type: 'import-patterns',
                  severity: 'error',
                  message: `Importação proibida: ${importedPath}`,
                  details: `Padrão proibido: ${pattern} em ${file}`,
                  fixable: false,
                  filePath: file
                });
              }
            }
          }
        }
      }
    } catch (error) {
      results.push({
        type: 'import-patterns',
        severity: 'error',
        message: 'Erro ao validar padrões de importação',
        details: error.message,
        fixable: false
      });
    }
    
    return results;
  }

  async applyFix(violation) {
    try {
      switch (violation.type) {
        case 'es-modules':
          return await this.fixCommonJS(violation.filePath);
        default:
          return false;
      }
    } catch (error) {
      console.error(chalk.red(`Erro no auto-fix: ${error.message}`));
      return false;
    }
  }

  async fixCommonJS(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Conversão simples: require → import, module.exports → export
    let fixed = content
      .replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g, 'import $1 from "$2"')
      .replace(/module\.exports\s*=\s*(\w+)/g, 'export default $1')
      .replace(/module\.exports\.(\w+)\s*=\s*(.+)/g, 'export const $1 = $2')
      .replace(/module\.exports\s*=\s*\{([^}]+)\}/g, (match, exports) => {
        const props = exports.split(',').map(prop => {
          const [key, value] = prop.split(':').map(s => s.trim());
          return `export const ${key} = ${value}`;
        });
        return props.join('\n');
      });
    
    await fs.writeFile(filePath, fixed);
    return true;
  }

  async findFiles(pattern) {
    try {
      return await glob.glob(pattern, { cwd: this.config.projectRoot });
    } catch (error) {
      return [];
    }
  }

  async readPackageJson() {
    const packagePath = path.join(this.config.projectRoot, 'package.json');
    if (await fs.pathExists(packagePath)) {
      return await fs.readJson(packagePath);
    }
    return null;
  }
}

export default InvariantChecker;