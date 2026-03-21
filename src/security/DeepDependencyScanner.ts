/**
 * DeepDependencyScanner
 *
 * Orchestrates transitive dependency analysis by BFS-traversing the full
 * dependency graph parsed from a lockfile. Reuses all existing security
 * infrastructure (PatternMatcher, RiskScorer, IssueGenerator, NPMRegistry)
 * and delegates shallow-mode scans to PostInstallDetector unchanged.
 *
 * Requirements: 2.4, 2.5, 3.3, 3.4, 3.5, 4.2, 4.3, 4.4, 4.5, 4.6,
 *               6.1, 6.2, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5,
 *               9.1, 9.2, 9.3, 9.4, 9.5, 12.1, 12.2, 12.3, 12.5, 12.6,
 *               13.1, 13.3
 */

import { Issue } from '../models/schemas.js';
import { logger } from '../logger.js';
import { NPMRegistry } from '../services/NPMRegistry.js';
import { LockFileParser } from './LockFileParser.js';
import { PatternMatcher } from './PatternMatcher.js';
import { RiskScorer } from './RiskScorer.js';
import { IssueGenerator } from './IssueGenerator.js';
import { PostInstallDetector } from './PostInstallDetector.js';
import { RateLimiter } from '../ratelimit/RateLimiter.js';
import {
  DependencyNode,
  DependencyGraph,
  DeepScanOptions,
  DeepScanResult,
} from './deep-scan-types.js';
import { ScriptContext, ScriptAnalysisResult } from './types.js';

/** Resolved options with all defaults filled in */
type ResolvedOptions = Required<DeepScanOptions>;

const DEFAULT_OPTIONS: ResolvedOptions = {
  mode: 'shallow',
  maxDepth: 3,
  checkNPMRegistry: true,
};

export class DeepDependencyScanner {
  private readonly log = logger.child('DeepDependencyScanner');

