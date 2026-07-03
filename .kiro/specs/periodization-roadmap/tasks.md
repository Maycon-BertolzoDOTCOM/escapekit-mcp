# Plano de Implementação: Cadeia de Periodização CodeMemória

## Visão Geral

Implementação sequencial das 7 fases do roadmap CodeMemória, construindo sobre o núcleo existente (`GovernanceEngine`, `ComplianceCheckerAdapter`, `HybridMemoryAdapter`, `AuditLoggerAdapter`, `FederatedMemoryAdapter`, CLI). Cada fase depende da anterior.

Linguagem de implementação: **TypeScript** (extensão, action, dashboard, vector-memory, open core, demo) e **Python** (extensões do FederatedMemoryServer).

---

## Tasks

- [ ] 1. Fase 1 — VS Code Extension
  - [ ] 1.1 Criar estrutura do pacote `packages/vscode-extension/` com `package.json`, `tsconfig.json` e ponto de entrada `src/extension.ts`
    - Configurar `engines: { vscode: "^1.85.0" }` e dependências `@types/vscode`
    - Registrar comandos e eventos no `activate()`
    - _Requisitos: 1.1, 1.4, 1.7_

  - [ ] 1.2 Implementar `GovernanceBridge.ts` — wrapper que invoca `createGovernanceStack()` do core existente
    - Reutilizar exatamente a mesma lógica da CLI para garantir equivalência de passaportes
    - Implementar cache do último passaporte por arquivo (`getLastPassport`)
    - _Requisitos: 1.1, 1.7, 1.8_

  - [ ] 1.3 Implementar `DiagnosticsProvider.ts` — mapeia `GovernancePassport.validations` para VS Code Diagnostics API
    - Sublinhar trechos com `high`/`critical` risk usando `vscode.DiagnosticCollection`
    - Incluir cláusula de compliance e referência normativa na mensagem do diagnóstico
    - _Requisitos: 1.3, 1.5_

  - [ ] 1.4 Implementar `StatusBarItem.ts` — exibe Risk Score na barra de status com cor por nível
    - Atualizar em `onDidSaveTextDocument` e `onDidOpenTextDocument`
    - Manter último valor conhecido em caso de falha (Requisito 1.6)
    - _Requisitos: 1.2, 1.6_

  - [ ] 1.5 Implementar `PassportPanel.ts` — WebviewPanel que renderiza o GovernancePassport completo
    - Ativado pelo comando `CodeMemória: Analyze File`
    - Serializar passaporte como HTML/JSON no webview
    - _Requisito: 1.4_

  - [ ] 1.6 Integrar todos os componentes em `extension.ts` — wiring de eventos, comandos e tratamento de erros
    - Timeout de 3s com cancelamento e notificação não-bloqueante
    - _Requisitos: 1.2, 1.6_

  - [ ]* 1.7 Escrever testes unitários para `GovernanceBridge` e `DiagnosticsProvider`
    - Verificar que `GovernanceBridge` invoca `createGovernanceStack()` com os mesmos parâmetros que a CLI
    - Verificar notificação não-bloqueante quando `GovernanceEngine` lança exceção
    - _Requisitos: 1.6, 1.8_

  - [ ]* 1.8 Escrever teste de propriedade P1: Equivalência CLI/Extensão
    - **Propriedade 1: Equivalência CLI/Extensão**
    - `fc.property(fc.string(), code => passport_extension(code) deepEquals passport_cli(code))`
    - Verificar `riskLevel`, `complianceStamps` e `codeFingerprint.hash` idênticos
    - **Valida: Requisito 1.8**

  - [ ] 1.9 Checkpoint — garantir que todos os testes da Fase 1 passam antes de avançar
    - Verificar que a extensão analisa arquivo TypeScript real e produz passaporte idêntico à CLI
    - Perguntar ao usuário se há dúvidas antes de prosseguir para a Fase 2

