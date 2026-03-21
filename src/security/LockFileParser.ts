/**
 * LockFileParser
 *
 * Parses package-lock.json (npm v1/v2/v3) and yarn.lock (v1) into a DependencyGraph.
 * All error paths return ParseError — never throws.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3
 */

import { readFile } from 'fs/promises';
import { DependencyGraph, DependencyNode } from './deep-scan-types.js';

export type LockFileFormat = 'npm-v1' | 'npm-v2' | 'npm-v3' | 'yarn-v1' | 'yarn-berry';

export interface ParseResult {
  success: true;
  graph: DependencyGraph;
  format: LockFileFormat;
}

export interface ParseError {
  success: false;
  error: string;
  code: 'FILE_NOT_FOUND' | 'INVALID_JSON' | 'INVALID_SYNTAX' | 'UNSUPPORTED_FORMAT';
}

export type LockFileParseResult = ParseResult | ParseError;

export class LockFileParser {
  /**
   * Read a lockfile from disk and parse it.
   */
  async parse(lockfilePath: string): Promise<LockFileParseResult> {
    let content: string;
    try {
      content = await readFile(lockfilePath, 'utf-8');
    } catch {
      return {
        success: false,
        error: `Lockfile not found: ${lockfilePath}`,
        code: 'FILE_NOT_FOUND',
      };
    }

    const format = this.detectFormat(content);
    if (format === null) {
      return {
        success: false,
        error: 'Unable to detect lockfile format',
        code: 'UNSUPPORTED_FORMAT',
      };
    }

    return this.parseContent(content, format);
  }

  /**
   * Parse lockfile content given an explicit format.
   */
  async parseContent(content: string, format: LockFileFormat): Promise<LockFileParseResult> {
    try {
      switch (format) {
        case 'npm-v1': {
          const data = this.parseJson(content);
          if (!data.success) return data;
          const graph = this.parseNpmV1(data.value);
          return { success: true, graph, format };
        }
        case 'npm-v2':
        case 'npm-v3': {
          const data = this.parseJson(content);
          if (!data.success) return data;
          const graph = this.parseNpmV2V3(data.value);
          return { success: true, graph, format };
        }
        case 'yarn-v1': {
          const graph = this.parseYarnV1(content);
          return { success: true, graph, format };
        }
        case 'yarn-berry': {
          return this.parseYarnBerry();
        }
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'INVALID_SYNTAX',
      };
    }
  }

  /**
   * Serialize a DependencyGraph to npm-v2 JSON for round-trip testing.
   */
  serialize(graph: DependencyGraph): string {
    const packages: Record<string, unknown> = {};

    // Root entry
    packages[''] = {
      name: graph.root.name || undefined,
      version: graph.root.version || undefined,
    };

    // All non-root nodes
    for (const [key, node] of graph.nodes) {
      if (key === '@root@') continue;
      const pkgPath = this.nodeToPackagePath(node);
      const deps: Record<string, string> = {};
      for (const child of node.children) {
        deps[child.name] = child.version;
      }
      packages[pkgPath] = {
        version: node.version,
        ...(Object.keys(deps).length > 0 ? { dependencies: deps } : {}),
      };
    }

    return JSON.stringify(
      {
        lockfileVersion: 2,
        packages,
      },
      null,
      2
    );
  }

  /**
   * Detect the lockfile format from content.
   * Returns null if format cannot be determined.
   */
  detectFormat(content: string): LockFileFormat | null {
    const trimmed = content.trimStart();

    // Yarn v1 starts with a comment header
    if (trimmed.startsWith('# yarn lockfile v1')) {
      return 'yarn-v1';
    }

    // Yarn Berry contains __metadata:
    if (content.includes('__metadata:')) {
      return 'yarn-berry';
    }

    // Try JSON-based npm formats
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      const version = data['lockfileVersion'];
      if (version === 1) return 'npm-v1';
      if (version === 2) return 'npm-v2';
      if (version === 3) return 'npm-v3';
    } catch {
      // Not JSON
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private parseJson(
    content: string
  ): { success: true; value: Record<string, unknown> } | ParseError {
    try {
      const value = JSON.parse(content) as Record<string, unknown>;
      return { success: true, value };
    } catch (err) {
      return {
        success: false,
        error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        code: 'INVALID_JSON',
      };
    }
  }

  /**
   * Parse npm lockfile v1 — nested `dependencies` object.
   */
  private parseNpmV1(data: Record<string, unknown>): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const cycles: string[][] = [];

    const root: DependencyNode = {
      name: '',
      version: '',
      depth: 0,
      path: [''],
      children: [],
    };
    nodes.set('@root@', root);

    const deps = data['dependencies'] as Record<string, unknown> | undefined;
    if (deps) {
      this.walkNpmV1Deps(deps, root, nodes, cycles, new Set(['@root@']));
    }

    return { root, nodes, cycles };
  }