  constructor(
    private readonly registry: NPMRegistry,
    private readonly lockFileParser: LockFileParser,
    private readonly patternMatcher: PatternMatcher,
    private readonly riskScorer: RiskScorer,
    private readonly issueGenerator: IssueGenerator,
    private readonly postInstallDetector: PostInstallDetector,
    private readonly rateLimiter: RateLimiter
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Perform a dependency scan.
   *
   * - mode='shallow' (default): delegates to PostInstallDetector.analyze()
   * - mode='deep': parses the lockfile and runs BFS traversal
   *
   * @param packageJsonPath  Path to the project's package.json
   * @param lockfilePath     Path to package-lock.json or yarn.lock (null → shallow fallback)
   * @param options          Scan options (mode, maxDepth, checkNPMRegistry)
   */
  async deepScan(
    packageJsonPath: string,
    lockfilePath: string | null,
    options?: DeepScanOptions
  ): Promise<DeepScanResult> {
    const resolved: ResolvedOptions = { ...DEFAULT_OPTIONS, ...options };

    // ── Shallow mode ──────────────────────────────────────────────────────────
    if (resolved.mode === 'shallow') {
      return this.runShallow(packageJsonPath, resolved);
    }

    // ── Deep mode ─────────────────────────────────────────────────────────────

    // No lockfile → warn and fall back to shallow
    if (lockfilePath === null) {
      this.log.warn(
        'No lockfile provided for deep scan — falling back to shallow mode'
      );
      return this.runShallow(packageJsonPath, resolved);
    }

    // maxDepth=0 → return empty result immediately (Req 4.4)
    if (resolved.maxDepth === 0) {
      return this.emptyResult();
    }

    // Parse the lockfile
    const parseResult = await this.lockFileParser.parse(lockfilePath);

    if (!parseResult.success) {
      this.log.error('Failed to parse lockfile', { error: parseResult.error, code: parseResult.code });
      // Corrupted/missing lockfile → return empty result with no partial issues (Req 13.2)
      return this.emptyResult();
    }

    // Both lockfiles present: caller passes one path; if it's yarn.lock but
    // package-lock.json also exists, the caller should have preferred it.
    // We log info when we detect a yarn.lock was parsed (format hint).
    if (parseResult.format === 'yarn-v1' || parseResult.format === 'yarn-berry') {
      this.log.info(
        'Parsed yarn.lock; if package-lock.json also exists, prefer it for more accurate results'
      );
    }

    return this.scanDeep(parseResult.graph, resolved);
  }

  // ---------------------------------------------------------------------------
  // Private — shallow delegation
  // ---------------------------------------------------------------------------

  private async runShallow(
    packageJsonPath: string,
    options: ResolvedOptions
  ): Promise<DeepScanResult> {
    const startMs = Date.now();
    const issues = await this.postInstallDetector.analyze(packageJsonPath, {
      checkNPMRegistry: options.checkNPMRegistry,
    });
    return {
      issues,
      stats: {
        analyzed: issues.length,
        cached: 0,
        errors: 0,
        unverified: 0,
        durationMs: Date.now() - startMs,
        cacheHits: 0,
        cacheMisses: 0,
      },
      paths: new Map(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private — deep scan (BFS)
  // ---------------------------------------------------------------------------

  /**
   * BFS traversal of the dependency graph.
   *
   * Algorithm (from design.md):
   *   queue = [(root, depth=0, path=["root"], directDep="")]
   *   visited = Set<string>()          // keys already enqueued
   *   analysisCache = Map<string, AnalysisOutcome>()  // keys already analyzed
   *
   *   while queue not empty:
   *     (node, depth, path, directDep) = dequeue
   *     if depth > maxDepth: continue
   *     if node.key in visited: continue  // cycle or dedup
   *     visited.add(node.key)
   *
   *     if depth > 0:
   *       if node.key in analysisCache: cacheHits++, record path
   *       else: cacheMisses++, outcome = analyzePackageWithStats(node)
   *             analysisCache.set(node.key, outcome)
   *
   *     for child in node.children:
   *       if child.key not in visited:
   *         enqueue(child, depth+1, path+[child.name], directDep || child.name)
   */
  private async scanDeep(
    graph: DependencyGraph,
    options: ResolvedOptions
  ): Promise<DeepScanResult> {
    const startMs = Date.now();

    // Stats counters
    let analyzed = 0;
    let errors = 0;
    let unverified = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    // BFS state
    const visited = new Set<string>();

    /**
     * analysisCache stores the outcome for each unique (name@version) key.
     * 'pending' is a sentinel used while the async analysis is in-flight so
     * that the BFS loop doesn't double-schedule the same package.
     */
    type AnalysisOutcome =
      | { kind: 'issue'; issue: Issue }
      | { kind: 'clean' }
      | { kind: 'unverified' }
      | { kind: 'error' }
      | { kind: 'pending' };

    const analysisCache = new Map<string, AnalysisOutcome>();

    // paths: packageKey → all dependency paths that reach it
    const paths = new Map<string, string[][]>();

    // directDep: packageKey → name of the depth=1 ancestor
    const directDepMap = new Map<string, string>();

    // depthMap: packageKey → depth at which it was first visited
    const depthMap = new Map<string, number>();

    // Queue entries: [node, depth, path, directDep]
    type QueueEntry = [DependencyNode, number, string[], string];
    const queue: QueueEntry[] = [];

    queue.push([graph.root, 0, ['root'], '']);
    visited.add('@root@');

    // Collect promises for parallel analysis
    const analysisPromises: Array<Promise<void>> = [];

    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      const [node, depth, path, directDep] = entry;
      const nodeKey = `${node.name}@${node.version}`;

      if (depth > options.maxDepth) continue;

      // Cycle / dedup check (root already added above)
      if (depth > 0) {
        if (visited.has(nodeKey)) {
          // Record cycle in graph
          graph.cycles.push([...path, nodeKey]);
          // Still record this path for multi-path dedup
          const existing = paths.get(nodeKey) ?? [];
          existing.push([...path]);
          paths.set(nodeKey, existing);
          continue;
        }
        visited.add(nodeKey);
        depthMap.set(nodeKey, depth);
        directDepMap.set(nodeKey, directDep);

        // Record path
        const existing = paths.get(nodeKey) ?? [];
        existing.push([...path]);
        paths.set(nodeKey, existing);

        if (analysisCache.has(nodeKey)) {
          // Cache hit — result already computed (or in-flight)
          cacheHits++;
        } else {
          // Cache miss — schedule analysis
          cacheMisses++;
          // Mark as pending immediately to prevent double-scheduling
          analysisCache.set(nodeKey, { kind: 'pending' });

          const capturedNode = node;
          const capturedKey = nodeKey;

          const promise = this.analyzePackageInternal(capturedNode)
            .then(({ outcome }) => {
              analysisCache.set(capturedKey, outcome);
              // Tally stats
              if (outcome.kind === 'clean' || outcome.kind === 'issue') {
                analyzed++;
              } else if (outcome.kind === 'unverified') {
                unverified++;
              } else if (outcome.kind === 'error') {
                errors++;
              }
            });
          analysisPromises.push(promise);
        }
      }

      // Enqueue children (stop enqueuing beyond maxDepth)
      if (depth < options.maxDepth) {
        for (const child of node.children) {
          const childKey = `${child.name}@${child.version}`;
          if (!visited.has(childKey)) {
            const childDirectDep = depth === 0 ? child.name : directDep;
            queue.push([child, depth + 1, [...path, child.name], childDirectDep]);
          }
        }
      }
    }

    // Wait for all analysis promises to settle
    await Promise.all(analysisPromises);

    // Collect issues with multi-path dedup
    const issues: Issue[] = [];

    for (const [key, outcome] of analysisCache) {
      if (outcome.kind !== 'issue') continue;
      const allPaths = paths.get(key) ?? [];
      const nodeDepth = depthMap.get(key) ?? 1;
      const directDep = directDepMap.get(key) ?? '';
      const finalIssue = this.buildTransitiveIssue(outcome.issue, allPaths, nodeDepth, directDep);
      issues.push(finalIssue);
    }

    return {
      issues,
      stats: {
        analyzed,
        cached: cacheHits,
        errors,
        unverified,
        durationMs: Date.now() - startMs,
        cacheHits,
        cacheMisses,
      },
      paths,
    };
  }

  // ---------------------------------------------------------------------------
  // Private — package analysis
  // ---------------------------------------------------------------------------

  /**
   * Analyze a single package node for suspicious scripts.
   * Returns a typed outcome so the BFS loop can tally stats correctly.
   *
   * Outcomes:
   *   - { kind: 'issue', issue }  — suspicious patterns found
   *   - { kind: 'clean' }         — scripts fetched, no patterns
   *   - { kind: 'unverified' }    — fetchPackageScripts returned null (404/timeout/network)
   *   - { kind: 'error' }         — hard exception during analysis
   */
  private async analyzePackageInternal(
    node: DependencyNode
  ): Promise<{
    issue: Issue | null;
    outcome:
      | { kind: 'issue'; issue: Issue }
      | { kind: 'clean' }
      | { kind: 'unverified' }
      | { kind: 'error' };
  }> {
    let scripts: Record<string, string> | null;

    try {
      scripts = await this.rateLimiter.execute(() =>
        this.registry.fetchPackageScripts(node.name, node.version)
      );
    } catch {
      // Hard error from rateLimiter or registry
      return { issue: null, outcome: { kind: 'error' } };
    }

    if (scripts === null) {
      // 404, network error, or timeout — package unverified (Req 13.1, 13.3)
      return { issue: null, outcome: { kind: 'unverified' } };
    }

    // Analyze each install-lifecycle script value
    let bestIssue: Issue | null = null;
    let bestScore = -1;

    for (const [scriptName, scriptContent] of Object.entries(scripts)) {
      // Only care about install-lifecycle scripts
      if (!['preinstall', 'install', 'postinstall'].includes(scriptName)) continue;

      const patterns = this.patternMatcher.detectPatterns(scriptContent);
      if (patterns.length === 0) continue;

      const score = this.riskScorer.calculateScore(patterns);
      const severity = this.riskScorer.getSeverity(score);

      const context: ScriptContext = {
        scriptType: scriptName as 'preinstall' | 'install' | 'postinstall',
        source: 'dependency',
        packageName: node.name,
      };

      const analysisResult: ScriptAnalysisResult = {
        script: scriptContent,
        patterns,
        riskScore: score,
        severity,
        context,
      };

      const issue = this.issueGenerator.createIssue(analysisResult, {
        source: 'dependency',
        packageName: node.name,
      });

      if (score > bestScore) {
        bestScore = score;
        bestIssue = issue;
      }
    }

    if (bestIssue !== null) {
      return { issue: bestIssue, outcome: { kind: 'issue', issue: bestIssue } };
    }

    // Scripts fetched successfully but no suspicious patterns found
    return { issue: null, outcome: { kind: 'clean' } };
  }

  /**
   * Enrich a base issue with transitive context:
   * - Prepend depth, path, and direct-dep info to description
   * - Append remediation hint referencing the direct dependency to suggestion
   * - Merge all paths when the same package is reachable via multiple routes
   */
  private buildTransitiveIssue(
    baseIssue: Issue,
    allPaths: string[][],
    depth: number,
    directDep: string
  ): Issue {
    const primaryPath = allPaths[0] ?? [];
    const pathStr = primaryPath.join(' → ');

    let description =
      `[depth: ${depth}] [path: ${pathStr}]\n` +
      `[direct dep: ${directDep}]\n\n` +
      baseIssue.description;

    if (allPaths.length > 1) {
      const otherPaths = allPaths.slice(1);
      description +=
        '\n\nAlso reachable via:\n' +
        otherPaths.map((p) => p.join(' → ')).join('\n');
    }

    const suggestion =
      (baseIssue.suggestion ?? '') +
      `\n\nUpdate or replace direct dependency "${directDep}" to remediate this issue.`;

    return {
      ...baseIssue,
      description,
      suggestion,
    };
  }

  // ---------------------------------------------------------------------------
  // Private — helpers
  // ---------------------------------------------------------------------------

  private emptyResult(): DeepScanResult {
    return {
      issues: [],
      stats: {
        analyzed: 0,
        cached: 0,
        errors: 0,
        unverified: 0,
        durationMs: 0,
        cacheHits: 0,
        cacheMisses: 0,
      },
      paths: new Map(),
    };
  }
}
