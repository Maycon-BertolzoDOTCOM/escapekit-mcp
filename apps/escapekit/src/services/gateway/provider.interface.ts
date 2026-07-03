// src/services/gateway/provider.interface.ts
export interface InferenceParams {
  image: Buffer | string;    // imagem em buffer ou base64
  prompt: string;            // instrução para o modelo
  maxTokens?: number;
}

export interface InferenceResult {
  text: string;              // resposta do modelo
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ProviderMetrics {
  name: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  avgLatencyMs: number;
  lastError?: string;
  score: number;             // menor = melhor
}

export interface AIProvider {
  readonly name: string;
  readonly priority: number;   // 0 = mais alto (fallback order)
  readonly costPerToken: number; // USD, 0 = free tier

  call(params: InferenceParams): Promise<InferenceResult>;
  healthCheck(): Promise<boolean>;
  getMetrics(): ProviderMetrics;
  recordSuccess(latencyMs: number, usage?: any): void;
  recordFailure(error: Error): void;
}