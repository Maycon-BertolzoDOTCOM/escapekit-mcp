#!/usr/bin/env ts-node

import axios from 'axios';
import { readFileSync } from 'fs';

interface AlertConfig {
  type: 'quality' | 'performance' | 'regression';
  severity: 'critical' | 'warning' | 'info';
  passRate?: number;
  delta?: number;
  testName?: string;
  buildId?: string;
}

const config = {
  slackWebhook: process.env.SLACK_WEBHOOK || '',
  kiwiUrl: process.env.KIWI_URL || 'http://localhost:8080',
};

function getAlertEmoji(type: string, severity: string): string {
  const emojis: Record<string, Record<string, string>> = {
    quality: {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
    },
    performance: {
      critical: '⚡',
      warning: '🐢',
      info: '📊',
    },
    regression: {
      critical: '🔥',
      warning: '🔄',
      info: '📉',
    },
  };
  return emojis[type]?.[severity] || '⚠️';
}

function getAlertColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'danger',
    warning: 'warning',
    info: 'good',
  };
  return colors[severity] || 'warning';
}

function createSlackMessage(alert: AlertConfig): any {
  const emoji = getAlertEmoji(alert.type, alert.severity);
  const color = getAlertColor(alert.severity);

  let title = '';
  let text = '';
  let fields: any[] = [];

  if (alert.type === 'quality') {
    title = `${emoji} ALERT: ${alert.severity.toUpperCase()} - Taxa de Aprovação`;
    text = `Taxa de aprovação está abaixo do threshold.`;
    fields = [
      { title: 'Taxa Atual', value: `${alert.passRate}%`, short: true },
      { title: 'Threshold', value: alert.severity === 'critical' ? '90%' : '95%', short: true },
      { title: 'Delta', value: alert.delta ? `${delta > 0 ? '+' : ''}${delta}%` : 'N/A', short: true },
      { title: 'Build', value: alert.buildId || '1234', short: true },
    ];
  } else if (alert.type === 'performance') {
    title = `${emoji} ALERT: ${alert.severity.toUpperCase()} - Degradation de Performance`;
    text = `Tempo de execução aumentou significativamente.`;
    fields = [
      { title: 'Delta', value: `+${alert.delta}%`, short: true },
      { title: 'Build', value: alert.buildId || '1234', short: true },
      { title: 'Threshold', value: alert.severity === 'critical' ? '50%' : '20%', short: true },
    ];
  } else if (alert.type === 'regression') {
    title = `${emoji} ALERT: ${alert.severity.toUpperCase()} - Nova Regressão`;
    text = `Teste que passava agora está falhando.`;
    fields = [
      { title: 'Teste', value: alert.testName || 'Unknown', short: true },
      { title: 'Status Anterior', value: 'PASSED', short: true },
      { title: 'Status Atual', value: 'FAILED', short: true },
      { title: 'Build', value: alert.buildId || '1234', short: true },
    ];
  }

  return {
    text: title,
    attachments: [
      {
        color,
        text,
        fields,
        footer: 'EscapeKit Alerts',
        ts: Math.floor(Date.now() / 1000),
        actions: [
          {
            type: 'button',
            text: 'View Details',
            url: `${config.kiwiUrl}/runs/${alert.buildId || 1234}`,
            style: 'primary',
          },
          {
            type: 'button',
            text: 'View Dashboard',
            url: `${config.kiwiUrl}/dashboard/1`,
          },
        ],
      },
    ],
  };
}

