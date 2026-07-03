/**
 * ComplianceCheckerAdapter — Verificação de compliance via contratos YAML
 *
 * Carrega contratos YAML do diretório especificado e verifica conformidade
 * do código contra as regras definidas nos contratos.
 *
 * @module governance/adapters/ComplianceCheckerAdapter
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import type { IComplianceChecker } from '../interfaces.js';
import type { ComplianceStamp } from '../types.js';

/** Estrutura de uma regra dentro do contrato YAML */
interface ContractRule {
  id: string;
  principle: string;
  action?: string;
  priority?: string;
  derived_from?: string[];
  detector_name?: string;
}

/** Estrutura do contrato YAML (compatível com qwen-escapekit) */
interface Contract {
  source?: {
    title?: string;
    authors?: string;
    year?: number;
    doi?: string;
  };
  facts?: Array<{ id: string; statement: string; type?: string; relevance?: string }>;
  patterns?: Array<{ id: string; description: string; evidence?: string[]; confidence?: string }>;
  rules?: ContractRule[];
  cases?: Array<{ id: string; description: string; attack_vector?: string; mitigation?: string; related_facts?: string[]; related_rules?: string[] }>;
  metadata?: { version?: string; status?: string; tags?: string[] };
}

/** Contrato carregado em memória com seu regulationId */
interface LoadedContract {
  regulationId: string;
  contract: Contract;
  filePath: string;
}

/**
 * Verifica se uma cláusula (principle) é satisfeita pelo código.
 *
 * Uma cláusula é satisfeita se pelo menos uma palavra significativa
 * do principle (>= 4 chars) aparece no código (case-insensitive).
 * Esta é uma heurística simples mas determinística.
 */
function isClauseSatisfied(principle: string, code: string): boolean {
  const codeLower = code.toLowerCase();
  const words = principle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.replace(/[^a-z0-9]/gi, '').length >= 4);

  if (words.length === 0) return false;

  return words.some((word) => {
    const clean = word.replace(/[^a-z0-9]/gi, '');
    return clean.length >= 4 && codeLower.includes(clean);
  });
}

/**
 * Deriva o regulationId de um contrato a partir de source.title ou nome do arquivo.
 */
function deriveRegulationId(contract: Contract, filePath: string): string {
  if (contract.source?.title && contract.source.title.trim().length > 0) {
    return contract.source.title.trim();
  }
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Implementa IComplianceChecker carregando contratos YAML e verificando
 * conformidade do código contra as regras definidas.
 */
export class ComplianceCheckerAdapter implements IComplianceChecker {
  private readonly contractsDir: string;
  private readonly contracts: Map<string, LoadedContract> = new Map();

  constructor(contractsDir: string) {
    this.contractsDir = contractsDir;
    this._loadContractsFromDir();
  }

  /**
   * Carrega automaticamente todos os arquivos .yaml do contractsDir na inicialização.
   * Se o diretório não existir ou estiver vazio, loga aviso e continua.
   */
  private _loadContractsFromDir(): void {
    if (!fs.existsSync(this.contractsDir)) {
      console.warn(
        `[ComplianceCheckerAdapter] Diretório de contratos não encontrado: ${this.contractsDir}`,
      );
      return;
    }

    let yamlFiles: string[];
    try {
      yamlFiles = fs
        .readdirSync(this.contractsDir)
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    } catch (err) {
      console.warn(
        `[ComplianceCheckerAdapter] Erro ao ler diretório de contratos: ${String(err)}`,
      );
      return;
    }

    if (yamlFiles.length === 0) {
      console.warn(
        `[ComplianceCheckerAdapter] Nenhum arquivo YAML encontrado em: ${this.contractsDir}`,
      );
      return;
    }

    for (const file of yamlFiles) {
      const filePath = path.join(this.contractsDir, file);
      this._loadContractSync(filePath);
    }
  }

  /**
   * Carrega um contrato YAML de forma síncrona (usado na inicialização).
   */
  private _loadContractSync(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = parseYaml(content) as Contract | null;

      if (!parsed || typeof parsed !== 'object') {
        console.warn(
          `[ComplianceCheckerAdapter] YAML inválido ou vazio em: ${filePath}`,
        );
        return;
      }

      const regulationId = deriveRegulationId(parsed, filePath);
      this.contracts.set(regulationId, { regulationId, contract: parsed, filePath });
    } catch (err) {
      console.warn(
        `[ComplianceCheckerAdapter] Erro ao parsear YAML em ${filePath}: ${String(err)}`,
      );
    }
  }

  /**
   * Parseia e registra um contrato YAML em memória.
   * Em caso de YAML inválido, loga aviso e ignora.
   */
  async loadContract(contractPath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(contractPath, 'utf8');
      const parsed = parseYaml(content) as Contract | null;

      if (!parsed || typeof parsed !== 'object') {
        console.warn(
          `[ComplianceCheckerAdapter] YAML inválido ou vazio em: ${contractPath}`,
        );
        return;
      }

      const regulationId = deriveRegulationId(parsed, contractPath);
      this.contracts.set(regulationId, { regulationId, contract: parsed, filePath: contractPath });
    } catch (err) {
      console.warn(
        `[ComplianceCheckerAdapter] Erro ao carregar contrato ${contractPath}: ${String(err)}`,
      );
    }
  }

  /**
   * Verifica o código contra os contratos carregados cujo regulationId
   * corresponda a um dos requirements fornecidos.
   *
   * Retorna um ComplianceStamp por contrato avaliado.
   * Não modifica nenhum arquivo em contractsDir.
   */
  async check(code: string, requirements: string[]): Promise<ComplianceStamp[]> {
    const stamps: ComplianceStamp[] = [];

    for (const regulationId of requirements) {
      const loaded = this.contracts.get(regulationId);
      if (!loaded) continue;

      const rules = loaded.contract.rules ?? [];
      if (rules.length === 0) {
        // Contrato sem regras: score 0
        stamps.push({
          regulationId,
          clauses: [],
          score: 0,
          verifiedAt: new Date(),
          verifiedBy: 'ComplianceCheckerAdapter',
        });
        continue;
      }

      const clauses = rules.map((r) => r.principle);
      const satisfiedCount = rules.filter((r) => isClauseSatisfied(r.principle, code)).length;
      const score = satisfiedCount / rules.length;

      stamps.push({
        regulationId,
        clauses,
        score,
        verifiedAt: new Date(),
        verifiedBy: 'ComplianceCheckerAdapter',
      });
    }

    return stamps;
  }

  /**
   * Retorna os contratos carregados em memória (para uso em testes).
   */
  getLoadedContracts(): Map<string, LoadedContract> {
    return this.contracts;
  }
}
