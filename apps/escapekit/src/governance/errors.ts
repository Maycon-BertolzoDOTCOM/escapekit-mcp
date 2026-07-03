/**
 * CodeMemória Governance — Error Hierarchy
 *
 * @module governance/errors
 */

/** Erro base da camada de governança */
export class GovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GovernanceError';
  }
}

/** Erro de validação de entidades (score fora de [0,1], complexity negativa, etc.) */
export class GovernanceValidationError extends GovernanceError {
  constructor(message: string) {
    super(message);
    this.name = 'GovernanceValidationError';
  }
}

/** Erro de inicialização de um adaptador na factory createGovernanceStack() */
export class GovernanceInitError extends GovernanceError {
  constructor(message: string) {
    super(message);
    this.name = 'GovernanceInitError';
  }
}

/** Erro de escrita no AuditLogger (falha de I/O ao persistir entrada de auditoria) */
export class AuditWriteError extends GovernanceError {
  constructor(message: string) {
    super(message);
    this.name = 'AuditWriteError';
  }
}

/** Erro de colisão de passportId no HybridMemoryAdapter */
export class DuplicatePassportError extends GovernanceError {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicatePassportError';
  }
}

/** Erro lançado quando epsilon <= 0 é fornecido ao mecanismo de privacidade diferencial */
export class InvalidPrivacyParameterError extends GovernanceError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPrivacyParameterError';
  }
}

/** Erro lançado quando a resposta do FederatedMemoryServer não pode ser parseada */
export class FederatedResponseParseError extends GovernanceError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FederatedResponseParseError';
  }
}
