/**
 * Comando: validate
 * Valida contrato(s) factual(is)
 */

import chalk from 'chalk';
import { glob } from 'glob';
import { readFileSync } from 'fs';
import { ContractValidator } from '../engines/contract-validator.js';

export interface ValidateOptions {
  all: boolean;
  strict: boolean;
}

export async function validateAction(contract: string | undefined, options: ValidateOptions): Promise<void> {
  console.log();
  console.log(chalk.green.bold('✅ Qwen EscapeKit - Validar Contratos'));
  console.log(chalk.cyan('='.repeat(50)));
  console.log();

  const validator = new ContractValidator();
  let files: string[] = [];

  if (options.all) {
    // Valida todos os contratos
    files = await glob('./knowledge-base/*.yaml');
  } else if (contract) {
    // Valida contrato específico
    const contractPath = contract.endsWith('.yaml') ? contract : `./knowledge-base/${contract}.yaml`;
    files = [contractPath];
  } else {
    // Padrão: valida todos
    files = await glob('./knowledge-base/*.yaml');
  }

  if (files.length === 0) {
    console.log(chalk.yellow('Nenhum contrato encontrado para validar'));
    return;
  }

  let totalValid = 0;
  let totalWarnings = 0;
  let totalErrors = 0;

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const result = validator.validate(content);

      const filename = file.split('/').pop() || file;
      
      if (result.valid) {
        console.log(chalk.green(`✓ ${filename}`));
        totalValid++;
        
        if (result.warnings.length > 0) {
          result.warnings.forEach(w => console.log(chalk.yellow(`   ⚠️  ${w}`)));
          totalWarnings += result.warnings.length;
        }
      } else {
        console.log(chalk.red(`✗ ${filename}`));
        result.errors.forEach(e => console.log(chalk.red(`   ❌ ${e}`)));
        result.warnings.forEach(w => console.log(chalk.yellow(`   ⚠️  ${w}`)));
        totalErrors++;
        totalWarnings += result.warnings.length;
      }
    } catch (error) {
      console.log(chalk.red(`✗ ${file}`));
      console.log(chalk.red(`   Erro ao ler: ${(error as Error).message}`));
      totalErrors++;
    }
  }

  console.log();
  console.log(chalk.cyan('='.repeat(50)));
  console.log(`Total: ${files.length} | ${chalk.green(`${totalValid} válidos`)} | ${chalk.red(`${totalErrors} inválidos`)}`);
  
  if (totalWarnings > 0) {
    console.log(chalk.yellow(`${totalWarnings} avisos`));
  }
  console.log();

  if (totalErrors > 0) {
    if (options.strict) {
      throw new Error('Validação falhou no modo estrito');
    }
    process.exitCode = 1;
  }
}