- [ ] 2. Fase 2 — GitHub Action para Compliance Report em PRs
  - [ ] 2.1 Criar estrutura do pacote `packages/github-action/` com `action.yml`, `package.json` e `src/main.ts`
    - Definir inputs: `github-token`, `config-path`, `contracts-dir` em `action.yml`
    - Configurar `@actions/core`, `@actions/github` como dependências
    - _Requisitos: 2.1, 2.3_

  - [ ] 2.2 Implementar `ConfigLoader.ts` — lê `.codememoría.yml` com defaults seguros
    - Retornar `{ ignorePatterns: [], failureThreshold: 'high', contractIds: [] }` quando arquivo não existe
    - Logar aviso e usar defaults quando arquivo está malformado (não falhar o workflow)
    - _Requisitos: 2.7, 2.8_

  - [ ] 2.3 Implementar `CheckRunner.ts` — executa `GovernanceEngine` nos arquivos do diff do PR
    - Obter lista de arquivos modificados via GitHub API
    - Aplicar `ignorePatterns` do config antes de analisar
    - Calcular `riskLevel` médio agregado dos passaportes
    - _Requisitos: 2.2, 2.3, 2.4, 2.5_

  - [ ] 2.4 Implementar `PRCommentBuilder.ts` — monta comentário Markdown com badge SVG inline
    - Gerar badge SVG parametrizado por cor do risk level (sem serviço externo)
    - Incluir hash de integridade do Compliance_Report no comentário
    - _Requisitos: 2.2, 2.6, 2.9_

  - [ ] 2.5 Integrar em `main.ts` — wiring completo: config → diff → análise → comentário → check status
    - Definir check status `failure` para `high`/`critical`, `success` para `low`/`medium`
    - _Requisitos: 2.2, 2.4, 2.5_

  - [ ]* 2.6 Escrever testes unitários para `ConfigLoader` e `PRCommentBuilder`
    - Verificar que `ConfigLoader` retorna defaults quando arquivo não existe
    - Verificar que badge SVG é gerado inline sem chamada de rede externa
    - _Requisitos: 2.7, 2.8_

  - [ ]* 2.7 Escrever teste de propriedade P2: Verificabilidade Cross-Ambiente do Hash
    - **Propriedade 2: Verificabilidade Cross-Ambiente do Hash**
    - `fc.property(fc.array(fc.string()), files => hash_in_pr_comment === hash_from_cli(files))`
    - **Valida: Requisito 2.9**

  - [ ]* 2.8 Escrever teste de propriedade P3: Risk Level Determina Check Status
    - **Propriedade 3: Risk Level Determina Check Status**
    - `fc.property(passportArrayArb, passports => check_status(avg_risk(passports)) === expected_status(avg_risk(passports)))`
    - Verificar relação bidirecional e exaustiva para todos os níveis
    - **Valida: Requisitos 2.4, 2.5**

  - [ ]* 2.9 Escrever teste de propriedade P4: Configuração Padrão é Identidade
    - **Propriedade 4: Configuração Padrão é Identidade**
    - `fc.property(repoWithoutConfigArb, repo => behavior(repo, no_config) === behavior(repo, default_config))`
    - **Valida: Requisito 2.8**

  - [ ] 2.10 Checkpoint — garantir que todos os testes da Fase 2 passam antes de avançar
    - Verificar que a action processa diff simulado e posta comentário com hash verificável
    - Perguntar ao usuário se há dúvidas antes de prosseguir para a Fase 3

