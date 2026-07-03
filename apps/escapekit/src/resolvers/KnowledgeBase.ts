/**
 * KnowledgeBase - Storage and retrieval of ghost import mappings
 * 
 * This class maintains a knowledge base of known ghost import to real package mappings.
 * It provides exact match lookups and supports loading/exporting mappings from JSON files.
 * 
 * Part of Camada 2 (Resolução) - Dependency Resolution Layer
 * 
 * @module resolvers/KnowledgeBase
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { PackageMapping, MappingStrategy } from '../models/transformation.js';
import { logger } from '../logger.js';
import type { AcademicReference, ContratoYAML, PaperRegistry } from '../models/academic.js';
import { parse as parseYaml } from 'yaml';

/**
 * JSON structure for knowledge base file
 */
interface KnowledgeBaseJSON {
  mappings: Record<string, {
    realPackage: string;
    version?: string;
    strategy?: string;
    confidence?: number;
    additionalPackages?: string[];
    reason?: string;
  }>;
}

/**
 * KnowledgeBase class for managing ghost import mappings
 * 
 * @example
 * ```typescript
 * const kb = new KnowledgeBase();
 * await kb.loadFromFile('knowledge-base.json');
 * 
 * const mapping = kb.getMapping('three.js');
 * if (mapping) {
 *   console.log(`${mapping.ghostPackage} → ${mapping.realPackages.join(', ')}`);
 * }
 * ```
 */
export class KnowledgeBase {
  private mappings: Map<string, PackageMapping>;
  private academicRefs: Map<string, AcademicReference[]>;
  private log = logger.child('KnowledgeBase');

  constructor() {
    this.mappings = new Map();
    this.academicRefs = new Map();
  }

  /**
   * Get exact match mapping from knowledge base
   * 
   * @param ghostPackage - The ghost package name to look up
   * @returns PackageMapping if found, null otherwise
   * 
   * @example
   * ```typescript
   * const mapping = kb.getMapping('three.js');
   * if (mapping) {
   *   console.log(`Found mapping: ${mapping.realPackages[0]}`);
   * }
   * ```
   */
  getMapping(ghostPackage: string): PackageMapping | null {
    const mapping = this.mappings.get(ghostPackage);
    
    if (mapping) {
      this.log.debug('Found exact match in knowledge base', {
        ghostPackage,
        realPackages: mapping.realPackages,
        confidence: mapping.confidence
      });
    }
    
    return mapping || null;
  }

  /**
   * Add new mapping to knowledge base
   * 
   * @param mapping - The package mapping to add
   * 
   * @example
   * ```typescript
   * kb.addMapping({
   *   ghostPackage: 'fake-api',
   *   realPackages: ['axios'],
   *   confidence: 0.95,
   *   mappingStrategy: MappingStrategy.EXACT_MATCH,
   *   metadata: {
   *     reason: 'Common HTTP client replacement'
   *   }
   * });
   * ```
   */
  addMapping(mapping: PackageMapping): void {
    this.mappings.set(mapping.ghostPackage, mapping);
    
    this.log.debug('Added mapping to knowledge base', {
      ghostPackage: mapping.ghostPackage,
      realPackages: mapping.realPackages,
      confidence: mapping.confidence
    });
  }

  /**
   * Load mappings from JSON file
   * 
   * @param path - Path to the JSON file
   * @throws Error if file cannot be read or parsed
   * 
   * @example
   * ```typescript
   * await kb.loadFromFile('./knowledge-base.json');
   * ```
   */
  async loadFromFile(path: string): Promise<void> {
    try {
      this.log.info('Loading knowledge base from file', { path });
      
      const content = await fs.readFile(path, 'utf-8');
      const data: KnowledgeBaseJSON = JSON.parse(content);
      
      if (!data.mappings || typeof data.mappings !== 'object') {
        throw new Error('Invalid knowledge base format: missing or invalid "mappings" field');
      }
      
      let loadedCount = 0;
      
      for (const [ghostPackage, mappingData] of Object.entries(data.mappings)) {
        const realPackages = [mappingData.realPackage];
        if (mappingData.additionalPackages) {
          realPackages.push(...mappingData.additionalPackages);
        }
        
        const mapping: PackageMapping = {
          ghostPackage,
          realPackages,
          confidence: mappingData.confidence ?? 1.0,
          mappingStrategy: MappingStrategy.EXACT_MATCH,
          metadata: {
            reason: mappingData.reason,
            source: 'knowledge-base.json'
          }
        };
        
        this.addMapping(mapping);
        loadedCount++;
      }
      
      this.log.info('Successfully loaded knowledge base', {
        path,
        mappingsLoaded: loadedCount
      });
      
    } catch (error) {
      this.log.error('Failed to load knowledge base from file', error, { path });
      throw error;
    }
  }

