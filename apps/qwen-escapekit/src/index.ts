#!/usr/bin/env node
/**
 * qwen-escapekit - CLI para automatizar fluxo de Paper para Contrato Factual
 * 
 * @packageDocumentation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lê versão do package.json
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('qwen-escapekit')
  .description(chalk.cyan('CLI para automatizar fluxo de Paper para Contrato Factual no EscapeKit'))
  .version(packageJson.version, '-v, --version', 'Mostra a versão da CLI');

// Comando principal: paper
program
  .command('paper <source>')
  .description('Processa um paper acadêmico e gera um contrato factual YAML')
  .argument('<source>', 'DOI, URL (arXiv, DOI.org), ou caminho para PDF local')
  .option('-o, --output <diretório>', 'Diretório de saída do contrato YAML', './knowledge-base/')
  .option('-m, --model <nome>', 'Modelo Qwen para usar (ex: qwen2.5:latest, qwen2.5:7b)')
  .option('--generate-boilerplate', 'Gera esqueleto do detector em src/security/', false)
  .option('--no-validate', 'Pula validação do contrato gerado', true)
  .option('--interactive', 'Modo interativo para revisar contrato antes de salvar', false)
  .option('--ollama-url <url>', 'URL do servidor Ollama', 'http://localhost:11434')
  .action(async (source, options) => {
    try {
      const { paperAction } = await import('./commands/paper.js');
      await paperAction(source, options);
    } catch (error) {
      console.error(chalk.red('❌ Erro ao processar paper:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Comando auxiliar: list
program
  .command('list')
  .description('Lista todos os contratos factuais no knowledge-base')
  .option('--implemented', 'Lista apenas contratos implementados')
  .option('--pending', 'Lista apenas contratos pendentes')
  .option('--tag <tag>', 'Filtra por tag específica')
  .option('--json', 'Saída em formato JSON', false)
  .action(async (options) => {
    try {
      const { listAction } = await import('./commands/list.js');
      await listAction(options);
    } catch (error) {
      console.error(chalk.red('❌ Erro ao listar contratos:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Comando auxiliar: implement
program
  .command('implement <citekey>')
  .description('Gera ou atualiza código de detector baseado em contrato factual')
  .argument('<citekey>', 'ID do contrato (nome do arquivo sem .yaml)')
  .option('-o, --output <diretório>', 'Diretório de saída do código', './src/security/')
  .option('--tests', 'Gera também os testes', false)
  .option('--force', 'Sobrescreve arquivos existentes', false)
  .action(async (citekey, options) => {
    try {
      const { implementAction } = await import('./commands/implement.js');
      await implementAction(citekey, options);
    } catch (error) {
      console.error(chalk.red('❌ Erro ao implementar detector:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Comando auxiliar: validate
program
  .command('validate [contract]')
  .description('Valida contrato(s) factual(is)')
  .argument('[contract]', 'Caminho para contrato específico (opcional)')
  .option('--all', 'Valida todos os contratos no knowledge-base', false)
  .option('--strict', 'Modo estrito (falha em qualquer warning)', false)
  .action(async (contract, options) => {
    try {
      const { validateAction } = await import('./commands/validate.js');
      await validateAction(contract, options);
    } catch (error) {
      console.error(chalk.red('❌ Erro na validação:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Comando auxiliar: stats
program
  .command('stats')
  .description('Mostra estatísticas dos contratos factuais')
  .action(async () => {
    try {
      const { statsAction } = await import('./commands/stats.js');
      await statsAction();
    } catch (error) {
      console.error(chalk.red('❌ Erro ao gerar estatísticas:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });


// Comando auxiliar: diff
const diffCommand = program
  .command('diff')
  .description('Manipula diffs unificados (aplicar, gerar, validar)');

diffCommand
  .command('apply <file> <diff>')
  .description('Aplica um diff unificado a um arquivo')
  .option('-f, --fuzzy <number>', 'Threshold de fuzzy matching (0.0-1.0)')
  .option('-b, --backup', 'Criar backup do arquivo original', false)
  .action(async (file, diff, options) => {
    try {
      const { diffApplyAction } = await import('./commands/diff.js');
      await diffApplyAction(file, diff, options);
    } catch (error) {
      console.error(chalk.red('Erro ao aplicar diff:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

diffCommand
  .command('generate <original> <modified>')
  .description('Gera um diff unificado entre dois arquivos')
  .option('-o, --output <file>', 'Caminho de saída do diff', 'diff.patch')
  .action(async (original, modified, options) => {
    try {
      const { diffGenerateAction } = await import('./commands/diff.js');
      await diffGenerateAction(original, modified, options);
    } catch (error) {
      console.error(chalk.red('Erro ao gerar diff:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

diffCommand
  .command('validate <diff>')
  .description('Valida um arquivo de diff')
  .action(async (diff) => {
    try {
      const { diffValidateAction } = await import('./commands/diff.js');
      await diffValidateAction(diff);
    } catch (error) {
      console.error(chalk.red('Erro ao validar diff:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });


// Parse e execução
program.parse(process.argv);

// Mostra ajuda se nenhum comando for fornecido
if (!process.argv.slice(2).length) {
  program.outputHelp(chalk.cyan);
}
