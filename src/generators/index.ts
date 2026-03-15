/**
 * Camada 4: Geração (Project Generation)
 *
 * Exports all generator components for the Phase 3 Transformation Engine.
 */

export { TemplateEngine } from './TemplateEngine.js';
export type { CompiledTemplate, HelperFunction } from './TemplateEngine.js';

export { EscapeContractWriter } from './EscapeContractWriter.js';
export type { EscapeContractParams } from './EscapeContractWriter.js';

export { ProjectGenerator } from './ProjectGenerator.js';
export type { GeneratorParams } from './ProjectGenerator.js';

export { TransformationPipeline } from './TransformationPipeline.js';
export type { PipelineOptions, PipelineResult } from './TransformationPipeline.js';
