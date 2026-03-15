/**
 * Comando: diff
 * Manipula diffs unificados (aplicar, gerar, validar)
 */

import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'fs';
import { DiffApplyTransformer } from '../../../src/transformers/DiffApplyTransformer.js';

export interface DiffOptions {
  fuzzy?: number;
  backup?: boolean;
  output?: string;
}

/**
 * Subcomando: diff apply
 * Aplica um diff unificado a um arquivo
 */
export async function diffApplyAction(
  filePath: string,
  diffPath: string,
  options: DiffOptions
): Promise<void> {
  console.log();
  console.log(chalk.green.bold('✅ Qwen EscapeKit - Aplicar Diff'));
  console.log(chalk.cyan('='.repeat(50)));
  console.log();

  try {
    // Ler o diff do arquivo
    const diffContent = readFileSync(diffPath, 'utf-8');

    // Validar o diff antes de aplicar
    const transformer = new DiffApplyTransformer();
    if (!transformer.validateDiff(diffContent)) {
      console.log(chalk.red('❌ Diff inválido'));
      console.log(chalk.yellow('Verifique o formato do diff (deve ser unified diff)'));
      process.exit(1);
    }

    console.log(chalk.cyan(`Arquivo: ${filePath}`));
    console.log(chalk.cyan(`Diff: ${diffPath}`));
    if (options.fuzzy !== undefined) {
      console.log(chalk.yellow(`Fuzzy threshold: ${options.fuzzy}`));
    }
    if (options.backup) {
      console.log(chalk.yellow('Backup: habilitado'));
    }
    console.log();

    // Aplicar o diff
    const result = await transformer.applyDiff(filePath, diffContent, {
      fuzzyThreshold: options.fuzzy,
      backup: options.backup,
    });

    if (result.success) {
      console.log(chalk.green('✓ Diff aplicado com sucesso'));
      console.log(chalk.cyan(`Hunks aplicados: ${result.hunksApplied}`));
      console.log(chalk.cyan(`Linhas alteradas: ${result.linesChanged}`));
      
      if (result.backupPath) {
        console.log(chalk.yellow(`Backup criado em: ${result.backupPath}`));
      }
      console.log();
    } else {
      console.log(chalk.red('❌ Falha ao aplicar diff'));
      console.log(chalk.yellow(`Hunks falharam: ${result.hunksFailed}`));
      
      if (result.errors && result.errors.length > 0) {
        console.log(chalk.red('Erros:'));
        result.errors.forEach(err => console.log(chalk.red(`   - ${err}`)));
      }
      console.log();
      process.exit(1);
    }
  } catch (error) {
    console.log(chalk.red('❌ Erro ao aplicar diff'));
    console.log(chalk.red((error as Error).message));
    process.exit(1);
  }
}

/**
 * Subcomando: diff generate
 * Gera um diff unificado entre dois arquivos
 */
export async function diffGenerateAction(
  originalPath: string,
  modifiedPath: string,
  options: DiffOptions
): Promise<void> {
  console.log();
  console.log(chalk.green.bold('✅ Qwen EscapeKit - Gerar Diff'));
  console.log(chalk.cyan('='.repeat(50)));
  console.log();

  try {
    const original = readFileSync(originalPath, 'utf-8');
    const modified = readFileSync(modifiedPath, 'utf-8');

    const transformer = new DiffApplyTransformer();
    const diff = transformer.generateDiff(original, modified);

    if (!diff || diff.trim().length === 0) {
      console.log(chalk.yellow('⚠️  Nenhuma diferença encontrada entre os arquivos'));
      console.log();
      return;
    }

    console.log(chalk.cyan(`Original: ${originalPath}`));
    console.log(chalk.cyan(`Modificado: ${modifiedPath}`));
    console.log();

    const outputPath = options.output || 'diff.patch';
    writeFileSync(outputPath, diff, 'utf-8');

    console.log(chalk.green(`✓ Diff gerado em: ${outputPath}`));
    console.log();
  } catch (error) {
    console.log(chalk.red('❌ Erro ao gerar diff'));
    console.log(chalk.red((error as Error).message));
    process.exit(1);
  }
}

/**
 * Subcomando: diff validate
 * Valida um arquivo de diff
 */
export async function diffValidateAction(diffPath: string): Promise<void> {
  console.log();
  console.log(chalk.green.bold('✅ Qwen EscapeKit - Validar Diff'));
  console.log(chalk.cyan('='.repeat(50)));
  console.log();

  try {
    const diffContent = readFileSync(diffPath, 'utf-8');

    const transformer = new DiffApplyTransformer();
    const isValid = transformer.validateDiff(diffContent);

    console.log(chalk.cyan(`Diff: ${diffPath}`));
    console.log();

    if (isValid) {
      console.log(chalk.green('✓ Diff válido (formato unified diff)'));
      console.log();
    } else {
      console.log(chalk.red('❌ Diff inválido'));
      console.log(chalk.yellow('O diff deve seguir o formato unified diff padrão:'));
      console.log(chalk.gray('   --- a/file.txt'));
      console.log(chalk.gray('   +++ b/file.txt'));
      console.log(chalk.gray('   @@ -1,3 +1,3 @@'));
      console.log(chalk.gray('    context'));
      console.log(chalk.gray('   -removed'));
      console.log(chalk.gray('   +added'));
      console.log();
      process.exit(1);
    }
  } catch (error) {
    console.log(chalk.red('❌ Erro ao validar diff'));
    console.log(chalk.red((error as Error).message));
    process.exit(1);
  }
}