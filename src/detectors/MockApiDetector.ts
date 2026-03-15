/**
 * Mock API Detector
 * 
 * Detects mock API calls in code (mockapi.io, jsonplaceholder, localhost, etc.)
 */

import { logger } from '../logger.js';

export interface MockApiCall {
  /** Function or API name */
  function: string;
  /** The endpoint URL or pattern */
  endpoint: string;
  /** Line number where mock API call was found */
  line: number;
  /** Column number where mock API call was found */
  column: number;
}

export interface MockApiPattern {
  /** Regular expression pattern to match */
  pattern: RegExp;
  /** Type of mock API */
  type: string;
}

/**
 * Default mock API patterns to detect
 */
const DEFAULT_MOCK_API_PATTERNS: MockApiPattern[] = [
  {
    pattern: /mockapi\.io/i,
    type: 'mockapi.io',
  },
  {
    pattern: /jsonplaceholder\.typicode\.com/i,
    type: 'jsonplaceholder',
  },
  {
    pattern: /localhost:\d+/i,
    type: 'localhost',
  },
  {
    pattern: /127\.0\.0\.1:\d+/i,
    type: 'localhost',
  },
  {
    pattern: /0\.0\.0\.0:\d+/i,
    type: 'localhost',
  },
  {
    pattern: /\[::1\]:\d+/i,
    type: 'localhost',
  },
];

export class MockApiDetector {
  private readonly patterns: MockApiPattern[];
  private readonly logger = logger.child('MockApiDetector');

  constructor(patterns: MockApiPattern[] = DEFAULT_MOCK_API_PATTERNS) {
    this.patterns = [...patterns];
    this.logger.debug(`Initialized with ${patterns.length} patterns`);
  }

  /**
   * Detect all mock API calls in code
   */
  detect(code: string): MockApiCall[] {
    const mockApis: MockApiCall[] = [];

    for (const { pattern, type } of this.patterns) {
      let match;
      const regex = new RegExp(pattern, 'gi');
      
      while ((match = regex.exec(code)) !== null) {
        const position = this.findPosition(code, match.index);
        
        mockApis.push({
          function: type,
          endpoint: match[0],
          line: position.line,
          column: position.column,
        });
      }
    }

    if (mockApis.length > 0) {
      this.logger.debug(`Detected ${mockApis.length} mock API calls`);
    }

    return mockApis;
  }

  /**
   * Add a custom mock API pattern
   */
  addPattern(pattern: MockApiPattern): void {
    this.patterns.push(pattern);
    this.logger.debug(`Added pattern for: ${pattern.type}`);
  }

  /**
   * Remove all patterns
   */
  clearPatterns(): void {
    this.patterns.length = 0;
    this.logger.debug('Cleared all patterns');
  }

  /**
   * Get all current patterns
   */
  getPatterns(): MockApiPattern[] {
    return [...this.patterns];
  }

  /**
   * Convert character index to line and column
   */
  private findPosition(code: string, index: number): { line: number; column: number } {
    let line = 0;
    let column = 0;

    for (let i = 0; i < index && i < code.length; i++) {
      if (code[i] === '\n') {
        line++;
        column = 0;
      } else {
        column++;
      }
    }

    return { line: line + 1, column: column + 1 };
  }

  /**
   * Check if a URL is a known mock API
   */
  isMockApi(url: string): boolean {
    for (const { pattern } of this.patterns) {
      if (pattern.test(url)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the type of mock API from a URL
   */
  getMockApiType(url: string): string | null {
    for (const { pattern, type } of this.patterns) {
      if (pattern.test(url)) {
        return type;
      }
    }
    return null;
  }
}

/**
 * Create a default MockApiDetector instance
 */
export function createMockApiDetector(): MockApiDetector {
  return new MockApiDetector();
}