- [ ] 3. Fase 3 — CISO Dashboard
  - [ ] 3.1 Criar estrutura do pacote `packages/ciso-dashboard/` com Next.js 14 App Router
    - Configurar `app/layout.tsx`, `app/dashboard/page.tsx` e middleware de autenticação
    - Instalar `next-auth`, `recharts`, `@react-pdf/renderer`
    - _Requisitos: 3.1, 3.8_

  - [ ] 3.2 Implementar autenticação OAuth GitHub via NextAuth.js
    - Configurar provider GitHub em `app/api/auth/[...nextauth]/route.ts`
    - Middleware Next.js validando JWT em todas as rotas `/dashboard/*` e `/api/*`
    - _Requisito: 3.6_

  - [ ] 3.3 Adicionar novos endpoints ao `FederatedMemoryServer` Python
    - `GET /passports?repo={id}&since={iso}&severity={level}`
    - `GET /passports/{passport_id}`
    - `GET /repos` e `GET /repos/{id}/trend`
    - _Requisitos: 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.4 Implementar `lib/federatedClient.ts` — cliente HTTP tipado para o FederatedMemoryServer
    - Tratar indisponibilidade do servidor com banner de dados desatualizados (Requisito 3.7 implícito)
    - _Requisitos: 3.1, 3.3_

  - [ ] 3.5 Implementar componentes de UI: `RiskTrendChart.tsx`, `IssueTable.tsx` com filtros
    - Filtros por tipo, severidade, repositório e intervalo de datas
    - Alerta de "repositório sem auditoria recente" quando último passaporte > 30 dias
    - _Requisitos: 3.2, 3.4, 3.7_

  - [ ] 3.6 Implementar `PDFExporter.tsx` — exportação de relatório executivo com `@react-pdf/renderer`
    - Incluir sumário de risco, top 10 vulnerabilidades, tendência 90 dias e referências normativas
    - _Requisito: 3.5_

  - [ ]* 3.7 Escrever testes unitários para endpoints do FederatedMemoryServer e middleware de autenticação
    - Verificar alerta de "repositório sem auditoria recente" para passaporte > 30 dias
    - Verificar que rotas protegidas retornam 401 sem token OAuth válido
    - _Requisitos: 3.6, 3.7_

  - [ ]* 3.8 Escrever teste de propriedade P5: Rastreabilidade dos Dados do Dashboard
    - **Propriedade 5: Rastreabilidade dos Dados do Dashboard**
    - `fc.property(fc.array(passportArb), passports => all_dashboard_values_derived_from_verified_passports(passports))`
    - Verificar que contagens, risk scores e tendências derivam exclusivamente de passaportes com `chainHash` verificável
    - **Valida: Requisito 3.9**

  - [ ] 3.9 Checkpoint — garantir que todos os testes da Fase 3 passam antes de avançar
    - Verificar que o dashboard exibe dados de múltiplos repositórios com passaportes reais do FederatedServer
    - Perguntar ao usuário se há dúvidas antes de prosseguir para a Fase 4

