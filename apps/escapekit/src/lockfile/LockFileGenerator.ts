/**
 * LockFileGenerator - Reproducible builds via lock files (自主创新)
 * Generates and validates package-lock.json for deterministic installs.
 */
import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { logger } from '../logger.js';

export interface LockFileEntry {
  name: string;
  version: string;
  resolved: string;
  integrity: string;
  dependencies?: Record<string, string>;
}

export interface LockFile {
  lockfileVersion: number;
  name: string;
  version: string;
  packages: Record<string, LockFileEntry>;
  generatedAt: string;
}

export class LockFileGenerator {
  private readonly log = logger.child('LockFileGenerator');

  /** Generate a lock file from resolved dependencies */
  generate(projectName: string, projectVersion: string, dependencies: Map<string, string>): LockFile {
    const packages: Record<string, LockFileEntry> = {};

    for (const [name, version] of dependencies) {
      const resolved = `https://registry.npmjs.org/${name}/-/${name}-${version.replace(/[\^~>=<]/g, '')}.tgz`;
      const integrity = this.calculateIntegrity(name, version);

      packages[`node_modules/${name}`] = {
        name,
        version: version.replace(/[\^~>=<]/g, '') || version,
        resolved,
        integrity,
      };
    }

    const lockFile: LockFile = {
      lockfileVersion: 3,
      name: projectName,
      version: projectVersion,
      packages,
      generatedAt: new Date().toISOString(),
    };

    this.log.info('Lock file generated', { project: projectName, packages: Object.keys(packages).length });
    return lockFile;
  }

  /** Write lock file to disk */
  async writeToFile(lockFile: LockFile, outputPath: string): Promise<void> {
    await writeFile(outputPath, JSON.stringify(lockFile, null, 2), 'utf-8');
    this.log.info('Lock file written', { path: outputPath });
  }

  /** Validate lock file integrity */
  async validate(lockFilePath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const raw = await readFile(lockFilePath, 'utf-8');
      const lockFile: LockFile = JSON.parse(raw);

      if (!lockFile.lockfileVersion) errors.push('Missing lockfileVersion');
      if (!lockFile.name) errors.push('Missing name');
      if (!lockFile.packages) errors.push('Missing packages');

      // Validate integrity hashes
      for (const [key, entry] of Object.entries(lockFile.packages ?? {})) {
        if (!entry.integrity) {
          errors.push(`Missing integrity for ${key}`);
        } else if (!entry.integrity.startsWith('sha256-') && !entry.integrity.startsWith('sha512-')) {
          errors.push(`Invalid integrity format for ${key}`);
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (err) {
      return { valid: false, errors: [`Failed to parse lock file: ${(err as Error).message}`] };
    }
  }

  /** Calculate integrity hash for a package */
  calculateIntegrity(packageName: string, version: string): string {
    // In production this would be the actual tarball hash
    // Here we generate a deterministic placeholder
    const content = `${packageName}@${version}`;
    const hash = createHash('sha256').update(content).digest('base64');
    return `sha256-${hash}`;
  }
}
