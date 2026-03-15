# Requirements Document

## Introduction

O NPMRegistry service é responsável por verificar a existência de pacotes npm e obter suas versões mais recentes. O serviço implementa lógica de retry com exponential backoff para lidar com falhas temporárias de rede. Este documento especifica os requisitos para corrigir e melhorar a lógica de retry, garantindo que erros HTTP 500 sejam retentados corretamente, enquanto erros 404 não sejam retentados, e que o sistema degrade graciosamente após todas as tentativas falharem.

## Glossary

- **NPMRegistry**: Serviço que consulta o registro npm para verificar existência de pacotes e obter versões
- **Retry_Logic**: Mecanismo que reexecuta operações falhadas com delays exponenciais entre tentativas
- **HTTP_500_Error**: Erro de servidor que indica falha temporária que pode ser recuperada com retry
- **HTTP_404_Error**: Erro que indica que um recurso não foi encontrado (definitivo, não deve ser retentado)
- **Network_Error**: Erro de conectividade de rede (timeout, DNS failure, connection refused)
- **Exponential_Backoff**: Estratégia de retry onde o delay entre tentativas aumenta exponencialmente
- **PackageInfo**: Objeto contendo informações sobre um pacote (name, version, exists, status)
- **Status**: Estado de verificação de um pacote (FOUND, NOT_FOUND, UNVERIFIED_NETWORK_ERROR, UNVERIFIED_TIMEOUT, BUILTIN)

## Requirements

### Requirement 1: Retry HTTP 500 Errors

**User Story:** Como desenvolvedor, eu quero que erros HTTP 500 sejam retentados automaticamente, para que falhas temporárias de servidor não causem falsos negativos na verificação de pacotes.

#### Acceptance Criteria

1. WHEN an HTTP 500 error occurs during package existence check, THE Retry_Logic SHALL retry the operation up to maxRetries times
2. WHEN an HTTP 500 error occurs during version query, THE Retry_Logic SHALL retry the operation up to maxRetries times
3. WHEN an HTTP 500 error is encountered, THE Retry_Logic SHALL throw NPMRegistryError to signal a retryable error
4. WHEN HTTP 500 errors persist after all retries, THE NPMRegistry SHALL return false for existence checks
5. WHEN HTTP 500 errors persist after all retries, THE NPMRegistry SHALL return 'unknown' for version queries

### Requirement 2: Do Not Retry HTTP 404 Errors

**User Story:** Como desenvolvedor, eu quero que erros HTTP 404 não sejam retentados, para que o sistema não desperdice tempo tentando encontrar pacotes que definitivamente não existem.

#### Acceptance Criteria

1. WHEN an HTTP 404 error occurs during package existence check, THE NPMRegistry SHALL return false immediately without retrying
2. WHEN an HTTP 404 error occurs during version query, THE NPMRegistry SHALL return 'unknown' immediately without retrying
3. WHEN an HTTP 404 error is encountered, THE NPMRegistry SHALL throw PackageNotFoundError to signal a non-retryable error
4. WHEN an HTTP 404 response is received, THE NPMRegistry SHALL cache the result with status 'NOT_FOUND'

### Requirement 3: Retry Network Errors

**User Story:** Como desenvolvedor, eu quero que erros de rede sejam retentados automaticamente, para que problemas temporários de conectividade não causem falhas na verificação de pacotes.

#### Acceptance Criteria

1. WHEN a network error occurs during package existence check, THE Retry_Logic SHALL retry the operation up to maxRetries times
2. WHEN a network error occurs during version query, THE Retry_Logic SHALL retry the operation up to maxRetries times
3. WHEN a timeout error (AbortError) occurs, THE Retry_Logic SHALL convert it to TimeoutError and retry
4. WHEN network errors persist after all retries, THE NPMRegistry SHALL return false for existence checks
5. WHEN network errors persist after all retries, THE NPMRegistry SHALL return 'unknown' for version queries

### Requirement 4: Exponential Backoff Implementation

**User Story:** Como desenvolvedor, eu quero que o sistema use exponential backoff entre retries, para que o servidor tenha tempo adequado para se recuperar de falhas temporárias.

#### Acceptance Criteria

1. WHEN the first retry is attempted, THE Retry_Logic SHALL wait initialRetryDelay milliseconds
2. WHEN the second retry is attempted, THE Retry_Logic SHALL wait initialRetryDelay * 2 milliseconds
3. WHEN the nth retry is attempted, THE Retry_Logic SHALL wait initialRetryDelay * 2^(n-1) milliseconds
4. THE Retry_Logic SHALL perform exactly maxRetries + 1 total attempts (initial attempt + maxRetries)
5. WHEN exponential backoff is calculated, THE Retry_Logic SHALL use the formula: delay = initialRetryDelay * Math.pow(2, attemptNumber)

