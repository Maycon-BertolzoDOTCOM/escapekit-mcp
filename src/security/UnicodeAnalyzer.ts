/**
 * UnicodeAnalyzer
 * 
 * Detects Unicode-based attacks including homoglyph spoofing (TR39),
 * invisible character obfuscation, and bidirectional (Bidi) algorithm exploits 
 * (like CVE-2021-42574) in package names and source code scripts.
 */

import { Issue, generateId } from '../models/schemas.js';
import { logger } from '../logger.js';

export class UnicodeAnalyzer {
  private readonly log = logger.child('UnicodeAnalyzer');

  // Invisible/Zero-width characters often used for obfuscation
  private readonly invisibleChars = [
    '\u200B', // Zero-width space
    '\u200C', // Zero-width non-joiner
    '\u200D', // Zero-width joiner
    '\u2060', // Word joiner
    '\uFEFF', // Zero-width no-break space (Byte Order Mark)
    '\u3164', // Hangul filler
    '\uFFA0', // Half-width hangul filler
    '\u2800'  // Braille pattern blank
  ];

  // Bidi control characters (CVE-2021-42574 Trojan Source)
  private readonly bidiChars = [
    '\u202A', // Left-to-Right Embedding (LRE)
    '\u202B', // Right-to-Left Embedding (RLE)
    '\u202C', // Pop Directional Formatting (PDF)
    '\u202D', // Left-to-Right Override (LRO)
    '\u202E', // Right-to-Left Override (RLO)
    '\u2066', // Left-to-Right Isolate (LRI)
    '\u2067', // Right-to-Left Isolate (RLI)
    '\u2068', // First Strong Isolate (FSI)
    '\u2069'  // Pop Directional Isolate (PDI)
  ];

  // Common confusable scripts with Latin
  private readonly cyrillicRegex = /[\u0400-\u04FF]/;
  private readonly greekRegex = /[\u0370-\u03FF]/;
  private readonly latinRegex = /[a-zA-Z]/;

  /**
   * Analyze a package name or string for Unicode-based threats
   * @param input String to analyze (package name, script code, etc.)
   * @param context Description of what is being analyzed (for issue generation)
   */
  analyze(input: string, context: 'package_name' | 'script' = 'package_name'): Issue[] {
    this.log.debug(`Analyzing ${context} for Unicode threats`);
    const issues: Issue[] = [];

    // 1. Invisible Character Check
    const foundInvisibles = this.invisibleChars.filter(char => input.includes(char));
    if (foundInvisibles.length > 0) {
      issues.push({
        id: generateId('issue_unicode'),
        type: 'unicode_risk',
        severity: 'warning',
        location: { file: context === 'package_name' ? 'package.json' : 'script', line: 1, column: 1 },
        message: 'Invisible Unicode characters detected',
        description: `Found invisible/zero-width characters that are commonly used to obfuscate code or bypass security filters.`,
        suggestion: 'Remove invisible characters. Verify this is not an attempt to hide execution logic or masquerade as another package.',
        autoFixable: false
      });
    }

    // 2. Bidi Attack Check (Trojan Source)
    const foundBidi = this.bidiChars.filter(char => input.includes(char));
    if (foundBidi.length > 0) {
      issues.push({
        id: generateId('issue_unicode'),
        type: 'unicode_risk',
        severity: 'error',       // Bidi overrides in code are highly malicious
        location: { file: context === 'package_name' ? 'package.json' : 'script', line: 1, column: 1 },
        message: 'Potentially malicious bidirectional (Bidi) Unicode characters detected',
        description: `Detected directional override characters (like RLO). These can be used to make malicious code appear harmless in editors (CVE-2021-42574 "Trojan Source").`,
        suggestion: 'Do not trust the visual representation of this text. Use a hex editor or strip Bidi characters to reveal the true execution path.',
        autoFixable: false
      });
    }

    // 3. Mixed Script / Homoglyph Check (strictly for package names)
    if (context === 'package_name') {
      const hasLatin = this.latinRegex.test(input);
      const hasCyrillic = this.cyrillicRegex.test(input);
      const hasGreek = this.greekRegex.test(input);

      if (hasLatin && (hasCyrillic || hasGreek)) {
        issues.push({
          id: generateId('issue_unicode'),
          type: 'unicode_risk',
          severity: 'error',
          location: { file: 'package.json', line: 1, column: 1 },
          message: 'Mixed-script package name detected (Homoglyph Attack)',
          description: `The package name mixes Latin characters with confusable scripts (Cyrillic/Greek). Example: 'pаypal' using a Cyrillic 'а'.`,
          suggestion: 'This is extremely likely to be a typosquatting/homoglyph attack. Abort installation immediately and verify the correct package name (ASCII only).',
          autoFixable: false
        });
      }
    }

    return issues;
  }
}
