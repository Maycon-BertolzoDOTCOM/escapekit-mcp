const fs = require('fs');
const path = require('path');

const detectorPath = 'src/detectors/WebGLDetector.ts';
const outputPath = 'tests/generated/WebGLDetector.test.ts';

console.log('Generating test for:', detectorPath);

const testCode = `import { describe, it, expect } from 'vitest';
import { WebGLDetector, createWebGLDetector } from '../../${detectorPath}';

describe('WebGLDetector', () => {
  describe('detect', () => {
    it('should detect Three.js imports', () => {
      const detector = createWebGLDetector();
      const code = 'import { Scene } from "three";';
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].type).toBe('threejs');
    });

    it('should detect React Three Fiber imports', () => {
      const detector = createWebGLDetector();
      const code = 'import { Canvas } from "@react-three/fiber";';
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].type).toBe('react-three-fiber');
    });

    it('should detect WebGL context usage', () => {
      const detector = createWebGLDetector();
      const code = 'canvas.getContext("webgl");';
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].type).toBe('webgl');
    });

    it('should detect Three.js constructor usage', () => {
      const detector = createWebGLDetector();
      const code = 'const scene = new THREE.Scene();';
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].type).toBe('threejs');
    });

    it('should detect canvas element creation', () => {
      const detector = createWebGLDetector();
      const code = 'const canvas = document.createElement("canvas");';
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].type).toBe('canvas');
    });
  });

  describe('usesThreeJs', () => {
    it('should return true for Three.js code', () => {
      const detector = createWebGLDetector();
      const code = 'import * as THREE from "three";';
      expect(detector.usesThreeJs(code)).toBe(true);
    });

    it('should return false for non-Three.js code', () => {
      const detector = createWebGLDetector();
      const code = 'const x = 1;';
      expect(detector.usesThreeJs(code)).toBe(false);
    });
  });

  describe('usesWebGL', () => {
    it('should return true for WebGL code', () => {
      const detector = createWebGLDetector();
      const code = 'canvas.getContext("webgl2");';
      expect(detector.usesWebGL(code)).toBe(true);
    });

    it('should return false for non-WebGL code', () => {
      const detector = createWebGLDetector();
      const code = 'const x = 1;';
      expect(detector.usesWebGL(code)).toBe(false);
    });
  });

  describe('getWebGLTypes', () => {
    it('should return unique WebGL types', () => {
      const detector = createWebGLDetector();
      const code = 'import THREE from "three"; canvas.getContext("webgl");';
      const types = detector.getWebGLTypes(code);
      expect(types.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getFallbackRecommendations', () => {
    it('should provide recommendations for Three.js', () => {
      const detector = createWebGLDetector();
      const code = 'import { Scene } from "three";';
      const recommendations = detector.getFallbackRecommendations(code);
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
});
`;

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, testCode, 'utf-8');
console.log('Test saved to:', outputPath);
console.log('Done!');