  /**
   * Export mappings to JSON file
   * 
   * @param path - Path where the JSON file should be written
   * @throws Error if file cannot be written
   * 
   * @example
   * ```typescript
   * await kb.exportToFile('./knowledge-base-export.json');
   * ```
   */
  async exportToFile(path: string): Promise<void> {
    try {
      this.log.info('Exporting knowledge base to file', { path });
      
      const data: KnowledgeBaseJSON = {
        mappings: {}
      };
      
      for (const [ghostPackage, mapping] of this.mappings.entries()) {
        const [realPackage, ...additionalPackages] = mapping.realPackages;
        
        data.mappings[ghostPackage] = {
          realPackage,
          confidence: mapping.confidence,
          strategy: mapping.mappingStrategy,
          ...(additionalPackages.length > 0 && { additionalPackages }),
          ...(mapping.metadata?.reason && { reason: mapping.metadata.reason })
        };
      }
      
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(path, content, 'utf-8');
      
      this.log.info('Successfully exported knowledge base', {
        path,
        mappingsExported: this.mappings.size
      });
      
    } catch (error) {
      this.log.error('Failed to export knowledge base to file', error, { path });
      throw error;
    }
  }

  /**
   * Get the number of mappings in the knowledge base
   * 
   * @returns Number of mappings
   */
  size(): number {
    return this.mappings.size;
  }

  /**
   * Clear all mappings from the knowledge base
   */
  clear(): void {
    this.mappings.clear();
    this.log.debug('Cleared all mappings from knowledge base');
  }

  /**
   * Load paper contracts from a registry YAML file and build the TraceabilityIndex.
   *
   * @param registryPath - Path to `registry.yaml`
   */
  async loadPaperContracts(registryPath: string): Promise<void> {
    const registryDir = path.dirname(registryPath);

    let registryContent: string;
    try {
      registryContent = await fs.readFile(registryPath, 'utf-8');
    } catch {
      this.log.warn('Paper registry not found, academicRefs will be empty', { registryPath });
      return;
    }

    let registry: PaperRegistry;
    try {
      registry = parseYaml(registryContent) as PaperRegistry;
    } catch {
      this.log.warn('Failed to parse registry YAML', { registryPath });
      return;
    }

    if (!registry?.papers || !Array.isArray(registry.papers)) {
      this.log.warn('Registry has no papers array', { registryPath });
      return;
    }

    for (const paper of registry.papers) {
      if (!paper.contractFile) {
        this.log.warn('Registry entry missing contractFile', { paperId: paper.paperId });
        continue;
      }

      const contractPath = path.join(registryDir, paper.contractFile);
      let contractContent: string;
      try {
        contractContent = await fs.readFile(contractPath, 'utf-8');
      } catch {
        this.log.warn('Contract file not found', { contractPath, paperId: paper.paperId });
        continue;
      }

      let contract: ContratoYAML;
      try {
        contract = parseYaml(contractContent) as ContratoYAML;
      } catch {
        this.log.warn('Failed to parse contract YAML', { contractPath });
        continue;
      }

      if (!contract?.source || !contract?.rules || !Array.isArray(contract.rules)) {
        this.log.warn('Contract missing required fields (source, rules)', { contractPath });
        continue;
      }

      for (const rule of contract.rules) {
        if (!rule.paperRef || !rule.detector_name) continue;
        if (contract.traceability?.[rule.id]?.status !== 'implemented') continue;

        const ref: AcademicReference = {
          paperId: rule.paperRef,
          title: contract.source.title,
          venue: paper.venue,
          year: contract.source.year,
          ruleId: rule.id,
          factIds: rule.derived_from ?? [],
          doi: contract.source.doi,
          url: contract.source.url,
        };

        const existing = this.academicRefs.get(rule.detector_name) ?? [];
        existing.push(ref);
        this.academicRefs.set(rule.detector_name, existing);
      }
    }
  }

  /**
   * Look up academic references for a given issue type.
   *
   * @param issueType - The detector name / issue type to look up
   * @returns Array of AcademicReference, or undefined if not found
   */
  getAcademicReference(issueType: string): AcademicReference[] | undefined {
    return this.academicRefs.get(issueType);
  }

  /**
   * Load contracts synchronously from an in-memory array (for testing only — no I/O).
   * Resets academicRefs before building the index.
   *
   * @param contracts - Array of ContratoYAML objects
   */
  loadContractsSync(contracts: ContratoYAML[]): void {
    this.academicRefs = new Map();

    for (const contract of contracts) {
      if (!contract?.source || !contract?.rules || !Array.isArray(contract.rules)) continue;

      for (const rule of contract.rules) {
        if (!rule.paperRef || !rule.detector_name) continue;
        if (contract.traceability?.[rule.id]?.status !== 'implemented') continue;

        const ref: AcademicReference = {
          paperId: rule.paperRef,
          title: contract.source.title,
          venue: contract.source.title, // no registry available in sync mode; use title as fallback
          year: contract.source.year,
          ruleId: rule.id,
          factIds: rule.derived_from ?? [],
          doi: contract.source.doi,
          url: contract.source.url,
        };

        const existing = this.academicRefs.get(rule.detector_name) ?? [];
        existing.push(ref);
        this.academicRefs.set(rule.detector_name, existing);
      }
    }
  }
}
