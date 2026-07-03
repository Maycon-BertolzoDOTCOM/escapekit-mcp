/**
 * Comando: implement
 * Gera ou atualiza código de detector baseado em contrato factual
 */

import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BoilerplateGenerator } from '../engines/boilerplate-generator.js';
import { ensureDirectory } from '../utils/fs-utils.js';

export interface ImplementOptions {
  output: string;
  tests: boolean;
  force: boolean;
}

export async function implementAction(citekey: string, options: ImplementOptions): Promise<void> {
  console.log();
  console.log(chalk.green.bold('🔨 Qwen EscapeKit - Implementar Detector'));
  console.log(chalk.cyan('='.repeat(50)));
  console.log();

  const spinner = ora({ isSilent: false });

  try {
    // Carrega contrato
    const contractPath = join('./knowledge-base/', `${citekey}.yaml`);
    
    spinner.start(`Carregando contrato: ${citekey}.yaml`);
    
    let contractContent: string;
    try {
      contractContent = readFileSync(contractPath, 'utf-8');
    } catch (error) {
      spinner.fail(chalk.red(`Contrato não encontrado: ${contractPath}`));
      console.log(chalk.yellow('Dica: Use `qwen-escapekit list` para ver contratos disponíveis'));
      throw new Error('Contrato não encontrado');
    }
    
    spinner.succeed(chalk.green('Contrato carregado'));

    // Gera boilerplate
    spinner.start('Gerando código do detector...');
    
    const generator = new BoilerplateGenerator({
      ollamaUrl: 'http://localhost:11434',
    });

    const boilerplate = await generator.generate(contractContent);
    
    spinner.succeed(chalk.green('Código gerado'));

    // Salva código principal
    ensureDirectory(options.output);
    const detectorPath = join(options.output, `${boilerplate.detectorName}.ts`);
    
    if (!options.force && require('fs').existsSync(detectorPath)) {
      spinner.warn(chalk.yellow(`Arquivo já existe: ${detectorPath}`));
      console.log(chalk.yellow('Use --force para sobrescrever'));
    } else {
      writeFileSync(detectorPath, boilerplate.code, 'utf-8');
      console.log(chalk.green(`   ✓ Detector salvo em: ${detectorPath}`));
    }

    // Salva testes (se solicitado)
    if (options.tests && boilerplate.testCode) {
      const testPath = join('./tests/security/', `${boilerplate.detectorName}.test.ts`);
      ensureDirectory('./tests/security/');
      
      if (!options.force && require('fs').existsSync(testPath)) {
        console.log(chalk.yellow(`   ⚠️  Testes já existem: ${testPath}`));
      } else {
        writeFileSync(testPath, boilerplate.testCode, 'utf-8');
        console.log(chalk.green(`   ✓ Testes salvos em: ${testPath}`));
      }
    }

    console.log();
    console.log(chalk.green.bold('✅ Boilerplate gerado!'));
    console.log();
    console.log(chalk.cyan('Próximos passos:'));
    console.log(`   1. Implemente a lógica do detector em ${chalk.cyan(detectorPath)}`);
    console.log(`   2. Execute os testes: ${chalk.cyan(`npm test -- ${boilerplate.detectorName}`)}`);
    console.log(`   3. Atualize o contrato com a seção de traceabilidade`);
    console.log();

  } catch (error) {
    spinner.fail(chalk.red('Falha ao implementar detector'));
    throw error;
  }
}
