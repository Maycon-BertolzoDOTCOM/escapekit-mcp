/**
 * Transformation Engine Data Models
 *
 * This module defines all data structures for the Phase 3 Transformation Engine.
 * These models form Camada 1 (Foundation layer) and have zero dependencies on other layers.
 *
 * @module models/transformation
 */
/**
 * Strategies for mapping ghost imports to real packages.
 *
 * @example
 * ```typescript
 * const mapping: PackageMapping = {
 *   ghostPackage: 'fake-api',
 *   realPackages: ['axios'],
 *   confidence: 0.95,
 *   mappingStrategy: MappingStrategy.EXACT_MATCH
 * };
 * ```
 */
export var MappingStrategy;
(function (MappingStrategy) {
    /** Direct 1:1 mapping from knowledge base */
    MappingStrategy["EXACT_MATCH"] = "EXACT_MATCH";
    /** Fuzzy/semantic similarity matching */
    MappingStrategy["SEMANTIC_MATCH"] = "SEMANTIC_MATCH";
    /** User-provided manual mapping */
    MappingStrategy["MANUAL_OVERRIDE"] = "MANUAL_OVERRIDE";
    /** Default fallback option when no better match exists */
    MappingStrategy["FALLBACK"] = "FALLBACK";
})(MappingStrategy || (MappingStrategy = {}));
/**
 * Methods used to resolve dependencies.
 *
 * @example
 * ```typescript
 * const resolution: DependencyResolution = {
 *   originalImport: 'fake-api',
 *   resolvedPackage: 'axios',
 *   version: '^1.6.0',
 *   resolutionMethod: ResolutionMethod.KNOWLEDGE_BASE,
 *   confidence: 0.95
 * };
 * ```
 */
export var ResolutionMethod;
(function (ResolutionMethod) {
    /** Resolved from built-in knowledge base */
    ResolutionMethod["KNOWLEDGE_BASE"] = "KNOWLEDGE_BASE";
    /** Resolved from npm registry search */
    ResolutionMethod["NPM_SEARCH"] = "NPM_SEARCH";
    /** Resolved from semantic analysis */
    ResolutionMethod["SEMANTIC_ANALYSIS"] = "SEMANTIC_ANALYSIS";
    /** User-specified resolution */
    ResolutionMethod["USER_PROVIDED"] = "USER_PROVIDED";
})(ResolutionMethod || (ResolutionMethod = {}));
/**
 * Types of transformations that can be applied to code.
 *
 * @example
 * ```typescript
 * const rule: TransformationRule = {
 *   ruleId: 'import-replacement-001',
 *   ruleType: TransformationType.IMPORT_REPLACEMENT,
 *   sourcePattern: 'fake-api',
 *   targetPattern: 'axios'
 * };
 * ```
 */
export var TransformationType;
(function (TransformationType) {
    /** Replace import statement with real package */
    TransformationType["IMPORT_REPLACEMENT"] = "IMPORT_REPLACEMENT";
    /** Add polyfill code for missing functionality */
    TransformationType["POLYFILL_INJECTION"] = "POLYFILL_INJECTION";
    /** Migrate API calls to new interface */
    TransformationType["API_MIGRATION"] = "API_MIGRATION";
    /** Generate configuration files */
    TransformationType["CONFIGURATION_GENERATION"] = "CONFIGURATION_GENERATION";
})(TransformationType || (TransformationType = {}));
//# sourceMappingURL=transformation.js.map