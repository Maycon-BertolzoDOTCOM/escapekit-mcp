/**
 * PackageJsonParser
 * 
 * Parses package.json files and extracts security-relevant information
 */

import { PackageJson, InstallationScript } from './types.js';

/**
 * Parser for package.json files
 * 
 * Handles parsing, extraction of installation scripts and dependencies,
 * and serialization back to JSON format.
 */
export class PackageJsonParser {
  /**
   * Parse a JSON string into a PackageJson object
   * 
   * @param content - JSON string content
   * @returns Parsed PackageJson object
   * @throws Error if JSON is invalid
   */
  parse(content: string): PackageJson {
    try {
      const parsed = JSON.parse(content);
      
      // Validate that it's an object
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('package.json must be a JSON object');
      }
      
      return parsed as PackageJson;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in package.json: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extract installation scripts from a PackageJson object
   * 
   * Extracts postinstall, preinstall, and install scripts from the scripts field.
   * Returns an empty array if no installation scripts are found.
   * 
   * @param packageJson - Parsed PackageJson object
   * @returns Array of InstallationScript objects
   */
  extractScripts(packageJson: PackageJson): InstallationScript[] {
    const scripts: InstallationScript[] = [];
    
    if (!packageJson.scripts || typeof packageJson.scripts !== 'object') {
      return scripts;
    }
    
    const scriptTypes: Array<'postinstall' | 'preinstall' | 'install'> = [
      'postinstall',
      'preinstall',
      'install',
    ];
    
    for (const type of scriptTypes) {
      const content = packageJson.scripts[type];
      if (typeof content === 'string') {
        scripts.push({ type, content });
      }
    }
    
    return scripts;
  }

  /**
   * Extract all dependency names from a PackageJson object
   * 
   * Extracts dependency names from both dependencies and devDependencies fields.
   * Returns an empty array if no dependencies are found.
   * 
   * @param packageJson - Parsed PackageJson object
   * @returns Array of dependency names
   */
  extractDependencies(packageJson: PackageJson): string[] {
    const dependencies: string[] = [];
    
    // Extract from dependencies
    if (packageJson.dependencies && typeof packageJson.dependencies === 'object') {
      dependencies.push(...Object.keys(packageJson.dependencies));
    }
    
    // Extract from devDependencies
    if (packageJson.devDependencies && typeof packageJson.devDependencies === 'object') {
      dependencies.push(...Object.keys(packageJson.devDependencies));
    }
    
    return dependencies;
  }

  /**
   * Serialize a PackageJson object back to a JSON string
   * 
   * Preserves all fields during serialization to support round-trip parsing.
   * 
   * @param packageJson - PackageJson object to serialize
   * @returns JSON string representation
   */
  serialize(packageJson: PackageJson): string {
    return JSON.stringify(packageJson, null, 2);
  }
}