- [ ] 4. Fase 4 — Memória Vetorial Local
  - [ ] 4.1 Criar estrutura do pacote `packages/vector-memory/` e implementar `QuantizationCodec.ts`
    - Quantização float32 → Int8: `q = clamp(round(v / scale + zero_point), -128, 127)`
    - Armazenar `scale` e `zero_point` por vetor para dequantização fiel
    - _Requisitos: 4.6, 4.8_

  - [ ] 4.2 Implementar `IndexedDBStore.ts` — persistência de `QuantizedVector` em IndexedDB/OPFS
    - Armazenar `passportId`, `data: Int8Array`, `scale`, `zeroPoint`, `lastAccessedAt`
    - _Requisitos: 4.1, 4.4_

  - [ ] 4.3 Implementar `LRUEvictionPolicy.ts` — eviction quando storage disponível < 100MB
    - Remover passaportes com menor `lastAccessedAt` até liberar espaço suficiente
    - _Requisito: 4.7_

  - [ ] 4.4 Implementar `WasmEmbeddingEngine.ts` — carrega modelo ONNX via `onnxruntime-web`
    - Detectar suporte a WebGPU e usar como backend primário; fallback automático para WASM
    - Modelo ONNX quantizado < 5MB em `wasm/embedding-model.onnx`
    - _Requisitos: 4.2, 4.5_

  - [ ] 4.5 Implementar `VectorMemoryAdapter.ts` — implementa `IHybridMemory` para browser/Node.js local
    - `save`: gera embedding → quantiza → persiste no `IndexedDBStore`
    - `recall`: busca top-5 por similaridade de cosseno em < 500ms para até 10.000 passaportes
    - Integrar `LRUEvictionPolicy` no fluxo de `save`
    - _Requisitos: 4.1, 4.3, 4.4, 4.7_

  - [ ]* 4.6 Escrever testes unitários para `QuantizationCodec` e fallback WASM
    - Round-trip para vetor de zeros e vetor de uns
    - Verificar que fallback WASM é ativado quando `navigator.gpu` é `undefined`
    - _Requisitos: 4.5, 4.8_

  - [ ]* 4.7 Escrever teste de propriedade P6: Fidelidade de Quantização
    - **Propriedade 6: Fidelidade de Quantização**
    - `fc.property(float32ArrayArb(384), v => Math.abs(cosine(v, dequantize(quantize(v))) - 1.0) < 0.001)`
    - **Valida: Requisito 4.8**

  - [ ]* 4.8 Escrever teste de propriedade P7: Soberania Vetorial
    - **Propriedade 7: Soberania Vetorial**
    - `fc.property(codeArb, code => no_network_calls_during(vectorMemory.save(code)) && no_network_calls_during(vectorMemory.recall(code)))`
    - Usar interceptação de `fetch`/`XMLHttpRequest` para verificar ausência de chamadas de rede
    - **Valida: Requisitos 4.1, 4.2, 4.4**

  - [ ]* 4.9 Escrever teste de propriedade P8: Compressão de Vetores
    - **Propriedade 8: Compressão de Vetores**
    - `fc.property(float32ArrayArb(384), v => byteSize(quantize(v)) <= 0.4 * byteSize(v))`
    - Verificar redução de pelo menos 60% no tamanho em bytes
    - **Valida: Requisito 4.6**

  - [ ]* 4.10 Escrever teste de propriedade P9: Eviction LRU Libera Espaço
    - **Propriedade 9: Eviction LRU Libera Espaço**
    - `fc.property(lowStorageStateArb, state => after_lru_eviction(state).usedBytes < state.usedBytes)`
    - **Valida: Requisito 4.7**

  - [ ] 4.11 Checkpoint — garantir que todos os testes da Fase 4 passam antes de avançar
    - Verificar que `VectorMemoryAdapter` busca 5 passaportes similares em base de 10.000 em < 500ms
    - Perguntar ao usuário se há dúvidas antes de prosseguir para a Fase 5

