# WebGL Fallback Templates Implementation Plan

- [x] 1. Create Handlebars templates directory and files
    - 1.1: Create directory `templates/fallback/`
    - 1.2: Create template for Three.js (`three.hbs`)
    - 1.3: Create template for Babylon.js (`babylon.hbs`)
    - 1.4: Create template for PixiJS (`pixi.hbs`)
    - 1.5: Create template for R3F (`r3f.hbs`)
    - 1.6: Create generic template (`generic.hbs`)
    - 1.7: Ensure all templates export required functions with consistent signatures

- [x] 2. Add Handlebars dependency
    - 2.1: Check if Handlebars is already in package.json
    - 2.2: Add "handlebars": "^4.7.8" to dependencies if not present

- [x] 3. Extend FallbackGenerator with framework detection
    - 3.1: Add UIFramework type definition
    - 3.2: Add TemplateContext interface
    - 3.3: Implement detectUIFramework method
    - 3.4: Add tests for framework detection

- [x] 4. Implement template rendering with graceful degradation
    - 4.1: Implement renderTemplate method
    - 4.2: Handle Handlebars import failure
    - 4.3: Handle template file reading errors
    - 4.4: Add tests for graceful degradation

- [x] 5. Refactor fallback code generation
    - 5.1: Rename current method to generateHardcodedFallback
    - 5.2: Implement new generateFallbackCode using templates
    - 5.3: Add fallback to hardcoded version when needed
    - 5.4: Update tests for new behavior

- [x] 6. Implement entry point integration
    - 6.1: Define candidate files per framework
    - 6.2: Implement integrateIntoEntryPoint method
    - 6.3: Ensure idempotent behavior
    - 6.4: Add tests for integration scenarios

- [x] 7. Update main fix method
    - 7.1: Add UI framework detection
    - 7.2: Build template context
    - 7.3: Update fallback code generation call
    - 7.4: Add entry point integration call
    - 7.5: Update description format
    - 7.6: Verify existing behavior remains unchanged

- [x] 8. Write comprehensive unit tests
    - 8.1: Create test file structure
    - 8.2: Mock file system operations
    - 8.3: Test all template selection scenarios
    - 8.4: Test graceful degradation paths
    - 8.5: Test entry point integration
    - 8.6: Verify existing test cases still pass

- [x] 9. Validate and fix type errors
    - 9.1: Check TypeScript diagnostics
    - 9.2: Fix any type errors
    - 9.3: Verify no conflicts with existing exports
    - 9.4: Ensure AutoFixEngine compatibility
