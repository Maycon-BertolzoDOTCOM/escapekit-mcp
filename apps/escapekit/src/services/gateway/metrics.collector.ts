// src/services/gateway/metrics.collector.ts
import { AIProvider, ProviderMetrics } from './provider.interface';

export class MetricsCollector {
  private providersMetrics: Map<string, ProviderMetrics> = new Map();

  update(providerName: string, metrics: ProviderMetrics) {
    this.providersMetrics.set(providerName, metrics);
  }

  getBestProvider(providers: AIProvider[]): AIProvider {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    let best = providers[0];
    let bestScore = best.getMetrics().score;
    
    for (const provider of providers) {
      const metrics = provider.getMetrics();
      if (metrics.score < bestScore) {
        bestScore = metrics.score;
        best = provider;
      }
    }
    
    return best;
  }

  getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.providersMetrics.values());
  }

  // Método para debug/logging
  printMetrics(): void {
    console.log('=== Gateway Metrics ===');
    this.getAllMetrics().forEach(metrics => {
      console.log(`${metrics.name}: score=${metrics.score.toFixed(2)}, ` +
                 `latency=${metrics.avgLatencyMs.toFixed(2)}ms, ` +
                 `success=${metrics.successCalls}/${metrics.totalCalls}`);
    });
    console.log('========================');
  }
}