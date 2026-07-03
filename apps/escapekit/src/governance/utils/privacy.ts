/**
 * CodeMemória Governance — Differential Privacy
 *
 * Adds calibrated noise to embeddings before transmission,
 * guaranteeing ε-differential privacy.
 *
 * @module governance/utils/privacy
 */

import type { NoiseType } from '../types.js';
import { InvalidPrivacyParameterError } from '../errors.js';

export interface IDifferentialPrivacy {
  addNoise(embedding: Float32Array, epsilon: number, noiseType: NoiseType): Float32Array;
}

export class DifferentialPrivacy implements IDifferentialPrivacy {
  /**
   * Adds Laplace or Gaussian noise to an embedding vector.
   *
   * @param embedding - Input Float32Array of 384 dimensions
   * @param epsilon   - Privacy budget (must be > 0)
   * @param noiseType - 'laplace' or 'gaussian'
   * @returns New Float32Array with noise added (same length as input)
   * @throws InvalidPrivacyParameterError if epsilon <= 0
   */
  addNoise(embedding: Float32Array, epsilon: number, noiseType: NoiseType): Float32Array {
    if (epsilon <= 0) {
      throw new InvalidPrivacyParameterError(
        `epsilon must be greater than 0, got ${epsilon}`
      );
    }

    const result = new Float32Array(embedding.length);

    if (noiseType === 'laplace') {
      this._addLaplaceNoise(embedding, result, epsilon);
    } else {
      this._addGaussianNoise(embedding, result, epsilon);
    }

    return result;
  }

  /**
   * Laplace mechanism: scale = sensitivity / epsilon
   * noise[i] = -scale * sign(u) * ln(1 - 2|u|)  where u ~ Uniform(-0.5, 0.5)
   */
  private _addLaplaceNoise(
    input: Float32Array,
    output: Float32Array,
    epsilon: number
  ): void {
    const sensitivity = 1.0;
    const scale = sensitivity / epsilon;

    for (let i = 0; i < input.length; i++) {
      const u = Math.random() - 0.5; // Uniform(-0.5, 0.5)
      const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
      output[i] = input[i] + noise;
    }
  }

  /**
   * Gaussian mechanism (Box-Muller transform):
   * sigma = sensitivity * sqrt(2 * ln(1.25 / delta)) / epsilon  (delta = 1e-5)
   * noise[i] = sqrt(-2*ln(u1)) * cos(2π*u2) * sigma
   */
  private _addGaussianNoise(
    input: Float32Array,
    output: Float32Array,
    epsilon: number
  ): void {
    const sensitivity = 1.0;
    const delta = 1e-5;
    const sigma = sensitivity * Math.sqrt(2 * Math.log(1.25 / delta)) / epsilon;

    for (let i = 0; i < input.length; i += 2) {
      const u1 = Math.random();
      const u2 = Math.random();
      const mag = Math.sqrt(-2 * Math.log(u1));
      const noise1 = mag * Math.cos(2 * Math.PI * u2) * sigma;
      const noise2 = mag * Math.sin(2 * Math.PI * u2) * sigma;

      output[i] = input[i] + noise1;
      if (i + 1 < input.length) {
        output[i + 1] = input[i + 1] + noise2;
      }
    }
  }
}
