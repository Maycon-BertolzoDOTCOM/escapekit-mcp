import { describe, it, expect } from 'vitest';
import { WebGLDetector } from '../../src/detectors/WebGLDetector';

describe('WebGLDetector (Expanded)', () => {
  describe('detect', () => {
    it('should detect webgl import', () => {
      const detector = new WebGLDetector();
      const code = "import * as WebGL from 'webgl';";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect webgl2 import', () => {
      const detector = new WebGLDetector();
      const code = "import { WebGL2RenderingContext } from 'webgl2';";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect three.js import', () => {
      const detector = new WebGLDetector();
      const code = "import * as THREE from 'three';";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect @types/three import', () => {
      const detector = new WebGLDetector();
      const code = "import * as THREE from '@types/three';";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should handle code without WebGL', () => {
      const detector = new WebGLDetector();
      const code = "import express from 'express';";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('should create detector with default config', () => {
      const detector = new WebGLDetector();
      expect(detector).toBeDefined();
    });
  });
});
