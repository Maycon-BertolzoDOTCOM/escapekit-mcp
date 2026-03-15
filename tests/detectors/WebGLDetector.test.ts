/**
 * WebGLDetector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebGLDetector, createWebGLDetector } from '../../src/detectors/WebGLDetector.js';

describe('WebGLDetector', () => {
  let detector: WebGLDetector;

  beforeEach(() => {
    detector = createWebGLDetector();
  });

  describe('detect', () => {
    it('should detect Three.js imports', () => {
      const code = "import * as THREE from 'three';";
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('threejs');
    });

    it('should detect Three.js object creation', () => {
      const code = `
        const renderer = new THREE.WebGLRenderer();
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
      `;
      
      const results = detector.detect(code);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.type === 'threejs')).toBe(true);
    });

    it('should detect React Three Fiber imports', () => {
      const code = `
        import { Canvas } from '@react-three/fiber';
        import { OrbitControls } from '@react-three/drei';
      `;
      
      const results = detector.detect(code);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.type === 'react-three-fiber')).toBe(true);
      expect(results.some(r => r.type === 'react-three-drei')).toBe(true);
    });

    it('should detect WebGLRenderingContext', () => {
      const code = `
        const canvas = document.getElementById('canvas');
        const gl = canvas.getContext('webgl');
        const context = new WebGLRenderingContext();
      `;
      
      const results = detector.detect(code);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.type === 'webgl')).toBe(true);
    });

    it('should detect canvas getContext calls', () => {
      const code = `
        const canvas = document.getElementById('myCanvas');
        const gl = canvas.getContext('webgl');
        const gl2 = canvas.getContext('webgl2');
        const experimental = canvas.getContext('experimental-webgl');
      `;
      
      const results = detector.detect(code);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.type === 'webgl')).toBe(true);
      expect(results.some(r => r.type === 'webgl2')).toBe(true);
      expect(results.some(r => r.type === 'webgl-experimental')).toBe(true);
    });

    it('should detect canvas element creation', () => {
      const code = `
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('canvas');
    });

    it('should return empty array when no WebGL is found', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        
        export function App() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(0);
    });

    it('should detect multiple WebGL usages', () => {
      const code = `
        import * as THREE from 'three';
        import { Canvas } from '@react-three/fiber';
        
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
      `;
      
      const results = detector.detect(code);
      
      expect(results.length).toBeGreaterThan(2);
    });

    it('should capture line and column positions', () => {
      const code = `
import * as THREE from 'three';
`;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].line).toBe(2);
      expect(results[0].column).toBeGreaterThan(0);
    });
  });

  describe('usesThreeJs', () => {
    it('should return true for Three.js imports', () => {
      const code = "import * as THREE from 'three';";
      expect(detector.usesThreeJs(code)).toBe(true);
    });

    it('should return true for React Three Fiber', () => {
      const code = "import { Canvas } from '@react-three/fiber';";
      expect(detector.usesThreeJs(code)).toBe(true);
    });

    it('should return true for React Three Drei', () => {
      const code = "import { OrbitControls } from '@react-three/drei';";
      expect(detector.usesThreeJs(code)).toBe(true);
    });

    it('should return false for non-Three.js code', () => {
      const code = "import React from 'react';";
      expect(detector.usesThreeJs(code)).toBe(false);
    });
  });

  describe('usesWebGL', () => {
    it('should return true for WebGL context', () => {
      const code = "const gl = canvas.getContext('webgl');";
      expect(detector.usesWebGL(code)).toBe(true);
    });

    it('should return true for WebGL2', () => {
      const code = "const gl2 = canvas.getContext('webgl2');";
      expect(detector.usesWebGL(code)).toBe(true);
    });

    it('should return true for WebGLRenderingContext', () => {
      const code = "const gl = new WebGLRenderingContext();";
      expect(detector.usesWebGL(code)).toBe(true);
    });

    it('should return false for non-WebGL code', () => {
      const code = "import React from 'react';";
      expect(detector.usesWebGL(code)).toBe(false);
    });
  });

  describe('getWebGLTypes', () => {
    it('should return unique WebGL types', () => {
      const code = `
        import * as THREE from 'three';
        import { Canvas } from '@react-three/fiber';
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
      `;
      
      const types = detector.getWebGLTypes(code);
      
      expect(types).toContain('threejs');
      expect(types).toContain('react-three-fiber');
      expect(types).toContain('canvas');
      expect(types).toContain('webgl');
      
      // Check uniqueness
      expect(types.length).toBe(new Set(types).size);
    });

    it('should return empty array when no WebGL is found', () => {
      const code = "import React from 'react';";
      
      const types = detector.getWebGLTypes(code);
      
      expect(types).toHaveLength(0);
    });
  });

  describe('getFallbackRecommendations', () => {
    it('should provide Three.js recommendations', () => {
      const code = "import * as THREE from 'three';";
      
      const recommendations = detector.getFallbackRecommendations(code);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('WebGL support detection'))).toBe(true);
      expect(recommendations.some(r => r.includes('fallback'))).toBe(true);
    });

    it('should provide WebGL recommendations', () => {
      const code = "const gl = canvas.getContext('webgl');";
      
      const recommendations = detector.getFallbackRecommendations(code);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('WebGL context'))).toBe(true);
      expect(recommendations.some(r => r.includes('degrade'))).toBe(true);
    });

    it('should provide canvas recommendations', () => {
      const code = "const canvas = document.createElement('canvas');";
      
      const recommendations = detector.getFallbackRecommendations(code);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('fallback'))).toBe(true);
      expect(recommendations.some(r => r.includes('accessibility'))).toBe(true);
    });

    it('should return empty array when no WebGL is found', () => {
      const code = "import React from 'react';";
      
      const recommendations = detector.getFallbackRecommendations(code);
      
      expect(recommendations).toHaveLength(0);
    });
  });

  describe('addPattern', () => {
    it('should add custom pattern', () => {
      const customPattern = {
        pattern: /babylonjs/i,
        type: 'babylonjs',
      };
      
      detector.addPattern(customPattern);
      
      const code = "import * as BABYLON from 'babylonjs';";
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('babylonjs');
    });
  });

  describe('clearPatterns', () => {
    it('should clear all patterns', () => {
      const code = "import * as THREE from 'three';";
      
      // First, verify detection works
      expect(detector.detect(code)).toHaveLength(1);
      
      // Clear patterns
      detector.clearPatterns();
      
      // Now it should not detect anything
      expect(detector.detect(code)).toHaveLength(0);
    });
  });

  describe('getPatterns', () => {
    it('should return all patterns', () => {
      const patterns = detector.getPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach(p => {
        expect(p).toHaveProperty('pattern');
        expect(p).toHaveProperty('type');
        expect(p.pattern).toBeInstanceOf(RegExp);
        expect(typeof p.type).toBe('string');
      });
    });
  });
});