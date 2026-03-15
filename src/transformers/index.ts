/**
 * Transformers Module
 *
 * This module exports AST transformation utilities for code manipulation.
 *
 * @module transformers
 */

export { ASTTransformer } from './ASTTransformer.js';
export type {
  AST,
  ImportNode,
  ParseOptions,
  GenerateOptions,
  Visitor
} from './ASTTransformer.js';

export { ImportReplacer } from './ImportReplacer.js';

export { DiffApplyTransformer } from './DiffApplyTransformer.js';
export type {
  DiffApplyOptions,
  DiffApplyResult,
  SimilarityStats
} from './DiffApplyTransformer.js';
