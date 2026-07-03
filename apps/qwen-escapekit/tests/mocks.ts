/**
 * Mocks e Fixtures para testes
 * Dados fictícios para simular APIs externas
 */

export const mockCrossrefResponse = {
  status: 'ok',
  message: {
    title: ['Test Paper Title'],
    author: [
      { family: 'Silva', given: 'João' },
      { family: 'Santos', given: 'Maria' },
    ],
    created: {
      'date-parts': [[2024, 3, 15]],
    },
    abstract: 'This is a test abstract about security and AI.',
  },
};

export const mockArxivResponse = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Test ArXiv Paper Title</title>
    <author>
      <name>John Doe</name>
    </author>
    <author>
      <name>Jane Smith</name>
    </author>
    <published>2024-03-15T10:00:00Z</published>
    <summary>This is a test abstract from arXiv about machine learning and security.</summary>
  </entry>
</feed>`;

export const mockOllamaResponse = {
  response: `source:
  title: "Test Paper Title"
  authors: "Silva, João; Santos, Maria"
  year: 2024
  url: "https://doi.org/10.1234/test"
  doi: "10.1234/test"
  extracted_at: "2024-03-15T10:00:00.000Z"

facts:
  - id: "F001"
    statement: "Test fact extracted from paper"
    type: "fact"
    relevance: "security"

patterns:
  - id: "P001"
    description: "Test pattern observed"
    evidence: ["F001"]
    confidence: "high"

rules:
  - id: "R001"
    principle: "Test principle for implementation"
    derived_from: ["P001"]
    action: "implement_detector"
    detector_name: "TestDetector"
    priority: "high"

cases:
  - id: "C001"
    description: "Test case example"
    attack_vector: "prompt_injection"
    mitigation: "Input validation"

metadata:
  version: "1.0"
  status: "draft"
  tags: ["security", "test"]`,
};

export const mockValidContract = `source:
  title: "Valid Contract Paper"
  authors: "Author One; Author Two"
  year: 2024
  url: "https://example.com/paper"
  doi: "10.1234/valid"

facts:
  - id: "F001"
    statement: "Valid fact statement"
    type: "fact"
    relevance: "security"

patterns:
  - id: "P001"
    description: "Valid pattern description"
    evidence: ["F001"]
    confidence: "high"

rules:
  - id: "R001"
    principle: "Valid principle"
    derived_from: ["P001"]
    action: "implement_detector"
    detector_name: "ValidDetector"
    priority: "high"

cases:
  - id: "C001"
    description: "Valid case description"
    attack_vector: "prompt_injection"
    mitigation: "Validation"

metadata:
  version: "1.0"
  status: "draft"
  tags: ["security"]`;

export const mockInvalidContract = `source:
  title: "Invalid Contract"
  # Missing required fields

facts: "not an array"
patterns: []
rules: []
cases: []`;

export const mockContractMissingSections = `source:
  title: "Incomplete Contract"
  year: 2024`;

export const mockBoilerplateCode = `/**
 * TestDetector - Generated boilerplate
 */

export interface TestDetectorConfig {
  threshold?: number;
}

export interface AnalysisResult {
  hasIssues: boolean;
  issues: string[];
}

export class TestDetector {
  private config: TestDetectorConfig;

  constructor(config: TestDetectorConfig = {}) {
    this.config = config;
  }

  async analyze(code: string): Promise<AnalysisResult> {
    // TODO: Implement analysis logic
    return {
      hasIssues: false,
      issues: [],
    };
  }

  async validate(code: string): Promise<boolean> {
    // TODO: Implement validation logic
    return true;
  }
}`;

export const mockBoilerplateTests = `import { describe, it, expect } from 'vitest';
import { TestDetector } from '../src/security/TestDetector';

describe('TestDetector', () => {
  it('should create instance with default config', () => {
    const detector = new TestDetector();
    expect(detector).toBeDefined();
  });

  it('should analyze code and return result', async () => {
    const detector = new TestDetector();
    const result = await detector.analyze('test code');
    expect(result).toHaveProperty('hasIssues');
    expect(result).toHaveProperty('issues');
  });
});`;
