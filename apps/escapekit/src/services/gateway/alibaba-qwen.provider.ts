// src/services/gateway/alibaba-qwen.provider.ts
import { AIProvider, InferenceParams, InferenceResult, ProviderMetrics } from './provider.interface';

export class AlibabaQwenProvider implements AIProvider {
  readonly name = 'alibaba-qwen';
  readonly priority = 0;      // primeiro
  readonly costPerToken = 0;  // free tier 500M tokens

  private totalCalls = 0;
  private successCalls = 0;
  private errorCalls = 0;
  private latencies: number[] = [];

  async call(params: InferenceParams): Promise<InferenceResult> {
    const start = Date.now();
    const apiKey = process.env.ALIBABA_API_KEY;
    if (!apiKey) {
      throw new Error('ALIBABA_API_KEY not set');
    }

    const imageBase64 = typeof params.image === 'string' 
      ? params.image.replace(/^data:image\/[^;]+;base64,/, '')
      : params.image.toString('base64');

    // Qwen-VL (multimodal) - endpoint correto
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: imageBase64 },
                { text: params.prompt }
              ]
            }
          ]
        },
        parameters: { max_tokens: params.maxTokens || 500 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Alibaba Qwen error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const latency = Date.now() - start;
    this.recordSuccess(latency, data.usage);

    const text = data.output?.choices?.[0]?.message?.content || '';
    return {
      text,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Teste simples com prompt mínimo
      await this.call({ 
        image: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
        prompt: 'test', 
        maxTokens: 1 
      });
      return true;
    } catch {
      return false;
    }
  }

  getMetrics(): ProviderMetrics {
    const avgLatency = this.latencies.length 
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length 
      : 0;
    const errorRate = this.totalCalls ? this.errorCalls / this.totalCalls : 0;
    // score = latência média (ms) + 1000 * errorRate
    const score = avgLatency + (errorRate * 1000);
    
    return {
      name: this.name,
      totalCalls: this.totalCalls,
      successCalls: this.successCalls,
      errorCalls: this.errorCalls,
      avgLatencyMs: avgLatency,
      score
    };
  }

  recordSuccess(latencyMs: number, _usage?: any): void {
    this.totalCalls++;
    this.successCalls++;
    this.latencies.push(latencyMs);
    // Mantém apenas as últimas 100 medições
    if (this.latencies.length > 100) this.latencies.shift();
  }

  recordFailure(error: Error): void {
    this.totalCalls++;
    this.errorCalls++;
    console.warn(`[${this.name}] ${error.message}`);
  }
}