async function sendSlackAlert(message: any): Promise<boolean> {
  if (!config.slackWebhook) {
    console.error('✗ SLACK_WEBHOOK não configurado');
    console.log('  Define: export SLACK_WEBHOOK="https://hooks.slack.com/services/..."');
    return false;
  }

  try {
    console.log(`\n📤 Enviando alerta para Slack...`);
    const response = await axios.post(config.slackWebhook, message);
    
    if (response.status === 200) {
      console.log('✅ Alerta enviado com sucesso!');
      return true;
    } else {
      console.error(`✗ Falha ao enviar alerta: Status ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.error(`✗ Erro ao enviar alerta: ${error.message}`);
    return false;
  }
}

async function testAlert(alert: AlertConfig): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`?? Testando Alerta`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nConfiguração:`);
  console.log(`  Tipo: ${alert.type}`);
  console.log(`  Severidade: ${alert.severity}`);
  if (alert.passRate) console.log(`  Taxa de Aprovação: ${alert.passRate}%`);
  if (alert.delta) console.log(`  Delta: ${alert.delta}%`);
  if (alert.testName) console.log(`  Teste: ${alert.testName}`);
  if (alert.buildId) console.log(`  Build: ${alert.buildId}`);

  const message = createSlackMessage(alert);
  
  console.log(`\n📨 Mensagem criada:`);
  console.log(`  Título: ${message.text}`);
  console.log(`  Cor: ${message.attachments[0].color}`);

  if (process.env.DRY_RUN !== 'true') {
    await sendSlackAlert(message);
  } else {
    console.log(`\nℹ️  Modo DRY RUN - Não enviando para Slack`);
    console.log(`\nPara enviar, use: DRY_RUN=false`);
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🧪 Script de Teste de Alertas - EscapeKit

Uso:
  npx ts-node scripts/test-alerts.ts [options]

Options:
  --type <quality|performance|regression>
      Tipo de alerta (padrão: quality)

  --severity <critical|warning|info>
      Severidade do alerta (padrão: warning)

  --pass-rate <number>
      Taxa de aprovação (para alertas de qualidade)

  --delta <number>
      Delta em porcentagem (para alertas de performance)

  --test-name <string>
      Nome do teste (para alertas de regressão)

  --build-id <number>
      ID do build (padrão: 1234)

  --dry-run
      Não enviar alerta, apenas mostrar mensagem

  --preset <name>
      Usar configuração predefinida (critical-pass-rate, warning-performance, etc.)

Exemplos:
  # Alerta crítico de taxa de aprovação
  npx ts-node scripts/test-alerts.ts \\
    --type quality --severity critical --pass-rate 88.5

  # Alerta de aviso de performance
  npx ts-node scripts/test-alerts.ts \\
    --type performance --severity warning --delta 35

  # Alerta de regressão
  npx ts-node scripts/test-alerts.ts \\
    --type regression --severity critical --test-name "SecurityValidator.test.ts"

  # Usar preset
  npx ts-node scripts/test-alerts.ts --preset critical-pass-rate

  # Teste sem enviar (dry run)
  DRY_RUN=true npx ts-node scripts/test-alerts.ts --preset critical-pass-rate

Presets Disponíveis:
  - critical-pass-rate: Taxa de aprovação crítica (88.5%)
  - warning-pass-rate: Taxa de aprovação aviso (92.5%)
  - critical-performance: Degradação crítica (+60%)
  - warning-performance: Degradação aviso (+35%)
  - critical-regression: Regressão crítica
  - warning-regression: Regressão aviso

Variáveis de Ambiente:
  SLACK_WEBHOOK: Webhook URL do Slack
  KIWI_URL: URL do Kiwi TCMS (padrão: http://localhost:8080)
  DRY_RUN: Se true, não enviar alerta (padrão: false)

Exemplo:
  export SLACK_WEBHOOK="https://hooks.slack.com/services/XXX/YYY/ZZZ"
  npx ts-node scripts/test-alerts.ts --preset critical-pass-rate
`);
    process.exit(0);
  }

  // Parse arguments
  const options: AlertConfig = {
    type: 'quality',
    severity: 'warning',
    buildId: '1234',
  };

  let argIndex = 0;
  while (argIndex < args.length) {
    const arg = args[argIndex];
    
    if (arg === '--type' && args[argIndex + 1]) {
      options.type = args[argIndex + 1] as any;
      argIndex += 2;
    } else if (arg === '--severity' && args[argIndex + 1]) {
      options.severity = args[argIndex + 1] as any;
      argIndex += 2;
    } else if (arg === '--pass-rate' && args[argIndex + 1]) {
      options.passRate = parseFloat(args[argIndex + 1]);
      argIndex += 2;
    } else if (arg === '--delta' && args[argIndex + 1]) {
      options.delta = parseFloat(args[argIndex + 1]);
      argIndex += 2;
    } else if (arg === '--test-name' && args[argIndex + 1]) {
      options.testName = args[argIndex + 1];
      argIndex += 2;
    } else if (arg === '--build-id' && args[argIndex + 1]) {
      options.buildId = args[argIndex + 1];
      argIndex += 2;
    } else if (arg === '--dry-run') {
      process.env.DRY_RUN = 'true';
      argIndex += 1;
    } else if (arg === '--preset' && args[argIndex + 1]) {
      const preset = args[argIndex + 1];
      
      const presets: Record<string, AlertConfig> = {
        'critical-pass-rate': {
          type: 'quality',
          severity: 'critical',
          passRate: 88.5,
          delta: -6.5,
          buildId: '1234',
        },
        'warning-pass-rate': {
          type: 'quality',
          severity: 'warning',
          passRate: 92.5,
          delta: -2.5,
          buildId: '1234',
        },
        'critical-performance': {
          type: 'performance',
          severity: 'critical',
          delta: 60,
          buildId: '1234',
        },
        'warning-performance': {
          type: 'performance',
          severity: 'warning',
          delta: 35,
          buildId: '1234',
        },
        'critical-regression': {
          type: 'regression',
          severity: 'critical',
          testName: 'SecurityValidator.test.ts',
          buildId: '1234',
        },
        'warning-regression': {
          type: 'regression',
          severity: 'warning',
          testName: 'RateLimiter.test.ts',
          buildId: '1234',
        },
      };
      
      if (presets[preset]) {
        Object.assign(options, presets[preset]);
      } else {
        console.error(`✗ Preset desconhecido: ${preset}`);
        console.log(`\nPresets disponíveis:`);
        Object.keys(presets).forEach(p => console.log(`  - ${p}`));
        process.exit(1);
      }
      
      argIndex += 2;
    } else {
      console.error(`✗ Argumento desconhecido: ${arg}`);
      process.exit(1);
    }
  }

  await testAlert(options);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { testAlert, createSlackMessage };