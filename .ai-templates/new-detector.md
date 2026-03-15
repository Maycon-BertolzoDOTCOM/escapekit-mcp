# 🛡️ AI Template: New Security Detector

## Context
We are creating a new security detector for the EscapeKit MCP project. Detectors identify malicious or risky patterns in AI-generated code that could compromise the developer's project.

## Task
Create a detector called `[DetectorName]` that identifies **[description of the malicious/security pattern]**.

## Technical Requirements

### 1. File Location
- Source: `src/security/[DetectorName].ts`
- Tests: `tests/security/[DetectorName].test.ts`
- Types: Add new types to `src/security/types.ts` if needed

### 2. Implementation Pattern
```typescript
// Follow the pattern of existing detectors (e.g., PostInstallDetector.ts)
import { SecurityIssue, SeverityLevel } from './types';

export class [DetectorName] {
  analyze(input: AnalysisInput): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    // Detection logic here
    return issues;
  }
}
```

### 3. Detection Categories
Use existing severity levels from `src/security/types.ts`:
- `critical` — Active exploitation vector (malicious postinstall, typosquatting)
- `high` — Known dangerous pattern (eval of remote code, obfuscated scripts)
- `medium` — Suspicious pattern needing review (unusual dependencies, indirect evals)
- `low` — Informational finding (deprecated API usage, non-standard patterns)

### 4. Testing Requirements
- **Positive cases**: At least 3 code samples that SHOULD trigger detection
- **Negative cases**: At least 2 code samples that should NOT trigger false positives
- **Edge cases**: Empty input, malformed code, unicode obfuscation
- Use Vitest with descriptive test names

### 5. Integration
- Register the detector in the main analysis pipeline
- Add it to the `knowledge-base.json` if it involves new package mappings
- Update `README.md` features section
- Update `PROJECT_HEALTH.md` security coverage

## Example Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { [DetectorName] } from '../../src/security/[DetectorName]';

describe('[DetectorName]', () => {
  const detector = new [DetectorName]();

  describe('positive detections', () => {
    it('should detect [pattern 1]', () => {
      const input = `...`;
      const issues = detector.analyze({ code: input });
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('critical');
    });
  });

  describe('false positive prevention', () => {
    it('should NOT flag [legitimate pattern]', () => {
      const input = `...`;
      const issues = detector.analyze({ code: input });
      expect(issues).toHaveLength(0);
    });
  });
});
```

## Reference
- Existing detectors: `src/security/PostInstallDetector.ts`, `src/security/DeepDependencyScanner.ts`
- Security types: `src/security/types.ts`
- Error classes: `src/errors.ts`
