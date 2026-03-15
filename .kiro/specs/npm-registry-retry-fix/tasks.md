# Implementation Plan: NPM Registry Retry Fix

## Overview

Este plano implementa correções na lógica de retry do NPMRegistry para garantir que erros HTTP 500 sejam retentados corretamente com exponential backoff, enquanto erros HTTP 404 não sejam retentados. O sistema deve degradar graciosamente após todas as tentativas falharem, rastreando status apropriados e cacheando apenas resultados definitivos.

## Tasks

- [x] 1. Corrigir lógica de retry no método `retryOperation`
  - [x] 1.1 Implementar detecção correta de erros retryable vs non-retryable
    - Verificar tipo de erro (PackageNotFoundError = non-retryable, NPMRegistryError/TimeoutError = retryable)
    - Retornar imediatamente para PackageNotFoundError sem retry
    - Implementar retry loop para erros retryable
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 9.5_
  
  - [ ]* 1.2 Escrever property test para retry de HTTP 500
    - **Property 1: HTTP 500 Errors Trigger Retry**
    - **Validates: Requirements 1.1, 1.2**
  
  - [ ]* 1.3 Escrever property test para não retry de HTTP 404
    - **Property 4: HTTP 404 Errors Do Not Trigger Retry**
    - **Validates: Requirements 2.1, 2.2**
  
  - [ ]* 1.4 Escrever property test para retry de network errors
    - **Property 7: Network Errors Trigger Retry**
    - **Validates: Requirements 3.1, 3.2**

- [x] 2. Implementar exponential backoff correto
  - [x] 2.1 Corrigir cálculo de delay entre tentativas
    - Implementar fórmula: `delay = initialRetryDelay * Math.pow(2, attemptNumber)`
    - Garantir que primeira retry use initialRetryDelay
    - Garantir que segunda retry use initialRetryDelay * 2
    - Adicionar await para delay antes de cada retry
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  
  - [x] 2.2 Garantir contagem correta de tentativas
    - Total de tentativas deve ser `maxRetries + 1` (tentativa inicial + maxRetries)
    - Implementar loop que executa exatamente maxRetries vezes após tentativa inicial
    - _Requirements: 4.4_
  
  - [ ]* 2.3 Escrever property test para exponential backoff
    - **Property 10: Exponential Backoff Formula**
    - **Validates: Requirements 4.3, 4.5**
  
  - [ ]* 2.4 Escrever property test para contagem de tentativas
    - **Property 11: Total Attempt Count**
    - **Validates: Requirements 4.4**

- [x] 3. Implementar graceful degradation
  - [x] 3.1 Modificar `retryOperation` para retornar valores padrão ao invés de lançar exceções
    - Capturar erros após todas as tentativas falharem
    - Retornar valor padrão apropriado (false para existence, 'unknown' para version)
    - Adicionar logging de warning com detalhes do erro
    - Não cachear resultados de falhas temporárias
    - _Requirements: 1.4, 1.5, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 3.2 Escrever property test para graceful degradation após HTTP 500
    - **Property 3: Graceful Degradation After HTTP 500 Retries**
    - **Validates: Requirements 1.4, 1.5, 6.1, 6.2**
  
  - [ ]* 3.3 Escrever property test para graceful degradation após network errors
    - **Property 9: Graceful Degradation After Network Errors**
    - **Validates: Requirements 3.4, 3.5**
  
  - [ ]* 3.4 Escrever property test para logging de graceful degradation
    - **Property 18: Graceful Degradation Logging**
    - **Validates: Requirements 6.3**