- [ ] 5. Fase 5 — Certificações Regulatórias
  - [ ] 5.1 Modificar `GovernanceEngine.ts` — validar algoritmos criptográficos FIPS 140-2
    - Lançar `FIPSViolationError` ao detectar uso de MD5 ou SHA-1 no código analisado
    - Garantir que o próprio engine usa apenas SHA-256/384/512 internamente
    - _Requisitos: 5.1, 5.9_

  - [ ] 5.2 Modificar `AuditLoggerAdapter.ts` — adicionar política de retenção configurável
    - Mínimo de 1 ano; configurável pelo administrador
    - Registrar todos os campos obrigatórios: ator, timestamp, operação, recurso, resultado
    - _Requisitos: 5.2, 5.4_

  - [ ] 5.3 Implementar `RBACMiddleware.ts` — controle de acesso por papel
    - Papéis: `viewer` (read:report), `analyst` (+ execute:analysis), `admin` (+ export:evidence, configure:system)
    - Bloquear acesso não autorizado, registrar no `AuditLoggerAdapter` e notificar admin
    - _Requisitos: 5.3, 5.7_

  - [ ] 5.4 Modificar `HybridMemoryAdapter.ts` — criptografia AES-256-GCM em repouso
    - Criptografar passaportes antes de persistir; descriptografar ao recuperar
    - Lançar `EncryptionError` em falha; não persistir passaporte não-criptografado
    - _Requisito: 5.6_

  - [ ] 5.5 Implementar `SOC2EvidenceExporter.ts` — exporta logs de acesso no formato SOC 2
    - Incluir relatórios de acesso, logs de mudança e inventário de ativos
    - _Requisito: 5.8_

  - [ ]* 5.6 Escrever testes unitários para `AuditLoggerAdapter`, `RBACMiddleware` e `SOC2EvidenceExporter`
    - Verificar rejeição de configuração de retenção < 1 ano
    - Verificar que acesso não autorizado bloqueia operação e registra no audit log
    - Verificar que `SOC2EvidenceExporter` produz relatório com todas as seções obrigatórias
    - _Requisitos: 5.2, 5.7, 5.8_

  - [ ]* 5.7 Escrever teste de propriedade P10: Conformidade Criptográfica FIPS
    - **Propriedade 10: Conformidade Criptográfica FIPS**
    - Inspeção estática via AST: `fc.property(sourceFileArb, src => no_forbidden_crypto_calls(src))`
    - Verificar ausência de `md5`, `sha1`, `createHash('md5')`, `createHash('sha1')` no código-fonte
    - **Valida: Requisitos 5.1, 5.9**

  - [ ]* 5.8 Escrever teste de propriedade P11: RBAC — Autorização por Papel
    - **Propriedade 11: RBAC — Autorização por Papel**
    - `fc.property(fc.tuple(actorArb, operationArb), ([actor, op]) => rbac.authorize(actor, op) === role_allows(rbac.getRole(actor), op))`
    - Cobrir todos os papéis e todas as operações definidas
    - **Valida: Requisito 5.3**

  - [ ]* 5.9 Escrever teste de propriedade P12: Completude do Log de Auditoria
    - **Propriedade 12: Completude do Log de Auditoria**
    - `fc.property(sensitiveOperationArb, op => audit_entry(op).hasAllFields(['actor', 'timestamp', 'operation', 'resource', 'result']))`
    - **Valida: Requisito 5.4**

  - [ ]* 5.10 Escrever teste de propriedade P13: Criptografia em Repouso Round-Trip
    - **Propriedade 13: Criptografia em Repouso Round-Trip**
    - `fc.property(passportArb, p => deserialize(decrypt(encrypt(serialize(p)))) deepEquals p)`
    - **Valida: Requisito 5.6**

  - [ ] 5.11 Checkpoint — garantir que todos os testes da Fase 5 passam antes de avançar
    - Verificar que `GovernanceEngine` rejeita código com MD5 lançando `FIPSViolationError`
    - Perguntar ao usuário se há dúvidas antes de prosseguir para a Fase 6

- [ ] 6. Fase 6 — Open Core Estratégico
  - [ ] 6.1 Criar pacote `@codememoría/governance` com licença Apache 2.0
    - Estrutura: `src/GovernanceEngine.ts`, `src/interfaces.ts`, `src/types.ts`
    - Exportar interfaces públicas: `IGovernanceEngine`, `IHybridMemory`, `IComplianceChecker`, `IAuditLogger`
    - _Requisitos: 6.1, 6.4_

  - [ ] 6.2 Implementar `EnterpriseFeatureError` e guards para módulos proprietários
    - `getPaperToContract()` e `getComponentPool()` lançam `EnterpriseFeatureError` com link de upgrade
    - Garantir que o bundle npm não contém código de `PaperToContract` ou `ComponentPool`
    - _Requisitos: 6.2, 6.3, 6.8_

  - [ ] 6.3 Implementar `telemetry/OptInTelemetry.ts` — telemetria opt-in
    - Coletar apenas: `version`, `analysisType`, `riskLevel` (sem código, sem fingerprint, sem PII)
    - Respeitar opt-out; não emitir eventos se usuário não consentiu
    - _Requisito: 6.7_

  - [ ] 6.4 Criar `CONTRIBUTING.md` e `CODE_OF_CONDUCT.md` no repositório open source
    - _Requisito: 6.6_

  - [ ]* 6.5 Escrever testes unitários para `EnterpriseFeatureError` e bundle check
    - Verificar que `EnterpriseFeatureError` é lançado ao acessar `PaperToContract` sem licença
    - Verificar que bundle npm não contém código proprietário (análise de exports)
    - _Requisitos: 6.2, 6.3, 6.8_

  - [ ]* 6.6 Escrever teste de propriedade P14: Extensibilidade via Injeção de Dependência
    - **Propriedade 14: Extensibilidade via Injeção de Dependência**
    - `fc.property(customAdapterArb, adapter => governanceEngine(adapter).govern(ctx) instanceof GovernancePassport)`
    - Verificar que adaptadores customizados válidos são aceitos sem modificação do core
    - **Valida: Requisitos 6.4, 6.5**

  - [ ]* 6.7 Escrever teste de propriedade P15: Privacidade da Telemetria
    - **Propriedade 15: Privacidade da Telemetria**
    - `fc.property(telemetryEventArb, event => Object.keys(event).every(k => ['version','analysisType','riskLevel'].includes(k)))`
    - Verificar ausência de `codeFingerprint`, `passportId` e dados identificáveis
    - **Valida: Requisito 6.7**

  - [ ]* 6.8 Escrever teste de propriedade P16: Retrocompatibilidade da API Pública
    - **Propriedade 16: Retrocompatibilidade da API Pública**
    - `fc.property(apiCallArb, call => compiles_with_v_prev(call) implies compiles_with_v_current(call))`
    - Usar snapshot de tipos da versão anterior para verificar ausência de breaking changes
    - **Valida: Requisito 6.9**

  - [ ] 6.9 Checkpoint — garantir que todos os testes da Fase 6 passam antes de avançar
    - Verificar que pacote npm instalado em projeto externo aceita adaptador customizado via DI
    - Perguntar ao usuário se há dúvidas antes de prosseguir para a Fase 7

