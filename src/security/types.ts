/**
 * Security Analysis Types
 * 
 * Type definitions for supply chain security analysis
 */

import { ErrorSeverity } from '../models/schemas.js';

/**
 * Security analysis options
 */
export interface SecurityAnalysisOptions {
  checkNPMRegistry?: boolean;
  enableSecurityAnalysis?: boolean;
}

/**
 * Pattern types for suspicious code detection
 */
export type PatternType =
  | 'network_request'
  | 'env_access'
  | 'file_system'
  | 'code_execution'
  | 'obfuscation'
  | 'slopsquat'
  | 'unicode_homoglyph'
  | 'unicode_bidi'
  | 'unicode_invisible';

/**
 * Script context information
 */
export interface ScriptContext {
  scriptType: 'postinstall' | 'preinstall' | 'install';
  source: 'package.json' | 'dependency';
  packageName?: string;
  publishDate?: Date;
}

/**
 * Detected suspicious pattern
 */
export interface DetectedPattern {
  type: PatternType;
  pattern: string;
  match: string;
  position: { line: number; column: number };
}

/**
 * Script analysis result
 */
export interface ScriptAnalysisResult {
  script: string;
  patterns: DetectedPattern[];
  riskScore: number;
  severity: ErrorSeverity;
  context: ScriptContext;
}

/**
 * Package.json structure
 */
export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Installation script
 */
export interface InstallationScript {
  type: 'postinstall' | 'preinstall' | 'install';
  content: string;
}

/**
 * Pattern definition for detection
 */
export interface PatternDefinition {
  type: PatternType;
  regex: RegExp;
  weight: number;
}

/**
 * Scoring weights for risk calculation
 */
export interface ScoringWeights {
  network_request: 30;
  env_access: 40;
  code_execution: 25;
  obfuscation: 20;
  file_system: 15;
  recent_publish: 10;
  slopsquat: 45;
  unicode_homoglyph: 50;
  unicode_bidi: 50;
  unicode_invisible: 40;
}

/**
 * Package metadata from npm registry
 */
export interface PackageMetadata {
  name: string;
  version: string;
  publishDate: Date;
  scripts?: Record<string, string>;
}

/**
 * Issue context for issue generation
 */
export interface IssueContext {
  source: 'package.json' | 'dependency';
  packageName?: string;
  file?: string;
}