- [x] 4. Checkpoint - Verificar retry logic básico
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Corrigir error handling em `checkPackageExistence`
  - [x] 5.1 Garantir que HTTP 500+ lance NPMRegistryError
    - Verificar se status >= 500 lança NPMRegistryError
    - Incluir packageName e operation no contexto do erro
    - _Requirements: 1.3, 9.1_
  
  - [x] 5.2 Garantir que HTTP 404 lance PackageNotFoundError
    - Verificar se status === 404 lança PackageNotFoundError
    - Incluir packageName no contexto do erro
    - _Requirements: 2.3, 9.2_
  
  - [x] 5.3 Converter AbortError em TimeoutError
    - Capturar erros com name === 'AbortError'
    - Lançar TimeoutError com contexto apropriado
    - _Requirements: 3.3, 9.3_
  
  - [ ]* 5.4 Escrever property test para NPMRegistryError em HTTP 500
    - **Property 2: HTTP 500 Errors Throw NPMRegistryError**
    - **Validates: Requirements 1.3**
  
  - [ ]* 5.5 Escrever property test para PackageNotFoundError em HTTP 404
    - **Property 5: HTTP 404 Errors Throw PackageNotFoundError**
    - **Validates: Requirements 2.3**
  
  - [ ]* 5.6 Escrever property test para conversão de AbortError
    - **Property 8: AbortError Converted to TimeoutError**
    - **Validates: Requirements 3.3**

- [x] 6. Corrigir error handling em `fetchPackageVersion`
  - [x] 6.1 Garantir que HTTP 500+ lance NPMRegistryError
    - Verificar se status >= 500 lança NPMRegistryError
    - Incluir packageName e operation no contexto do erro
    - _Requirements: 1.3, 9.1_
  
  - [x] 6.2 Garantir que HTTP 404 lance PackageNotFoundError
    - Verificar se status === 404 lança PackageNotFoundError
    - Incluir packageName no contexto do erro
    - _Requirements: 2.3, 9.2_
  
  - [x] 6.3 Converter AbortError em TimeoutError
    - Capturar erros com name === 'AbortError'
    - Lançar TimeoutError com contexto apropriado
    - _Requirements: 3.3, 9.3_

- [x] 7. Implementar cache inteligente
  - [x] 7.1 Modificar `packageExists` para cachear apenas resultados definitivos
    - Cachear quando resultado é true (FOUND) ou false com status NOT_FOUND
    - Não cachear quando graceful degradation ocorre (network errors, timeouts, HTTP 500)
    - _Requirements: 2.4, 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 7.2 Modificar `getLatestVersion` para cachear apenas resultados definitivos
    - Cachear quando resultado é versão válida ou 'unknown' com status NOT_FOUND
    - Não cachear quando graceful degradation ocorre
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 7.3 Escrever property test para cache de HTTP 404
    - **Property 6: HTTP 404 Results Are Cached**
    - **Validates: Requirements 2.4, 8.1**
  
  - [ ]* 7.4 Escrever property test para não cache de erros temporários
    - **Property 19: Failed Results Not Cached**
    - **Validates: Requirements 6.4**
  
  - [ ]* 7.5 Escrever property test para cache apenas de resultados definitivos
    - **Property 25: Cache Only Definitive Results**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

- [x] 8. Implementar status tracking correto
  - [x] 8.1 Modificar `checkPackages` para determinar status apropriado
    - FOUND: quando pacote existe (HTTP 200)
    - NOT_FOUND: quando HTTP 404
    - UNVERIFIED_NETWORK_ERROR: quando network errors persistem após retries
    - UNVERIFIED_TIMEOUT: quando timeout errors persistem após retries
    - BUILTIN: quando é módulo builtin do Node.js
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ]* 8.2 Escrever property test para status FOUND
    - **Property 12: Status Tracking for Found Packages**
    - **Validates: Requirements 5.1**
  
  - [ ]* 8.3 Escrever property test para status NOT_FOUND
    - **Property 13: Status Tracking for Not Found Packages**
    - **Validates: Requirements 5.2**
  
  - [ ]* 8.4 Escrever property test para status UNVERIFIED_NETWORK_ERROR
    - **Property 14: Status Tracking for Network Errors**
    - **Validates: Requirements 5.3**
  
  - [ ]* 8.5 Escrever property test para status UNVERIFIED_TIMEOUT
    - **Property 15: Status Tracking for Timeout Errors**
    - **Validates: Requirements 5.4**
  
  - [ ]* 8.6 Escrever property test para status BUILTIN
    - **Property 16: Status Tracking for Builtin Modules**
    - **Validates: Requirements 5.5**

