# Unificação de Sistemas de Simulação Visual

## Requisito
Eliminar redundância arquitetural entre 3 sistemas concorrentes de simulação visual:
- WaveSpeedAI Provider (src/services/gateway/wavespeed-ai.provider.ts)
- Material Simulator (pisosrealview-pro-transformed/services/core/materialSimulator.ts) 
- Gemini Renderer (pisosrealview-pro-transformed/services/ai/gemini/rendering.ts)

Consolidar toda a simulação visual no gateway orquestrador para criar uma única fonte de verdade.

## Cenário e Processamento Lógico
O frontend (pisosrealview-pro-transformed/App.tsx) atualmente tem caminhos conflitantes para simulação visual:
1. **Via Material Simulator**: Direto para simulação local
2. **Via Gemini Renderer**: Renderização com IA Gemini  
3. **Via Gateway (novo)**: WaveSpeedAI com fallback multi-provedor

**Fluxo unificado proposto**:
Frontend → Gateway Orquestrador → WaveSpeedAI (priority 1) → Fallback para outros provedores → Fallback local

## Arquitetura e Abordagem Técnica
**SOLID Architecture**:
- **Single Responsibility**: Gateway gerencia apenas orquestração de provedores
- **Open/Closed**: Provedores podem ser adicionados sem modificar gateway
- **Liskov Substitution**: Todos os provedores implementam AIProvider
- **Interface Segregation**: Interface AIProvider foca em simulação visual
- **Dependency Inversion**: Frontend depende da abstração (gateway), não de implementações

**Padrões Aplicados**:
- Strategy Pattern para provedores de simulação
- Circuit Breaker para resiliência
- Factory Method para criação de provedores
- Observer Pattern para métricas

## Arquivos Afetados (Modificações, Paths Absolutos, Funções)

### **Arquivos para ELIMINAR** (redundância completa):
- `/home/vector/Documentos/RalphLoopInverso/pisosrealview-pro-transformed/services/core/materialSimulator.ts`
  - Funções: `renderFlooring()`, `loadTextures()`, `applyMaterial()`
- `/home/vector/Documentos/RalphLoopInverso/pisosrealview-pro-transformed/services/ai/gemini/rendering.ts`
  - Funções: `generateVisualization()`, `enhanceImage()`

### **Arquivos para MODIFICAR** (integração unificada):
- `/home/vector/Documentos/RalphLoopInverso/pisosrealview-pro-transformed/App.tsx`
  - Substituir chamada direta ao materialSimulator por gatewayOrchestrator
  - Modificar `handleSimulationRequest()`
- `/home/vector/Documentos/RalphLoopInverso/src/services/gateway/gateway.orchestrator.ts`
  - Ajustar imports se necessário
  - Extensão para suportar parâmetros específicos de simulação visual

### **Arquivos para MANTER** (core da solução):
- `/home/vector/Documentos/RalphLoopInverso/src/services/gateway/wavespeed-ai.provider.ts`
- `/home/vector/Documentos/RalphLoopInverso/src/services/gateway/index.ts`
- `/home/vector/Documentos/RalphLoopInverso/src/services/gateway/fallback.provider.ts`

### **Arquivos para CORRIGIR** (TypeScript errors):
- Vários arquivos com imports não utilizados e parâmetros não lidos

## Detalhes de Implementação

### Frontend App.tsx Modification:
```typescript
// ANTES (conflitante):
import { materialSimulator } from './services/core/materialSimulator';
const result = await materialSimulator.renderFlooring(imageBuffer, materialSpecs);

// DEPOIS (unificado):
import { gatewayOrchestrator } from '../../../src/services/gateway';
const result = await gatewayOrchestrator.callWithFallback({
  image: imageBuffer,
  prompt: `Replace the floor with ${materialSpecs.type} in ${materialSpecs.color}, dimensions ${materialSpecs.dimensions}`,
  maxTokens: 500,
  simulationType: 'flooring-visualization'
});
```

### TypeScript Error Corrections:
```typescript
// Exemplo de correção de parâmetro não utilizado:
// ANTES:
recordSuccess(latency: number, usage: any) { ... }

// DEPOIS:
recordSuccess(latency: number, _usage: any) { ... }
```

## Condições de Contorno e Tratamento de Exception

### Boundary Conditions:
- **Sem Internet**: Fallback para provedor local automaticamente
- **WaveSpeedAI Indisponível**: Orquestrador escolhe próximo provedor por prioridade
- **Formatos de Imagem**: Gateway valida input antes de processar
- **Timeout**: Circuit breaker protege contra provedores lentos

### Exception Handling:
- **ProviderException**: Log detalhado e métricas de falha
- **NetworkError**: Retry com backoff exponencial
- **ValidationError**: Feedback claro para usuário
- **GatewayError**: Fallback para modo mais básico

## Data Flow Paths

### Fluxo Ideal (WaveSpeedAI disponível):
```
Frontend → Gateway → WaveSpeedAI Provider → Processing → Base64 Image → Frontend
```

### Fluxo Fallback (WaveSpeedAI indisponível):
```
Frontend → Gateway → AlibabaQwen → TencentHunyuan → HuaweiPangu → FallbackLocal → Processing → Frontend
```

### Fluxo Métricas:
```
Provider Usage → Metrics Recorder → Analytics Dashboard
```

## Resultados Esperados

### Funcionais:
- **1 fonte de verdade** para simulação visual (gateway)
- **Fallback consistente** multi-níveis
- **Métricas unificadas** de performance
- **Manutenção simplificada** (1 provedor vs 3 sistemas)

### Técnicos:
- **Build limpa** (0 erros TypeScript)
- **CLI funcional** sem conflitos
- **Frontend responsivo** com nova arquitetura
- **Testes passando** com cobertura adequada