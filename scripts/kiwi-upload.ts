#!/usr/bin/env node

/**
 * Kiwi TCMS Upload CLI
 * Wrapper simplificado para o script principal
 *
 * Uso:
 *   kiwi-upload --file results.json
 *   kiwi-upload -f results.json --auto-create
 *   kiwi-upload -f results.json --debug
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CLIArgs {
  file?: string;
  autoCreate?: boolean;
  dryRun?: boolean;
  debug?: boolean;
  verbose?: boolean;
  framework?: string;
  productId?: number;
  productName?: string;
  testPlanId?: number;
  help?: boolean;
}

function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-f':
      case '--file':
        result.file = args[++i];
        break;
      case '-a':
      case '--auto-create':
      case '--auto-create-cases':
        result.autoCreate = true;
        break;
      case '-d':
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--debug':
        result.debug = true;
        break;
      case '-v':
      case '--verbose':
        result.verbose = true;
        break;
      case '--framework':
        result.framework = args[++i];
        break;
      case '--product-id':
        result.productId = parseInt(args[++i]);
        break;
      case '--product-name':
        result.productName = args[++i];
        break;
      case '--test-plan-id':
        result.testPlanId = parseInt(args[++i]);
        break;
      case '-h':
      case '--help':
        result.help = true;
        break;
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`
Kiwi TCMS Upload CLI

Uso:
  kiwi-upload [opções]

Opções:
  -f, --file <arquivo>       Arquivo de resultados de testes (obrigatório)
  -a, --auto-create          Criar casos automaticamente
  -d, --dry-run              Modo teste (sem enviar)
  -v, --verbose              Modo verboso
  --debug                    Modo debug
  --framework <tipo>         Framework (vitest, jest, mocha, playwright, cypress)
  --product-id <id>          ID do produto
  --product-name <nome>       Nome do produto
  --test-plan-id <id>        ID do plano de testes
  -h, --help                 Mostrar esta ajuda

Exemplos:
  kiwi-upload --file results.json
  kiwi-upload -f results.json --auto-create
  kiwi-upload -f results.json --debug --dry-run
  kiwi-upload -f jest-results.json --framework jest --auto-create

Variáveis de ambiente:
  KIWI_URL, KIWI_USERNAME, KIWI_PASSWORD, KIWI_TEST_PLAN_ID
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (!args.file) {
    console.error('Erro: Arquivo não especificado. Use --file ou -f');
    console.error('Use --help para ver as opções disponíveis');
    process.exit(1);
  }

  // Verificar se o arquivo existe
  if (!existsSync(args.file)) {
    console.error(`Erro: Arquivo não encontrado: ${args.file}`);
    process.exit(1);
  }

  // Construir argumentos para o script principal
  const scriptArgs = ['--file', args.file];

  if (args.autoCreate) scriptArgs.push('--auto-create-cases');
  if (args.dryRun) scriptArgs.push('--dry-run');
  if (args.verbose) scriptArgs.push('--verbose');
  if (args.debug) {
    scriptArgs.push('--verbose');
    process.env.KIWI_DEBUG = 'true';
  }
  if (args.framework) scriptArgs.push('--framework', args.framework);
  if (args.productId) scriptArgs.push('--product-id', String(args.productId));
  if (args.productName) scriptArgs.push('--product-name', args.productName);
  if (args.testPlanId) scriptArgs.push('--test-plan-id', String(args.testPlanId));

  // Executar o script principal (REST API)
  const scriptPath = join(__dirname, 'kiwi-upload-rest.ts');

  const child = spawn('npx', ['tsx', scriptPath, ...scriptArgs], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('exit', code => {
    process.exit(code || 0);
  });

  child.on('error', err => {
    console.error('Erro ao executar script:', err);
    process.exit(1);
  });
}

main().catch(console.error);