- [ ] 7. Fase 7 — Case Study e Demo Browser
  - [ ] 7.1 Criar estrutura do pacote `packages/demo-browser/` com Vite + WASM
    - Configurar `vite.config.ts` com suporte a WASM, OPFS e Service Worker
    - Fallback para IndexedDB quando OPFS não disponível
    - _Requisitos: 7.4, 7.5_

  - [ ] 7.2 Implementar `DemoScenario.ts` — código sintético equivalente ao caso real
    - Definir `syntheticCode`, `expectedRiskLevel`, `expectedViolations` e `anonymizedPassportHash`
    - _Requisitos: 7.4, 7.6, 7.7_

  - [ ] 7.3 Implementar `PassportViewer.ts` — renderiza GovernancePassport no DOM
    - Exibir métricas quantitativas: tempo de detecção, número de violações, risk score, custo estimado
    - _Requisitos: 7.4, 7.6_

  - [ ] 7.4 Implementar `IntegrityVerifier.ts` — verifica hash SHA-256 do passaporte anonimizado
    - Comparar hash do `anonymized-passport.json` distribuído com o hash publicado no case study
    - Exibir aviso "Integridade do passaporte não verificada" em caso de divergência
    - _Requisitos: 7.3, 7.8_

  - [ ] 7.5 Integrar em `main.ts` — inicializar GovernanceEngine no browser e orquestrar o fluxo demo
    - Carregar `DemoScenario`, executar análise, exibir via `PassportViewer`, verificar via `IntegrityVerifier`
    - _Requisitos: 7.4, 7.5_

  - [ ]* 7.6 Escrever testes unitários para `IntegrityVerifier` e carregamento do demo
    - Verificar que `IntegrityVerifier` valida hash do passaporte anonimizado distribuído
    - Verificar que demo carrega e executa análise sem criar conta ou instalar software
    - _Requisitos: 7.3, 7.4_

  - [ ]* 7.7 Escrever teste de propriedade P17: Rastreabilidade de Claims Quantitativos
    - **Propriedade 17: Rastreabilidade de Claims Quantitativos**
    - `fc.property(passportArb, p => all_quantitative_claims_derivable_from_audit_trail(p))`
    - Verificar que tempo de detecção, violações, risk score e custo derivam de passaportes com `chainHash` verificável
    - **Valida: Requisito 7.8**

  - [ ] 7.8 Checkpoint final — garantir que todos os testes da Fase 7 passam
    - Verificar que demo browser executa análise completa offline e verifica hash do passaporte
    - Perguntar ao usuário se há dúvidas antes de considerar o roadmap completo

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental antes de avançar entre fases
- Testes de propriedade validam invariantes universais com mínimo de 100 iterações (`fast-check`)
- Testes unitários validam exemplos concretos e casos de borda
- A ordem das fases é estrita: cada fase só deve iniciar após o checkpoint da fase anterior
