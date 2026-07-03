/**
 * WebGL Detector
 * 
 * Detects WebGL and related graphics library usage in code
 */

import { logger } from '../logger.js';

export interface WebGLUsage {
  /** Type of WebGL usage (threejs, webgl, canvas, etc.) */
  type: string;
  /** Line number where WebGL usage was found */
  line: number;
  /** Column number where WebGL usage was found */
  column: number;
}

export interface WebGLPattern {
  /** Regular expression pattern to match */
  pattern: RegExp;
  /** Type of WebGL usage */
  type: string;
}

/**
 * Default WebGL patterns to detect
 */
const DEFAULT_WEBGL_PATTERNS: WebGLPattern[] = [
  {
    pattern: /three\.js|import.*from\s+['"]three['"]/i,
    type: 'threejs',
  },
  {
    pattern: /import.*from\s+['"]@react-three\/fiber['"]/i,
    type: 'react-three-fiber',
  },
  {
    pattern: /import.*from\s+['"]@react-three\/drei['"]/i,
    type: 'react-three-drei',
  },
  {
    pattern: /WebGL(?:RenderingContext|2|1)\s*\(/i,
    type: 'webgl',
  },
  {
    pattern: /canvas\.getContext\s*\(\s*['"]webgl/i,
    type: 'webgl',
  },
  {
    pattern: /canvas\.getContext\s*\(\s*['"]experimental-webgl/i,
    type: 'webgl-experimental',
  },
  {
    pattern: /canvas\.getContext\s*\(\s*['"]webgl2/i,
    type: 'webgl2',
  },
  {
    pattern: /document\.createElement\s*\(\s*['"]canvas/i,
    type: 'canvas',
  },
  {
    pattern: /THREE\.(?:Renderer|Scene|Camera|Mesh|Geometry|Material|Texture)/i,
    type: 'threejs',
  },
  {
    pattern: /new\s+(?:THREE\.|WebGL)/i,
    type: 'webgl',
  },
];

export class WebGLDetector {
  private readonly patterns: WebGLPattern[];
  private readonly logger = logger.child('WebGLDetector');

  constructor(patterns: WebGLPattern[] = DEFAULT_WEBGL_PATTERNS) {
    this.patterns = [...patterns];
    this.logger.debug(`Initialized with ${patterns.length} patterns`);
  }

  /**
   * Detect all WebGL usage in code
   */
  detect(code: string): WebGLUsage[] {
    const usages: WebGLUsage[] = [];

    for (const { pattern, type } of this.patterns) {
      let match;
      const regex = new RegExp(pattern, 'g');
      
      while ((match = regex.exec(code)) !== null) {
        const position = this.findPosition(code, match.index);
        usages.push({
          type,
          line: position.line,
          column: position.column,
        });
      }
    }

    if (usages.length > 0) {
      this.logger.debug(`Detected ${usages.length} WebGL usages`);
    }

    return usages;
  }

  /**
   * Add a custom WebGL pattern
   */
  addPattern(pattern: WebGLPattern): void {
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
  getPatterns(): WebGLPattern[] {
    return [...this.patterns];
  }

  /**
   * Check if code uses Three.js
   */
  usesThreeJs(code: string): boolean {
    const threeJsPatterns = this.patterns.filter(p => p.type === 'threejs' || p.type === 'react-three-fiber' || p.type === 'react-three-drei');
    
    for (const { pattern } of threeJsPatterns) {
      if (pattern.test(code)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if code uses WebGL
   */
  usesWebGL(code: string): boolean {
    const webglPatterns = this.patterns.filter(p => p.type.includes('webgl'));
    
    for (const { pattern } of webglPatterns) {
      if (pattern.test(code)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get unique WebGL types detected
   */
  getWebGLTypes(code: string): string[] {
    const usages = this.detect(code);
    return Array.from(new Set(usages.map(u => u.type)));
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
   * Get WebGL fallback recommendations
   */
  getFallbackRecommendations(code: string): string[] {
    const types = this.getWebGLTypes(code);
    const recommendations: string[] = [];

    if (types.includes('threejs') || types.includes('react-three-fiber')) {
      recommendations.push(
        'Add WebGL support detection using navigator.userAgent',
        'Implement fallback to Canvas 2D or SVG rendering',
        'Consider using CSS 3D transforms as a fallback option'
      );
    }

    if (types.some(t => t.includes('webgl'))) {
      recommendations.push(
        'Check for WebGL context creation failures',
        'Gracefully degrade to 2D canvas context',
        'Provide user feedback when WebGL is not supported'
      );
    }

    if (types.includes('canvas')) {
      recommendations.push(
        'Implement 2D canvas fallback for non-graphics browsers',
        'Add accessibility features for screen readers',
        'Consider using CSS animations as a lightweight alternative'
      );
    }

    return recommendations;
  }
}

/**
 * Create a default WebGLDetector instance
 */
export function createWebGLDetector(): WebGLDetector {
  return new WebGLDetector();
}