/**
 * Testes para Contract Validator
 * Testa validação de estrutura YAML de contratos factuais
 */

import { describe, it, expect } from 'vitest';
import { ContractValidator } from '../src/engines/contract-validator.js';
import {
  mockValidContract,
  mockInvalidContract,
  mockContractMissingSections,
} from './mocks.js';

describe('ContractValidator', () => {
  let validator: ContractValidator;

  beforeEach(() => {
    validator = new ContractValidator();
  });

  describe('validate', () => {
    it('deve validar contrato bem formado e completo', () => {
      const result = validator.validate(mockValidContract);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('deve apontar erros para YAML com campos faltando', () => {
      const result = validator.validate(mockContractMissingSections);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('facts'));
      expect(result.errors).toContainEqual(expect.stringContaining('patterns'));
      expect(result.errors).toContainEqual(expect.stringContaining('rules'));
      expect(result.errors).toContainEqual(expect.stringContaining('cases'));
    });

    it('deve lançar exceção tratada para YAML mal formatado', () => {
      const invalidYaml = `source:
  title: "Invalid
  year: not-a-number
facts: invalid`;

      const result = validator.validate(invalidYaml);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Erro de sintaxe YAML')
      );
    });

    it('deve validar estrutura de facts', () => {
      const contractWithInvalidFacts = `source:
  title: "Test"
facts:
  - id: "F001"
    # statement faltando
  - statement: "Missing id"
patterns: []
rules: []
cases: []`;

      const result = validator.validate(contractWithInvalidFacts);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Fact['));
    });

    it('deve validar tipos de fact', () => {
      const contractWithInvalidType = `source:
  title: "Test"
facts:
  - id: "F001"
    statement: "Test"
    type: "invalid_type"
patterns: []
rules: []
cases: []`;

      const result = validator.validate(contractWithInvalidType);

      expect(result.warnings).toContainEqual(
        expect.stringContaining("tipo 'invalid_type' desconhecido")
      );
    });

    it('deve validar relevância de fact', () => {
      const contractWithInvalidRelevance = `source:
  title: "Test"
facts:
  - id: "F001"
    statement: "Test"
    relevance: "invalid_relevance"
patterns: []
rules: []
cases: []`;

      const result = validator.validate(contractWithInvalidRelevance);

      expect(result.warnings).toContainEqual(
        expect.stringContaining("relevância 'invalid_relevance' desconhecida")
      );
    });

    it('deve validar estrutura de patterns', () => {
      const contractWithInvalidPatterns = `source:
  title: "Test"
facts: []
patterns:
  - description: "Missing id"
rules: []
cases: []`;

      const result = validator.validate(contractWithInvalidPatterns);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Pattern['));
    });

    it('deve validar estrutura de rules', () => {
      const contractWithInvalidRules = `source:
  title: "Test"
facts: []
patterns: []
rules:
  - principle: "Missing id"
cases: []`;

      const result = validator.validate(contractWithInvalidRules);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Rule['));
    });

    it('deve validar ação de rule', () => {
      const contractWithInvalidAction = `source:
  title: "Test"
facts: []
patterns: []
rules:
  - id: "R001"
    principle: "Test"
    action: "invalid_action"
cases: []`;

      const result = validator.validate(contractWithInvalidAction);

      expect(result.warnings).toContainEqual(
        expect.stringContaining("ação 'invalid_action' desconhecida")
      );
    });

    it('deve validar prioridade de rule', () => {
      const contractWithInvalidPriority = `source:
  title: "Test"
facts: []
patterns: []
rules:
  - id: "R001"
    principle: "Test"
    action: "implement_detector"
    priority: "invalid_priority"
cases: []`;

      const result = validator.validate(contractWithInvalidPriority);

      expect(result.warnings).toContainEqual(
        expect.stringContaining("prioridade 'invalid_priority' desconhecida")
      );
    });

    it('deve validar estrutura de cases', () => {
      const contractWithInvalidCases = `source:
  title: "Test"
facts: []
patterns: []
rules: []
cases:
  - description: "Missing id"`;

      const result = validator.validate(contractWithInvalidCases);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Case['));
    });

    it('deve validar consistência de referências cruzadas (patterns)', () => {
      const contractWithInvalidReference = `source:
  title: "Test"
facts: []
patterns:
  - id: "P001"
    description: "Test"
rules:
  - id: "R001"
    principle: "Test"
    derived_from: ["P999"]
cases: []`;

      const result = validator.validate(contractWithInvalidReference);

      expect(result.warnings).toContainEqual(
        expect.stringContaining("referencia pattern inexistente 'P999'")
      );
    });

    it('deve validar consistência de referências cruzadas (facts)', () => {
      const contractWithInvalidFactReference = `source:
  title: "Test"
facts:
  - id: "F001"
    statement: "Test"
patterns: []
rules: []
cases:
  - id: "C001"
    description: "Test"
    related_facts: ["F999"]`;

      const result = validator.validate(contractWithInvalidFactReference);

      expect(result.warnings).toContainEqual(
        expect.stringContaining("referencia fact inexistente 'F999'")
      );
    });

    it('deve validar múltiplos erros simultaneamente', () => {
      // YAML com múltiplos erros
      const yamlComErros = `source:
  title: "Invalid"
facts: "not an array"
patterns:
  - description: "missing id"
rules: []
cases: []`;

      const result = validator.validate(yamlComErros);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('deve retornar warnings para campos opcionais faltando', () => {
      const contractMinimal = `source:
  title: "Minimal"
facts:
  - id: "F001"
patterns:
  - id: "P001"
rules:
  - id: "R001"
    principle: "Test"
cases:
  - id: "C001"`;

      const result = validator.validate(contractMinimal);

      // Deve ter warnings para campos faltando, mas ainda ser válido
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('cenários de uso real', () => {
    it('deve validar contrato do exemplo do README', () => {
      const exampleContract = `source:
  title: "Compatibility at a Cost: MCP Clause-Compliance Vulnerabilities"
  authors: "Nanzi Yang; et al."
  year: 2026
  url: "https://arxiv.org/abs/2603.10163"
  doi: "arXiv:2603.10163"

facts:
  - id: "F001"
    statement: "MCP SDKs relaxam restrições comportamentais em cláusulas opcionais"
    type: "fact"
    relevance: "security"

patterns:
  - id: "P001"
    description: "Vulnerabilidades ocorrem em múltiplas linguagens"
    evidence: ["F001"]
    confidence: "high"

rules:
  - id: "R001"
    principle: "Toda cláusula opcional deve ter implementação segura"
    derived_from: ["P001"]
    action: "implement_detector"
    detector_name: "MCPComplianceAnalyzer"
    priority: "high"

cases:
  - id: "C001"
    description: "Injeção de prompt via mensagem malformada"
    attack_vector: "prompt_injection"
    mitigation: "Validação de entrada"

metadata:
  version: "1.0"
  status: "draft"
  tags: ["security", "mcp"]`;

      const result = validator.validate(exampleContract);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
