import { describe, it, expect } from 'vitest';
import {
  MappingStrategy,
  ResolutionMethod,
  TransformationType
} from '../../src/models/transformation';

describe('MappingStrategy', () => {
  it('should have EXACT_MATCH value', () => {
    expect(MappingStrategy.EXACT_MATCH).toBe('EXACT_MATCH');
  });

  it('should have SEMANTIC_MATCH value', () => {
    expect(MappingStrategy.SEMANTIC_MATCH).toBe('SEMANTIC_MATCH');
  });

  it('should have MANUAL_OVERRIDE value', () => {
    expect(MappingStrategy.MANUAL_OVERRIDE).toBe('MANUAL_OVERRIDE');
  });

  it('should have FALLBACK value', () => {
    expect(MappingStrategy.FALLBACK).toBe('FALLBACK');
  });
});

describe('ResolutionMethod', () => {
  it('should have KNOWLEDGE_BASE value', () => {
    expect(ResolutionMethod.KNOWLEDGE_BASE).toBe('KNOWLEDGE_BASE');
  });

  it('should have NPM_SEARCH value', () => {
    expect(ResolutionMethod.NPM_SEARCH).toBe('NPM_SEARCH');
  });

  it('should have SEMANTIC_ANALYSIS value', () => {
    expect(ResolutionMethod.SEMANTIC_ANALYSIS).toBe('SEMANTIC_ANALYSIS');
  });

  it('should have USER_PROVIDED value', () => {
    expect(ResolutionMethod.USER_PROVIDED).toBe('USER_PROVIDED');
  });
});

describe('TransformationType', () => {
  it('should have IMPORT_REPLACEMENT value', () => {
    expect(TransformationType.IMPORT_REPLACEMENT).toBe('IMPORT_REPLACEMENT');
  });

  it('should have POLYFILL_INJECTION value', () => {
    expect(TransformationType.POLYFILL_INJECTION).toBe('POLYFILL_INJECTION');
  });

  it('should have API_MIGRATION value', () => {
    expect(TransformationType.API_MIGRATION).toBe('API_MIGRATION');
  });

  it('should have CONFIGURATION_GENERATION value', () => {
    expect(TransformationType.CONFIGURATION_GENERATION).toBe('CONFIGURATION_GENERATION');
  });
});
