# 🇨🇳 Pesquisa Chinesa para EscapeKit - Arsenal de Melhorias

## Regra de ouro
> Só implemente uma melhoria se uma métrica real indicar necessidade.

## 1. Segmentação semântica (AKAFs)
- **Paper**: WACV 2025 - Architectural-Knowledge-Aware Features
- **Impacto**: +5% precisão na detecção de paredes, pisos, obstáculos
- **Gatilho**: Acurácia do `detectRoomContext` < 85% em 3 lotes consecutivos
- **Código de referência**: [link para repo ou implementação]
- **Tempo estimado**: 2-3 dias

## 2. Inpainting híbrido (CNN + Transformer)
- **Paper**: Buildings MDPI 2025 - Image Completion Network
- **Impacto**: Preserva sombras e objetos, reduz vazamentos
- **Gatilho**: Reclamação de "simulação irrealista" > 5% dos usuários ou nível de fidelidade médio < 1.5
- **Código de referência**: [link]
- **Tempo estimado**: 3-5 dias

## 3. Geração panorâmica (CSD-Pano)
- **Paper**: Buildings MDPI 2025 - Controllable Stable Diffusion for Panoramic
- **Impacto**: Simulações 360° com coerência estilística
- **Gatilho**: Demanda de lojistas por visualização imersiva (survey ou vendas diretas)
- **Tempo estimado**: 1 semana

## 4. Edge AI (chip M50 da Houmo)
- **Hardware**: Processamento local com 10W, 160 TOPS
- **Impacto**: Reduz custo de cloud e latência
- **Gatilho**: Custo mensal de API > R$ 2.000 ou latência média > 8s
- **Tempo estimado**: 2 semanas (integração)

## 5. Geração 3D (WorldGrow, HouseCrafter, etc.)
- **Impacto**: Simulação imersiva de ambientes completos
- **Gatilho**: Concorrente direto lançar recurso 3D pago e ganhar market share
- **Tempo estimado**: 1-2 meses

---

# 📊 Métricas Atuais do Sistema (Baseline)

## Metas de Performance
- **Acurácia detectRoomContext**: > 85% (baseline a ser medida)
- **Fidelidade simulação**: Nível 2+ em escala 1-4
- **Latência API**: < 8s para análise completa
- **Custo mensal**: < R$ 2.000 em serviços de IA

## Gatilhos Automáticos
Quando qualquer métrica acima ultrapassar o limite, consultar este arsenal para solução mais adequada.

---

**Última atualização**: 2026-04-06  
**Status**: Sistema funcional - arsenal estratégico para otimizações futuras