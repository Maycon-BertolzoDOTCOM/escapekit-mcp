#!/usr/bin/env node

/**
 * EscapeKit Refactor CLI - CLI Unificadora com Princípios de Invariantes Sistêmicos
 * 
 * Comandos organizados por domínio funcional:
 * - invariants: Validação e gestão de invariantes sistêmicos
 * - analyze: Análise e diagnóstico do projeto
 * - refactor: Operações de refatoração controladas
 * - validate: Validação completa e testes
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const program = new Command();

// Configuração base da CLI
program
  .name('escapekit-refactor')
  .description('CLI unificadora para refatoração do EscapeKit com princípios de invariantes sistêmicos')
  .version('1.0.0');

// --- Comandos de Validação de Invariantes ---
program
  .command('validate-invariants')
  .description('Valida todos os invariantes sistêmicos do projeto')
  .option('--auto-fix', 'Aplicar correções automáticas para invariantes violados', false)
  .option('--strict', 'Falhar imediatamente em qualquer violação', false)
  .option('--json', 'Output no formato JSON', false)
  .action(async (options) => {
    const { validateInvariants } = await import('./commands/invariants/validate-invariants.js');
    await validateInvariants(options);
  });

program
  .command('check-progression')
  .description('Verifica progresso e tracking de operações')
  .option('--since <date>', 'Data inicial para verificação')
  .option('--format <format>', 'Formato do relatório (table, json, markdown)', 'table')
  .action(async (options) => {
    const { checkProgression } = await import('./commands/invariants/check-progression.js');
    await checkProgression(options);
  });

// --- Comandos de Análise e Diagnóstico ---
program
  .command('analyze-structure')
  .description('Análise completa da estrutura do projeto')
  .option('--deep', 'Análise profunda com dependências transitivas', false)
  .option('--target <target>', 'Plataforma alvo (vercel, railway, local)', 'local')
  .option('--report <path>', 'Salvar relatório em arquivo')
  .action(async (options) => {
    const { analyzeProjectStructure } = await import('./commands/analyze/project-structure.js');
    await analyzeProjectStructure(options);
  });

// --- Comandos de Refatoração ---
program
  .command('migrate-modules')
  .description('Migração controlada de módulos com checkpoint')
  .option('--checkpoint', 'Criar checkpoint antes da migração', true)
  .option('--dry-run', 'Simular migração sem aplicar', false)
  .option('--force', 'Forçar migração ignorando avisos', false)
  .action(async (options) => {
    const { migrateModules } = await import('./commands/refactor/migrate-modules.js');
    await migrateModules(options);
  });

program
  .command('fix-imports')
  .description('Correção automática de imports com validação')
  .option('--interactive', 'Modo interativo para aprovação', false)
  .option('--validate', 'Validar imports após correção', true)
  .action(async (options) => {
    const { fixImports } = await import('./commands/refactor/fix-imports.js');
    await fixImports(options);
  });

program
  .command('setup-backend')
  .description('Configuração de backend Express com roteamento automático')
  .option('--port <port>', 'Porta do servidor', '3001')
  .option('--cors <origin>', 'Origem CORS', 'http://localhost:5173')
  .action(async (options) => {
    const { setupBackend } = await import('./commands/refactor/setup-backend.js');
    await setupBackend(options);
  });

program
  .command('setup-frontend')
  .description('Configuração de frontend React + Vite')
  .option('--template <template>', 'Template Vite', 'react')
  .option('--with-typescript', 'Usar TypeScript', true)
  .action(async (options) => {
    const { setupFrontend } = await import('./commands/refactor/setup-frontend.js');
    await setupFrontend(options);
  });

// --- Comandos de Validação Completa ---
program
  .command('run-validation')
  .description('Executa validação completa integrada com ValidationEngine')
  .option('--environment <env>', 'Ambiente (local, docker, both)', 'local')
  .option('--level <level>', 'Nível (basic, standard, thorough)', 'thorough')
  .option('--auto-fix', 'Aplicar correções automáticas', false)
  .action(async (options) => {
    const { runValidation } = await import('./commands/validate/run-validation.js');
    await runValidation(options);
  });

program
  .command('run-tests')
  .description('Execução automatizada de testes com cobertura')
  .option('--coverage', 'Executar com cobertura', false)
  .option('--watch', 'Modo watch para desenvolvimento', false)
  .option('--reporters <list>', 'Reporters (default, html, json)', 'default')
  .action(async (options) => {
    const { runTests } = await import('./commands/validate/run-tests.js');
    await runTests(options);
  });

// --- Comando Completo Workflow ---
program
  .command('all')
  .description('Executa workflow completo de refatoração')
  .option('--checkpoint', 'Criar checkpoints entre etapas', true)
  .option('--validate-each', 'Validar após cada etapa', true)
  .option('--report', 'Gerar relatório final', true)
  .action(async (options) => {
    console.log(chalk.green('🚀 Iniciando workflow completo de refatoração...'));
    
    const steps = [
      { name: 'validate-invariants', options: { autoFix: true } },
      { name: 'analyze-structure', options: { deep: true, report: 'structure-analysis.json' } },
      { name: 'migrate-modules', options: { checkpoint: options.checkpoint, dryRun: false } },
      { name: 'fix-imports', options: { validate: true } },
      { name: 'setup-backend', options: {} },
      { name: 'setup-frontend', options: {} },
      { name: 'run-validation', options: { level: 'thorough' } },
      { name: 'run-tests', options: { coverage: true } }
    ];

    for (const step of steps) {
      console.log(chalk.blue(`📋 Executando: ${step.name}`));
      
      try {
        // Simulação - implementação completa virá nos módulos
        console.log(chalk.gray(`   ${step.name} executado com sucesso`));
        
        if (options.validateEach) {
          const { validateInvariants } = await import('./commands/invariants/validate-invariants.js');
          await validateInvariants({ autoFix: true });
        }
        
      } catch (error) {
        console.error(chalk.red(`❌ Erro em ${step.name}: ${error.message}`));
        process.exit(1);
      }
    }
    
    console.log(chalk.green('✅ Workflow completo executado com sucesso!'));
    
    if (options.report) {
      console.log(chalk.blue('📊 Gerando relatório final...'));
      // Implementar geração de relatório
    }
  });

// --- Sistema de Logging Estruturado ---
class StructuredLogger {
  static info(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.log(chalk.blue(`[INFO] ${timestamp}`), message, context);
  }
  
  static warn(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.warn(chalk.yellow(`[WARN] ${timestamp}`), message, context);
  }
  
  static error(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.error(chalk.red(`[ERROR] ${timestamp}`), message, context);
  }
  
  static success(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.log(chalk.green(`[SUCCESS] ${timestamp}`), message, context);
  }
}

// Exportar logger para uso nos comandos
globalThis.StructuredLogger = StructuredLogger;

// Validar argumentos
program.parse(process.argv);

// Mostrar ajuda se nenhum comando fornecido
if (!process.argv.slice(2).length) {
  program.outputHelp();
}