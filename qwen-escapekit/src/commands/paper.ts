/**
 * Comando: paper
 * Processa um paper acadêmico e gera um contrato factual YAML
 */

import chalk from 'chalk';
import ora from 'ora';
import { SourceResolver, type SourceMetadata } from '../engines/source-resolver.js';
import { ContractGenerator } from '../engines/contract-generator.js';
import { ContractValidator } from '../engines/contract-validator.js';
import { BoilerplateGenerator } from '../engines/boilerplate-generator.js';
import { generateCitekey, ensureDirectory } from '../utils/fs-utils.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface PaperOptions {
  output: string;
  model?: string;
  generateBoilerplate: boolean;
  validate: boolean;
  interactive: boolean;
  ollamaUrl: string;
}

export async function paperAction(source: string, options: PaperOptions): Promise<void> {
  console.log();
  console.log(chalk.green.bold('📄 Qwen EscapeKit - Paper to Contract'));
  console.log(chalk.cyan('============================================'));
  console.log();

  const spinner = ora({ isSilent: false });

  try {
    // Passo 1: Resolver e extrair metadados da fonte
    spinner.start('Resolvendo fonte e extraindo metadados...');
    const resolver = new SourceResolver();
    const metadata = await resolver.resolve(source);
    spinner.succeed(chalk.green(`Metadados extraídos: ${metadata.title}`));

    logMetadata(metadata);

    // Gera citekey
    const citekey = generateCitekey(metadata.title);
    console.log(chalk.cyan('   Citekey:'), citekey);
    console.log();

    // Passo 2: Gerar contrato factual com IA
    spinner.start('Gerando contrato factual com IA...');
    const generator = new ContractGenerator({
      model: options.model,
      ollamaUrl: options.ollamaUrl,
    });

    const contract = await generator.generate(metadata);
    spinner.succeed(chalk.green('Contrato gerado com sucesso'));

    // Passo 3: Validar contrato (se habilitado)
    if (options.validate) {
      spinner.start('Validando contrato...');
      const validator = new ContractValidator();
      const validationResult = validator.validate(contract);

      if (!validationResult.valid) {
        spinner.warn(chalk.yellow('Contrato gerado com avisos:'));
        validationResult.warnings.forEach(w => console.log(chalk.yellow(`   ⚠️  ${w}`)));
      } else {
        spinner.succeed(chalk.green('Contrato válido'));
      }
    }

    // Passo 4: Salvar contrato
    spinner.start('Salvando contrato...');
    ensureDirectory(options.output);
    const contractPath = join(options.output, `${citekey}.yaml`);
    writeFileSync(contractPath, contract, 'utf-8');
    spinner.succeed(chalk.green(`Contrato salvo em: ${contractPath}`));
    console.log();

    // Passo 5: Gerar boilerplate (se habilitado)
    if (options.generateBoilerplate) {
      spinner.start('Gerando boilerplate do detector...');
      const boilerplateGen = new BoilerplateGenerator({
        ollamaUrl: options.ollamaUrl,
        model: options.model,
      });

      const boilerplate = await boilerplateGen.generate(contract);
      const detectorPath = join('./src/security/', `${boilerplate.detectorName}.ts`);
      writeFileSync(detectorPath, boilerplate.code, 'utf-8');
      spinner.succeed(chalk.green(`Detector esboçado em: ${detectorPath}`));

      if (boilerplate.testCode) {
        const testPath = join('./tests/security/', `${boilerplate.detectorName}.test.ts`);
        ensureDirectory('./tests/security/');
        writeFileSync(testPath, boilerplate.testCode, 'utf-8');
        console.log(chalk.green(`   Testes em: ${testPath}`));
      }
      console.log();
    }

    // Passo 6: Modo interativo (se habilitado)
    if (options.interactive) {
      console.log(chalk.yellow('⚠️  Modo interativo não implementado nesta versão.'));
      console.log(chalk.cyan('   Você pode editar o contrato manualmente em:'), contractPath);
      console.log();
    }

    // Resumo final
    console.log(chalk.green.bold('✅ Processo concluído!'));
    console.log();
    console.log(chalk.cyan('Próximos passos:'));
    console.log(`   1. Revise o contrato em ${chalk.cyan(contractPath)}`);
    if (options.generateBoilerplate) {
      console.log(`   2. Implemente a lógica do detector em ${chalk.cyan('./src/security/')}`);
      console.log(`   3. Execute os testes gerados`);
    } else {
      console.log(`   2. Execute: ${chalk.cyan(`qwen-escapekit implement ${citekey} --generate-boilerplate`)}`);
    }
    console.log(`   3. Valide com: ${chalk.cyan('qwen-escapekit validate ' + citekey)}`);
    console.log();

  } catch (error) {
    spinner.fail(chalk.red('Falha no processo'));
    throw error;
  }
}

function logMetadata(metadata: SourceMetadata): void {
  console.log(chalk.cyan('   Título:'), chalk.white(metadata.title));
  console.log(chalk.cyan('   Autores:'), chalk.white(metadata.authors || 'Não informado'));
  console.log(chalk.cyan('   Ano:'), chalk.white(metadata.year?.toString() || 'Não informado'));
  if (metadata.abstract) {
    const abstract = metadata.abstract.length > 150 
      ? metadata.abstract.substring(0, 150) + '...' 
      : metadata.abstract;
    console.log(chalk.cyan('   Abstract:'), chalk.white(abstract));
  }
  console.log(chalk.cyan('   URL:'), chalk.white(metadata.url));
  console.log(chalk.cyan('   DOI:'), chalk.white(metadata.doi || 'Não informado'));
}
