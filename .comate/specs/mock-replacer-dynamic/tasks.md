# MockReplacer Dynamic Resolution Implementation

- [x] 1. Refactor MockReplacer constructor with dependency injection
    - 1.1: Add `MockReplacerDeps` interface with optional fields
    - 1.2: Update constructor to accept deps with defaults
    - 1.3: Verify AutoFixEngine compatibility
    - 1.4: File: `src/validate/auto-fix/MockReplacer.ts`

- [x] 2. Extract helper methods from `fix` method
    - 2.1: Extract `extractGhostImport` with regex
    - 2.2: Extract `applyReplacement` with text replacement logic
    - 2.3: Preserve quote/import behavior
    - 2.4: File: `src/validate/auto-fix/MockReplacer.ts`

- [x] 3. Implement `resolveReplacement` with Resolution_Chain
    - [x] 3.1: Implement KnowledgeBase.getMapping step
    - [x] 3.2: Implement SemanticMatcher.findSimilar step
    - [x] 3.3: Implement NPMRegistry.packageExists step
    - [x] 3.4: Implement hardcoded replacements fallback
    - 3.5: File: `src/validate/auto-fix/MockReplacer.ts`

- [x] 4. Implement lazy KnowledgeBase initialization
    - 4.1: Add `kbInitialized` flag
    - 4.2: Load knowledge-base.json on first call
    - 4.3: Handle I/O errors gracefully
    - 4.4: File: `src/validate/auto-fix/MockReplacer.ts`

- [x] 5. Update `fix` method to use new helpers
    - 5.1: Replace method body with new helper calls
    - 5.2: Handle 'npm-registry-verified' special case
    - 5.3: Maintain existing file validations
    - 5.4: File: `src/validate/auto-fix/MockReplacer.ts`

- [x] 6. Write unit tests for refactored MockReplacer
    - [x] 6.1: Test KnowledgeBase resolution path
    - [x] 6.2: Test SemanticMatcher resolution path
    - [x] 6.3: Test NPMRegistry verification path
    - [x] 6.4: Test hardcoded fallback path
    - [x] 6.5: Test no-resolution case
    - [x] 6.6: Test error resilience
    - [x] 6.7: Test hardcoded mappings compatibility
    - [x] 6.8: File: `tests/validate/MockReplacer.test.ts`

- [x] 7. Verify diagnostics and fix type errors
    - [x] 7.1: Run TypeScript diagnostics
    - [x] 7.2: Fix any introduced type errors
    - [x] 7.3: Verify AutoFixEngine compatibility
    - [x] 7.4: Files: `src/validate/auto-fix/MockReplacer.ts`, `src/validate/auto-fix/AutoFixEngine.ts`
