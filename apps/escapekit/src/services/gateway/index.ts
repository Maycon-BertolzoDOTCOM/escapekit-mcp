// src/services/gateway/index.ts
// Exportações principais do módulo de gateway

export type { AIProvider, InferenceParams, InferenceResult, ProviderMetrics } from './provider.interface';
export { MetricsCollector } from './metrics.collector';
export { GatewayOrchestrator } from './gateway.orchestrator';

// Exportações dos provedores
export { AlibabaQwenProvider } from './alibaba-qwen.provider';
export { TencentHunyuanProvider } from './tencent-hunyuan.provider';
export { HuaweiPanguProvider } from './huawei-pangu.provider';
export { WaveSpeedAIProvider } from './wavespeed-ai.provider';
export { FallbackLocalProvider } from './fallback-local.provider';

// Instância singleton pré-configurada do gateway
import { GatewayOrchestrator } from './gateway.orchestrator';
import { AlibabaQwenProvider } from './alibaba-qwen.provider';
import { TencentHunyuanProvider } from './tencent-hunyuan.provider';
import { HuaweiPanguProvider } from './huawei-pangu.provider';
import { WaveSpeedAIProvider } from './wavespeed-ai.provider';
import { FallbackLocalProvider } from './fallback-local.provider';

// Cria e exporta uma instância padrão do gateway
const defaultProviders = [
  new WaveSpeedAIProvider(),  // Prioridade máxima - simulação visual
  new AlibabaQwenProvider(),
  new TencentHunyuanProvider(), 
  new HuaweiPanguProvider(),
  new FallbackLocalProvider()
];

// Gateway singleton para uso em toda a aplicação
export const gatewayOrchestrator = new GatewayOrchestrator(defaultProviders, 60000); // Reordena a cada 60s

// Função utilitária para criar gateway customizado
export function createCustomGateway(providersConfig: {
  useWaveSpeed?: boolean;
  useAlibaba?: boolean;
  useTencent?: boolean;
  useHuawei?: boolean;
  useFallback?: boolean;
  reorderIntervalMs?: number;
}) {
  const providers: any[] = [];
  
  if (providersConfig.useWaveSpeed !== false) {
    providers.push(new WaveSpeedAIProvider());
  }
  
  if (providersConfig.useAlibaba !== false) {
    providers.push(new AlibabaQwenProvider());
  }
  
  if (providersConfig.useTencent !== false) {
    providers.push(new TencentHunyuanProvider());
  }
  
  if (providersConfig.useHuawei !== false) {
    providers.push(new HuaweiPanguProvider());
  }
  
  if (providersConfig.useFallback !== false) {
    providers.push(new FallbackLocalProvider());
  }
  
  const reorderMs = providersConfig.reorderIntervalMs || 60000;
  
  return new GatewayOrchestrator(providers, reorderMs);
}

// Métodos utilitários para gerenciamento fácil da instância padrão
export function getGatewayStatus() {
  return {
    activeProviders: gatewayOrchestrator.getProvidersMetrics(),
    bestProvider: gatewayOrchestrator.getBestProviderName(),
    totalCalls: gatewayOrchestrator.getTotalCalls(),
    successRate: gatewayOrchestrator.getSuccessRate().toFixed(1) + '%'
  };
}

export async function shutdownGateway() {
  await gatewayOrchestrator.shutdown();
}

// Exemplo de uso:
/*
import { gatewayOrchestrator } from './services/gateway';

// Chamada simples
const result = await gatewayOrchestrator.callWithFallback({
  image: imageBuffer,
  prompt: 'Analise este ambiente para recomendação de pisos...',
  maxTokens: 500
});

// Status do gateway
console.log(getGatewayStatus());
*/