### Requirement 5: Status Tracking for Failed Operations

**User Story:** Como desenvolvedor, eu quero que o sistema rastreie o status de verificações falhadas, para que eu possa distinguir entre pacotes não encontrados e erros de rede.

#### Acceptance Criteria

1. WHEN a package is found successfully, THE NPMRegistry SHALL set status to 'FOUND'
2. WHEN a package returns HTTP 404, THE NPMRegistry SHALL set status to 'NOT_FOUND'
3. WHEN network errors persist after all retries, THE NPMRegistry SHALL set status to 'UNVERIFIED_NETWORK_ERROR'
4. WHEN timeout errors persist after all retries, THE NPMRegistry SHALL set status to 'UNVERIFIED_TIMEOUT'
5. WHEN a Node.js builtin module is checked, THE NPMRegistry SHALL set status to 'BUILTIN'
6. THE NPMRegistry SHALL include status in PackageInfo objects returned by checkPackages method

### Requirement 6: Graceful Degradation

**User Story:** Como desenvolvedor, eu quero que o sistema degrade graciosamente após falhas, para que a aplicação continue funcionando mesmo quando o registro npm está inacessível.

#### Acceptance Criteria

1. WHEN all retry attempts fail for existence check, THE NPMRegistry SHALL return false instead of throwing an error
2. WHEN all retry attempts fail for version query, THE NPMRegistry SHALL return 'unknown' instead of throwing an error
3. WHEN graceful degradation occurs, THE NPMRegistry SHALL log a warning with error details
4. WHEN graceful degradation occurs, THE NPMRegistry SHALL NOT cache the failed result
5. THE NPMRegistry SHALL allow the application to continue processing other packages after a failure

### Requirement 7: Retry Configuration

**User Story:** Como desenvolvedor, eu quero poder configurar o comportamento de retry, para que eu possa ajustar o sistema para diferentes ambientes e requisitos.

#### Acceptance Criteria

1. WHERE enableRetry is true, THE NPMRegistry SHALL use retry logic for failed operations
2. WHERE enableRetry is false, THE NPMRegistry SHALL NOT retry failed operations
3. THE NPMRegistry SHALL accept maxRetries configuration parameter to control number of retry attempts
4. THE NPMRegistry SHALL accept initialRetryDelay configuration parameter to control base delay between retries
5. WHEN enableRetry is false and an operation fails, THE NPMRegistry SHALL return default values immediately

### Requirement 8: Cache Behavior for Failed Operations

**User Story:** Como desenvolvedor, eu quero que o sistema cache apenas resultados definitivos, para que falhas temporárias não sejam tratadas como permanentes.

#### Acceptance Criteria

1. WHEN an HTTP 404 response is received, THE NPMRegistry SHALL cache the result
2. WHEN a successful response is received, THE NPMRegistry SHALL cache the result
3. WHEN network errors occur, THE NPMRegistry SHALL NOT cache the result
4. WHEN timeout errors occur, THE NPMRegistry SHALL NOT cache the result
5. WHEN HTTP 500 errors persist after retries, THE NPMRegistry SHALL NOT cache the result

### Requirement 9: Error Type Differentiation

**User Story:** Como desenvolvedor, eu quero que o sistema diferencie entre tipos de erros, para que a lógica de retry possa tomar decisões apropriadas.

#### Acceptance Criteria

1. WHEN an HTTP 500 error occurs, THE NPMRegistry SHALL throw NPMRegistryError
2. WHEN an HTTP 404 error occurs, THE NPMRegistry SHALL throw PackageNotFoundError
3. WHEN a timeout occurs, THE NPMRegistry SHALL throw TimeoutError
4. WHEN a generic network error occurs, THE NPMRegistry SHALL throw NPMRegistryError
5. THE Retry_Logic SHALL check error type to determine if retry is appropriate

### Requirement 10: Logging and Observability

**User Story:** Como desenvolvedor, eu quero que o sistema registre informações sobre retries e falhas, para que eu possa diagnosticar problemas de conectividade.

#### Acceptance Criteria

1. WHEN a retry is attempted, THE NPMRegistry SHALL log a warning with attempt number and delay
2. WHEN all retries fail, THE NPMRegistry SHALL log a warning with final error details
3. WHEN graceful degradation occurs, THE NPMRegistry SHALL log the operation name and package name
4. WHEN an error is not retryable, THE NPMRegistry SHALL log a debug message explaining why
5. THE NPMRegistry SHALL include error messages in log entries for debugging purposes
