/**
 * Comando: stats
 * Mostra estatísticas dos contratos factuais
 */

import chalk from 'chalk';
import { glob } from 'glob';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

export async function statsAction(): Promise<void> {
  console.log();
  console.log(chalk.green.bold('📊 Qwen EscapeKit - Estatísticas'));
  console.log(chalk.cyan('='.repeat(60)));
  console.log();

  const knowledgeBase = './knowledge-base/';
  const files = await glob(`${knowledgeBase}*.yaml`);

  if (files.length === 0) {
    console.log(chalk.yellow('Nenhum contrato encontrado'));
    return;
  }

  let totalFacts = 0;
  let totalPatterns = 0;
  let totalRules = 0;
  let totalCases = 0;
  let implementedDetectors = 0;
  const tagsCount = new Map<string, number>();
  const statusCount = new Map<string, number>();
  const yearsCount = new Map<number, number>();

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const data = yaml.load(content) as any;

      // Conta elementos
      totalFacts += data.facts?.length || 0;
      totalPatterns += data.patterns?.length || 0;
      totalRules += data.rules?.length || 0;
      totalCases += data.cases?.length || 0;

      // Status
      const status = data.metadata?.status || 'unknown';
      statusCount.set(status, (statusCount.get(status) || 0) + 1);

      // Tags
      data.metadata?.tags?.forEach((tag: string) => {
        tagsCount.set(tag, (tagsCount.get(tag) || 0) + 1);
      });

      // Ano
      const year = data.source?.year;
      if (year) {
        yearsCount.set(year, (yearsCount.get(year) || 0) + 1);
      }

      // Detectores implementados
      if (data.metadata?.implemented_detectors?.length > 0) {
        implementedDetectors++;
      }
    } catch (error) {
      // Ignora erros de parse
    }
  }

  // Exibe estatísticas
  console.log(chalk.white.bold('📁 Geral'));
  console.log(chalk.cyan('-'.repeat(60)));
  console.log(`Total de contratos: ${chalk.bold(files.length.toString())}`);
  console.log(`Implementados: ${chalk.green(implementedDetectors.toString())}`);
  console.log(`Pendentes: ${chalk.yellow((files.length - implementedDetectors).toString())}`);
  console.log();

  console.log(chalk.white.bold('📈 Elementos Extraídos'));
  console.log(chalk.cyan('-'.repeat(60)));
  console.log(`Fatos: ${chalk.bold(totalFacts.toString())}`);
  console.log(`Padrões: ${chalk.bold(totalPatterns.toString())}`);
  console.log(`Regras: ${chalk.bold(totalRules.toString())}`);
  console.log(`Casos: ${chalk.bold(totalCases.toString())}`);
  console.log();

  console.log(chalk.white.bold('🏷️  Tags'));
  console.log(chalk.cyan('-'.repeat(60)));
  const sortedTags = Array.from(tagsCount.entries()).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sortedTags.slice(0, 10)) {
    console.log(`  ${chalk.cyan(tag)}: ${chalk.white(count.toString())}`);
  }
  console.log();

  console.log(chalk.white.bold('📅 Por Ano'));
  console.log(chalk.cyan('-'.repeat(60)));
  const sortedYears = Array.from(yearsCount.entries()).sort((a, b) => b[0] - a[0]);
  for (const [year, count] of sortedYears) {
    console.log(`  ${chalk.cyan(year.toString())}: ${chalk.white(count.toString())}`);
  }
  console.log();

  console.log(chalk.white.bold('📊 Por Status'));
  console.log(chalk.cyan('-'.repeat(60)));
  for (const [status, count] of statusCount.entries()) {
    const icon = status === 'approved' ? chalk.green('✓') : 
                 status === 'reviewed' ? chalk.yellow('⏳') : 
                 chalk.gray('○');
    console.log(`  ${icon} ${chalk.cyan(status)}: ${chalk.white(count.toString())}`);
  }
  console.log();

  // Médias
  console.log(chalk.white.bold('📐 Médias por Contrato'));
  console.log(chalk.cyan('-'.repeat(60)));
  console.log(`Fatos: ${(totalFacts / files.length).toFixed(1)}`);
  console.log(`Padrões: ${(totalPatterns / files.length).toFixed(1)}`);
  console.log(`Regras: ${(totalRules / files.length).toFixed(1)}`);
  console.log(`Casos: ${(totalCases / files.length).toFixed(1)}`);
  console.log();

  console.log(chalk.cyan('='.repeat(60)));
  console.log();
}