  private walkNpmV1Deps(
    deps: Record<string, unknown>,
    parent: DependencyNode,
    nodes: Map<string, DependencyNode>,
    cycles: string[][],
    traversalPath: Set<string>
  ): void {
    for (const [name, entry] of Object.entries(deps)) {
      const pkg = entry as Record<string, unknown>;
      const version = String(pkg['version'] ?? '');
      const key = `${name}@${version}`;

      // Cycle detection
      if (traversalPath.has(key)) {
        cycles.push([...traversalPath, key]);
        continue;
      }

      let node = nodes.get(key);
      if (!node) {
        node = {
          name,
          version,
          depth: parent.depth + 1,
          path: [...parent.path, name],
          children: [],
        };
        nodes.set(key, node);
      }
      parent.children.push(node);

      // Recurse into nested dependencies
      const nested = pkg['dependencies'] as Record<string, unknown> | undefined;
      if (nested) {
        traversalPath.add(key);
        this.walkNpmV1Deps(nested, node, nodes, cycles, traversalPath);
        traversalPath.delete(key);
      }
    }
  }

  /**
   * Parse npm lockfile v2/v3 — flat `packages` map with path-based keys.
   */
  private parseNpmV2V3(data: Record<string, unknown>): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const cycles: string[][] = [];

    const root: DependencyNode = {
      name: '',
      version: '',
      depth: 0,
      path: [''],
      children: [],
    };
    nodes.set('@root@', root);

    const packages = data['packages'] as Record<string, unknown> | undefined;
    if (!packages) return { root, nodes, cycles };

    // First pass: create all nodes
    const pathToNode = new Map<string, DependencyNode>();
    pathToNode.set('', root);

    for (const [pkgPath, entry] of Object.entries(packages)) {
      if (pkgPath === '') continue; // root handled above

      const pkg = entry as Record<string, unknown>;
      const name = this.nameFromPath(pkgPath);
      const version = String(pkg['version'] ?? '');
      const key = `${name}@${version}`;

      // Depth = number of node_modules segments
      const depth = (pkgPath.match(/node_modules\//g) ?? []).length;

      let node = nodes.get(key);
      if (!node) {
        node = {
          name,
          version,
          depth,
          path: this.buildPathFromPkgPath(pkgPath),
          children: [],
        };
        nodes.set(key, node);
      }
      pathToNode.set(pkgPath, node);
    }

    // Second pass: wire parent-child relationships
    const sortedPaths = [...pathToNode.keys()].sort();
    for (const pkgPath of sortedPaths) {
      if (pkgPath === '') continue;
      const node = pathToNode.get(pkgPath);
      if (!node) continue;
      const parentPath = this.parentPathOf(pkgPath);
      const parent = pathToNode.get(parentPath) ?? root;

      // Avoid duplicate children (same node reachable via multiple paths)
      if (!parent.children.includes(node)) {
        parent.children.push(node);
      }
    }

    return { root, nodes, cycles };
  }

  /** Extract package name from a path like `node_modules/foo` or `node_modules/@scope/foo/node_modules/bar` */
  private nameFromPath(pkgPath: string): string {
    const parts = pkgPath.split('node_modules/');
    const last = parts[parts.length - 1];
    // Remove trailing slash if any
    return last.replace(/\/$/, '');
  }

  /** Find the parent path for a given package path */
  private parentPathOf(pkgPath: string): string {
    // e.g. "node_modules/foo/node_modules/bar" → "node_modules/foo"
    const lastIdx = pkgPath.lastIndexOf('/node_modules/');
    if (lastIdx === -1) return ''; // direct child of root
    return pkgPath.slice(0, lastIdx);
  }

  /** Build the path array from a package path string */
  private buildPathFromPkgPath(pkgPath: string): string[] {
    const parts = pkgPath.split('node_modules/').filter(Boolean);
    return ['', ...parts.map(p => p.replace(/\/$/, ''))];
  }

  /** Convert a DependencyNode back to a package path string for serialization */
  private nodeToPackagePath(node: DependencyNode): string {
    // path[0] is '' (root), rest are package names
    const names = node.path.slice(1);
    return names.map(n => `node_modules/${n}`).join('/');
  }

  /**
   * Parse yarn.lock v1 — custom block format (not JSON).
   *
   * Format example:
   *   "package-name@^1.0.0":
   *     version "1.2.3"
   *     dependencies:
   *       dep-name "^2.0.0"
   */
  private parseYarnV1(content: string): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const cycles: string[][] = [];

    const root: DependencyNode = {
      name: '',
      version: '',
      depth: 0,
      path: [''],
      children: [],
    };
    nodes.set('@root@', root);

    // Strip the header comment and blank lines, then split into blocks
    const lines = content.split('\n');
    const blocks = this.splitYarnV1Blocks(lines);

    // Map from "name@resolvedVersion" → node (built during first pass)
    const resolvedMap = new Map<string, DependencyNode>();
    // Map from specifier (e.g. "foo@^1.0.0") → resolved key
    const specifierToKey = new Map<string, string>();

    // First pass: create nodes
    for (const block of blocks) {
      const parsed = this.parseYarnV1Block(block);
      if (!parsed) continue;

      const { specifiers, version, deps } = parsed;
      const key = `${this.extractNameFromSpecifier(specifiers[0])}@${version}`;
      const name = this.extractNameFromSpecifier(specifiers[0]);

      let node = resolvedMap.get(key);
      if (!node) {
        node = {
          name,
          version,
          depth: 1, // will be adjusted later
          path: ['', name],
          children: [],
        };
        nodes.set(key, node);
        resolvedMap.set(key, node);
      }

      // Map all specifiers to this resolved key
      for (const spec of specifiers) {
        specifierToKey.set(spec, key);
        // Also map without quotes
        specifierToKey.set(spec.replace(/^"|"$/g, ''), key);
      }

      // Store deps for second pass
      (node as DependencyNode & { _deps?: Record<string, string> })._deps = deps;
    }

    // Second pass: wire children and attach to root
    for (const [, node] of resolvedMap) {
      const nodeDeps = (node as DependencyNode & { _deps?: Record<string, string> })._deps ?? {};
      delete (node as DependencyNode & { _deps?: Record<string, string> })._deps;

      for (const [depName, depRange] of Object.entries(nodeDeps)) {
        const specifier = `${depName}@${depRange}`;
        const childKey = specifierToKey.get(specifier) ?? specifierToKey.get(`"${specifier}"`);
        if (childKey) {
          const child = resolvedMap.get(childKey);
          if (child && !node.children.includes(child)) {
            node.children.push(child);
          }
        }
      }

      // Attach all top-level nodes to root
      if (!root.children.includes(node)) {
        root.children.push(node);
      }
    }

    return { root, nodes, cycles };
  }