- [x] 9. Checkpoint - Verificar error handling e status tracking
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implementar suporte a configuração de retry
  - [x] 10.1 Verificar comportamento quando enableRetry é false
    - Quando enableRetry=false, fazer apenas 1 tentativa
    - Retornar valor padrão imediatamente em caso de erro
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [x] 10.2 Verificar que maxRetries controla número de tentativas
    - Número total de tentativas deve ser maxRetries + 1
    - _Requirements: 7.3_
  
  - [x] 10.3 Verificar que initialRetryDelay controla delays
    - Primeiro delay deve ser initialRetryDelay
    - Delays subsequentes devem seguir exponential backoff
    - _Requirements: 7.4_
  
  - [ ]* 10.4 Escrever property test para enableRetry configuration
    - **Property 21: EnableRetry Configuration**
    - **Validates: Requirements 7.1, 7.2**
  
  - [ ]* 10.5 Escrever property test para maxRetries configuration
    - **Property 22: MaxRetries Configuration**
    - **Validates: Requirements 7.3**
  
  - [ ]* 10.6 Escrever property test para initialRetryDelay configuration
    - **Property 23: InitialRetryDelay Configuration**
    - **Validates: Requirements 7.4**

- [x] 11. Implementar logging apropriado
  - [x] 11.1 Adicionar logging de tentativas de retry
    - Log warning com número da tentativa e delay
    - Incluir packageName e operation
    - _Requirements: 10.1_
  
  - [x] 11.2 Adicionar logging de falhas finais
    - Log warning quando todas as tentativas falharem
    - Incluir detalhes do erro final
    - _Requirements: 10.2_
  
  - [x] 11.3 Adicionar logging de erros non-retryable
    - Log debug explicando por que erro não é retentado
    - Incluir tipo de erro
    - _Requirements: 10.4_
  
  - [x] 11.4 Garantir que logs incluem mensagens de erro
    - Todos os logs de erro devem incluir error.message
    - _Requirements: 10.5_
  
  - [ ]* 11.5 Escrever unit tests para logging
    - Verificar que logs são gerados nos momentos corretos
    - Verificar conteúdo dos logs

- [x] 12. Garantir processamento contínuo em `checkPackages`
  - [x] 12.1 Modificar `checkPackages` para continuar após falhas
    - Usar Promise.allSettled ou try-catch individual
    - Retornar PackageInfo para todos os pacotes, mesmo os que falharam
    - _Requirements: 6.5_
  
  - [ ]* 12.2 Escrever property test para processamento contínuo
    - **Property 20: Continue Processing After Failure**
    - **Validates: Requirements 6.5**

- [x] 13. Escrever unit tests complementares
  - [ ]* 13.1 Escrever unit tests para casos específicos de sucesso
    - Pacote encontrado com versão válida
    - Pacote não encontrado (HTTP 404)
    - Módulo builtin
  
  - [ ]* 13.2 Escrever unit tests para edge cases
    - Package names vazios
    - Package names com caracteres especiais
    - Cache expiration
    - Múltiplos pacotes em paralelo
  
  - [ ]* 13.3 Escrever unit tests para integração entre métodos
    - packageExists + getLatestVersion para mesmo pacote
    - checkPackages com mix de pacotes válidos e inválidos

- [x] 14. Final checkpoint - Executar todos os testes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requirements específicos para rastreabilidade
- Property tests validam propriedades universais de correção
- Unit tests validam exemplos específicos e edge cases
- Checkpoints garantem validação incremental
- Implementação usa TypeScript conforme código existente
