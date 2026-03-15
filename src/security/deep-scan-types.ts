/**
 * Deep Dependency Scanner — Shared Types
 *
 * Type definitions for transitive dependency analysis.
 * Requirements: 3.1, 4.1, 6.1, 9.1
 */

import { Issue } from '../models/schemas.js';
import { IssueContext } from './types.js';

export interface DependencyNode {
  name: string;
  version: string;          // exact version, e.g. "1.2.3"
  depth: number;            // 0 = root, 1 = direct dep, etc.
  path: string[];           // ["root", "express", "qs", "this-package"]
  children: DependencyNode[];
}

export interface DependencyGraph {
  root: DependencyNode;
  nodes: Map<string, DependencyNode>;  // key: "${name}@${version}"
  cycles: string[][];                  // each cycle as ordered list of package keys
}

export interface TransitiveIssueContext extends IssueContext {
  depth: number;
  dependencyPath: string[];   // full path from root to suspicious package
  directDependency: string;   // the depth=1 package responsible
}

export type ScanMode = 'shallow' | 'deep';

export interface DeepScanOptions {
  mode?: ScanMode;              // default: 'shallow'
  maxDepth?: number;            // default: 3
  checkNPMRegistry?: boolean;   // default: true
}

export interface ScanStats {
  analyzed: number;
  cached: number;
  errors: number;
  unverified: number;
  durationMs: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface DeepScanResult {
  issues: Issue[];
  stats: ScanStats;
  paths: Map<string, string[][]>;  // packageKey -> all dependency paths
}
