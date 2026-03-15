/**
 * Comando: list
 * Lista todos os contratos factuais no knowledge-base
 */

import chalk from 'chalk';
import { glob } from 'glob';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { relative } from 'path';

export interface ListOptions {
  implemented?: boolean;
  pending?: boolean;
  tag?: string;
  json: boolean;
}

export async function listAction(options: ListOptions): Promise<void> {
  const knowledgeBase = './knowledge-base/';
  
  // Busca todos os arquivos YAML
  const files = await glob(`${knowledgeBase}*.yaml`);
  
  if (files.length === 0) {
    console.log(chalk.yellow('Nenhum contrato factual encontrado em', knowledgeBase));
    return;
  }
  
  const contracts: Array<{
    citekey: string;
    title: string;
    year?: number;
    status: string;
    tags: string[];
    implemented: boolean;
    path: string;
  }> = [];
  
  // Lê cada contrato
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const data = yaml.load(content) as any;
      
      const citekey = file.split('/').pop()?.replace('.yaml', '') || '';
      const status = data.metadata?.status || 'unknown';
      const tags = data.metadata?.tags || [];
      const implemented = data.metadata?.implemented_detectors?.length > 0;
      
      // Aplica filtros
      if (options.implemented && !implemented) continue;
      if (options.pending && implemented) continue;
      if (options.tag && !tags.includes(options.tag)) continue;
      
      contracts.push({
        citekey,
        title: data.source?.title || 'Unknown',
        year: data.source?.year,
        status,
        tags,
        implemented,
        path: relative(process.cwd(), file),
      });
    } catch (error) {
      console.error(chalk.red(`Erro ao ler ${file}:`), (error as Error).message);
    }
  }
  
  if (contracts.length === 0) {
    console.log(chalk.yellow('Nenhum contrato encontrado com os filtros especificados'));
    return;
  }
  
  if (options.json) {
    console.log(JSON.stringify(contracts, null, 2));
    return;
  }
  
  // Exibe lista formatada
  console.log();
  console.log(chalk.green.bold(`📚 Contratos Factuais (${contracts.length} encontrados)`));
  console.log(chalk.cyan('='.repeat(60)));
  console.log();
  
  for (const contract of contracts) {
    const statusIcon = contract.implemented ? chalk.green('✓') : chalk.yellow('⏳');
    const statusText = contract.implemented ? 'Implementado' : 'Pendente';
    
    console.log(`${statusIcon} ${chalk.bold(contract.citekey)}`);
    console.log(`   ${chalk.white(contract.title)}`);
    console.log(`   Status: ${chalk.cyan(statusText)} | Ano: ${contract.year || '?'} | Tags: ${contract.tags.join(', ') || 'nenhuma'}`);
    console.log(`   ${chalk.gray(contract.path)}`);
    console.log();
  }
  
  // Resumo
  const implementedCount = contracts.filter(c => c.implemented).length;
  const pendingCount = contracts.length - implementedCount;
  
  console.log(chalk.cyan('='.repeat(60)));
  console.log(`Total: ${contracts.length} | ${chalk.green(`${implementedCount} implementados`)} | ${chalk.yellow(`${pendingCount} pendentes`)}`);
  console.log();
}
