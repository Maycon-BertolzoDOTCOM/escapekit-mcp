/**
 * Plugin Dependency Resolver
 *
 * DFS-based dependency resolution with cycle detection,
 * cross-marketplace security boundary, and fixed-point verification.
 *
 * Inspired by Claude Code's utils/plugins/dependencyResolver.ts.
 *
 * Usage:
 *   import { resolveDependencies, verifyAndDemote } from './utils/dependencyResolver.js'
 *
 *   // Install-time: resolve closure
 *   const closure = resolveDependencies('plugin-a', getPlugin)
 *
 *   // Load-time: verify and demote unsatisfied
 *   const active = verifyAndDemote(enabledPlugins, getPlugin)
 */

interface Plugin {
  name: string;
  version: string;
  dependencies: string[];
  marketplace: string;
  enabled: boolean;
}

type GetPluginFn = (name: string) => Plugin | undefined;

/**
 * Resolve the full dependency closure for a plugin (DFS with cycle detection).
 *
 * Returns the ordered list of plugins to install (dependencies first).
 */
export function resolveDependencies(
  rootName: string,
  getPlugin: GetPluginFn,
): { ordered: string[]; errors: string[] } {
  const ordered: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // For cycle detection
  const errors: string[] = [];

  function dfs(name: string, sourceMarketplace: string): void {
    if (visited.has(name)) return;

    if (visiting.has(name)) {
      errors.push(`Circular dependency detected: ${name}`);
      return;
    }

    visiting.add(name);

    const plugin = getPlugin(name);
    if (!plugin) {
      errors.push(`Missing dependency: ${name}`);
      visiting.delete(name);
      return;
    }

    // Cross-marketplace check
    if (plugin.marketplace !== sourceMarketplace) {
      errors.push(
        `Cross-marketplace dependency blocked: ${name} (${plugin.marketplace}) ` +
        `requested by plugin in ${sourceMarketplace}`,
      );
      visiting.delete(name);
      return;
    }

    // Recurse into dependencies
    for (const dep of plugin.dependencies) {
      dfs(dep, sourceMarketplace);
    }

    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  }

  const root = getPlugin(rootName);
  if (!root) {
    return { ordered: [], errors: [`Plugin not found: ${rootName}`] };
  }

  dfs(rootName, root.marketplace);

  return { ordered, errors };
}

/**
 * Verify that all dependencies of enabled plugins are satisfied.
 * Demote plugins with unsatisfied dependencies.
 *
 * Uses a fixed-point loop: demoting A may break B that depends on A.
 * Repeat until nothing changes.
 *
 * @returns Set of plugin names that remain enabled
 */
export function verifyAndDemote(
  enabledPlugins: string[],
  getPlugin: GetPluginFn,
): { active: Set<string>; demoted: string[] } {
  const active = new Set(enabledPlugins);
  const demoted: string[] = [];
  let changed = true;

  while (changed) {
    changed = false;

    for (const name of Array.from(active)) {
      const plugin = getPlugin(name);
      if (!plugin) {
        active.delete(name);
        demoted.push(name);
        changed = true;
        continue;
      }

      // Check all dependencies are satisfied
      const unsatisfied = plugin.dependencies.filter((dep) => !active.has(dep));
      if (unsatisfied.length > 0) {
        active.delete(name);
        demoted.push(name);
        changed = true;
      }
    }
  }

  return { active, demoted };
}