  /** Split yarn v1 content into blocks (separated by blank lines) */
  private splitYarnV1Blocks(lines: string[]): string[][] {
    const blocks: string[][] = [];
    let current: string[] = [];

    for (const line of lines) {
      // Skip header comment lines
      if (line.startsWith('#')) continue;

      if (line.trim() === '') {
        if (current.length > 0) {
          blocks.push(current);
          current = [];
        }
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) blocks.push(current);

    return blocks;
  }

  /** Parse a single yarn v1 block */
  private parseYarnV1Block(
    lines: string[]
  ): { specifiers: string[]; version: string; deps: Record<string, string> } | null {
    if (lines.length === 0) return null;

    // First line(s) are the specifiers (may be comma-separated or multi-line)
    // e.g.: "foo@^1.0.0, foo@^1.1.0":
    const headerLine = lines[0];
    if (!headerLine.endsWith(':')) return null;

    const headerContent = headerLine.slice(0, -1).trim();
    const specifiers = headerContent
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''));

    let version = '';
    const deps: Record<string, string> = {};
    let inDeps = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('version ')) {
        version = trimmed.slice(8).replace(/^"|"$/g, '');
        inDeps = false;
      } else if (trimmed === 'dependencies:') {
        inDeps = true;
      } else if (inDeps && trimmed !== '') {
        // Dependency line: `  dep-name "^1.0.0"` or `  "dep-name" "^1.0.0"`
        const depMatch = trimmed.match(/^"?([^"]+)"?\s+"?([^"]+)"?$/);
        if (depMatch) {
          deps[depMatch[1]] = depMatch[2];
        }
      } else if (!line.startsWith('  ') && trimmed !== '') {
        inDeps = false;
      }
    }

    if (!version) return null;

    return { specifiers, version, deps };
  }

  /** Extract package name from a yarn specifier like "foo@^1.0.0" or "@scope/foo@^1.0.0" */
  private extractNameFromSpecifier(specifier: string): string {
    // Handle scoped packages: @scope/name@version
    if (specifier.startsWith('@')) {
      const atIdx = specifier.indexOf('@', 1);
      return atIdx > 0 ? specifier.slice(0, atIdx) : specifier;
    }
    const atIdx = specifier.indexOf('@');
    return atIdx > 0 ? specifier.slice(0, atIdx) : specifier;
  }

  /**
   * Yarn Berry is out of scope for MVP.
   */
  private parseYarnBerry(): ParseError {
    return {
      success: false,
      error: 'Yarn Berry (v2+) lockfile format is not supported in this version',
      code: 'UNSUPPORTED_FORMAT',
    };
  }
}
