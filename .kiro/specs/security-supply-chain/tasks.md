# Implementation Plan: Security Supply Chain Analysis

## Overview

This implementation plan breaks down the PostInstallDetector feature into discrete coding tasks. The feature adds malicious postinstall script detection to EscapeKit MCP by analyzing package.json files and their dependencies for suspicious patterns (network requests, environment variable access, code execution, obfuscation, file system operations).

The implementation follows a bottom-up approach: build core components first (parser, pattern matcher, risk scorer), then integrate them into the detector, and finally wire everything into CodeAnalyzer. Each task includes property-based tests to validate correctness properties from the design document.

## Tasks

- [x] 1. Set up project structure and core types
  - Create `src/security/` directory for security analysis components
  - Define TypeScript interfaces in `src/security/types.ts` (SecurityAnalysisOptions, ScriptContext, ScriptAnalysisResult, DetectedPattern, PatternType, PackageJson, InstallationScript, PatternDefinition, ScoringWeights, PackageMetadata, IssueContext)
  - Extend IssueType in `src/models/schemas.ts` to include 'postinstall_risk'
  - Extend AnalysisOptions interface in CodeAnalyzer to include enableSecurityAnalysis field
  - _Requirements: 6.1, 7.1, 12.1_


- [ ] 2. Implement PackageJsonParser
  - [x] 2.1 Create PackageJsonParser class in `src/security/PackageJsonParser.ts`
    - Implement parse() method to parse JSON strings into PackageJson objects
    - Implement extractScripts() method to extract installation scripts (postinstall, preinstall, install)
    - Implement extractDependencies() method to extract dependency names from dependencies and devDependencies fields
    - Implement serialize() method to convert PackageJson objects back to JSON strings
    - Handle invalid JSON with descriptive errors
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.1, 4.2, 10.1, 10.2, 10.4, 10.5_

  - [ ]* 2.2 Write property test for PackageJsonParser
    - **Property 1: Installation Script Detection**
    - **Property 12: Package.json Round-Trip**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 10.3, 10.5**
    - Test that extractScripts() detects all installation script types
    - Test that parse → serialize → parse produces equivalent objects
    - Use fast-check with 100 iterations

  - [ ]* 2.3 Write unit tests for PackageJsonParser
    - Test parsing valid package.json with all script types
    - Test parsing package.json with no installation scripts (Requirement 1.4)
    - Test parsing package.json with only dependencies
    - Test parsing package.json with only devDependencies
    - Test parsing package.json with both dependencies and devDependencies
    - Test error handling for invalid JSON (Requirement 10.4)
    - Test field preservation during round-trip
    - _Requirements: 1.4, 10.4_


- [ ] 3. Implement PatternMatcher
  - [x] 3.1 Create PatternMatcher class in `src/security/PatternMatcher.ts`
    - Define SUSPICIOUS_PATTERNS array with regex patterns for network requests, environment access, code execution, obfuscation, and file system operations
    - Define LEGITIMATE_PATTERNS array with regex patterns for build tools (node-gyp, tsc, webpack, husky)
    - Implement detectPatterns() method to find all suspicious patterns in script content
    - Implement isLegitimatePattern() method to check against whitelist
    - Implement getPatternType() method to determine pattern type from match
    - Return DetectedPattern objects with type, pattern, match, and position
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 11.3_

  - [ ]* 3.2 Write property test for PatternMatcher
    - **Property 2: Pattern Detection Completeness**
    - **Property 13: Legitimate Pattern Recognition**
    - **Validates: Requirements 2.1-2.10, 11.3**
    - Test that detectPatterns() finds all instances of each pattern type
    - Test that legitimate patterns are correctly identified
    - Use fast-check with 100 iterations

  - [ ]* 3.3 Write unit tests for PatternMatcher
    - Test detection of curl commands (Requirement 2.1)
    - Test detection of wget commands (Requirement 2.2)
    - Test detection of fetch API calls (Requirement 2.3)
    - Test detection of AWS_* environment variables (Requirement 2.4)
    - Test detection of GITHUB_TOKEN access (Requirement 2.5)
    - Test detection of fs.writeFile and fs.appendFile (Requirement 2.6)
    - Test detection of eval and Function constructor (Requirement 2.7)
    - Test detection of child_process.exec and spawn (Requirement 2.8)
    - Test detection of base64 encoding (Requirement 2.9)
    - Test detection of hex encoding patterns (Requirement 2.10)
    - Test recognition of node-gyp, tsc, webpack patterns (Requirement 11.3)
    - Test real-world malicious examples (Shai-Hulud, postmark-mcp, GlassWorm)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 11.3_


- [ ] 4. Implement RiskScorer
  - [x] 4.1 Create RiskScorer class in `src/security/RiskScorer.ts`
    - Define ScoringWeights constant (network_request: 30, env_access: 40, code_execution: 25, obfuscation: 20, file_system: 15, recent_publish: 10)
    - Implement calculateScore() method to sum weights of unique pattern types and cap at 100
    - Implement getSeverity() method to map scores to severity levels (>70=error, 40-70=warning, <40=info)
    - Implement applyRecencyBonus() method to add 10 points for packages published < 7 days ago
    - Use Set to deduplicate pattern types before scoring
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.3_

  - [ ]* 4.2 Write property test for RiskScorer
    - **Property 3: Risk Score Calculation**
    - **Property 4: Severity Assignment**
    - **Property 7: Recency Detection**
    - **Validates: Requirements 3.2-3.10, 5.3**
    - Test that scores are always between 0 and 100 (capping)
    - Test that severity levels are correctly assigned
    - Test that recency bonus is applied correctly
    - Use fast-check with 100 iterations


  - [ ]* 4.3 Write unit tests for RiskScorer
    - Test score of 0 for zero patterns (Requirement 3.1)
    - Test score increase of 30 for network requests (Requirement 3.2)
    - Test score increase of 40 for environment access (Requirement 3.3)
    - Test score increase of 25 for code execution (Requirement 3.4)
    - Test score increase of 20 for obfuscation (Requirement 3.5)
    - Test score increase of 15 for file system operations (Requirement 3.6)
    - Test score capping at 100 (Requirement 3.7)
    - Test severity "error" for scores > 70 (Requirement 3.8)
    - Test severity "warning" for scores 40-70 (Requirement 3.9)
    - Test severity "info" for scores < 40 (Requirement 3.10)
    - Test recency bonus of 10 points for packages < 7 days old (Requirement 5.3)
    - Test deduplication of pattern types (same type counted once)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.3_


- [ ] 5. Implement IssueGenerator
  - [x] 5.1 Create IssueGenerator class in `src/security/IssueGenerator.ts`
    - Implement createIssue() method to create Issue objects with type 'postinstall_risk'
    - Implement formatMessage() method to include risk score and context (package name or "package.json")
    - Implement generateSuggestions() method to combine remediation suggestions based on detected patterns
    - Implement getSuggestionForPattern() private method with specific text for each pattern type
    - Set autoFixable to false for all security issues
    - Use generateId('issue') for unique IDs
    - Include publish date in description when available
    - Add "This may be a legitimate build script" note when legitimate patterns detected
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 5.4, 11.4_

  - [ ]* 5.2 Write property test for IssueGenerator
    - **Property 8: Issue Structure**
    - **Property 10: Suggestion Generation**
    - **Validates: Requirements 6.1-6.8, 8.6**
    - Test that all issues have required fields (type, severity, location, message, description, suggestion, autoFixable, id)
    - Test that suggestions are combined correctly for multiple patterns
    - Use fast-check with 100 iterations


  - [ ]* 5.3 Write unit tests for IssueGenerator
    - Test issue creation with type 'postinstall_risk' (Requirement 6.1)
    - Test message includes risk score (Requirement 6.2)
    - Test description lists all detected patterns (Requirement 6.3)
    - Test remediation suggestions are included (Requirement 6.4)
    - Test location references "package.json" for direct scripts (Requirement 6.5)
    - Test message includes dependency name for dependency scripts (Requirement 6.6)
    - Test autoFixable is false (Requirement 6.7)
    - Test unique ID generation (Requirement 6.8)
    - Test specific suggestion text for network requests (Requirement 8.1)
    - Test specific suggestion text for environment access (Requirement 8.2)
    - Test specific suggestion text for code execution (Requirement 8.3)
    - Test specific suggestion text for obfuscation (Requirement 8.4)
    - Test specific suggestion text for file system operations (Requirement 8.5)
    - Test suggestion prioritization for multiple patterns (Requirement 8.6)
    - Test publish date inclusion in description (Requirement 5.4)
    - Test legitimate build script note (Requirement 11.4)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 5.4, 11.4_


- [x] 6. Checkpoint - Ensure all component tests pass
  - Run all unit tests and property tests for PackageJsonParser, PatternMatcher, RiskScorer, and IssueGenerator
  - Verify all tests pass before proceeding to integration
  - Ask the user if questions arise


- [ ] 7. Implement PostInstallDetector
  - [x] 7.1 Create PostInstallDetector class in `src/security/PostInstallDetector.ts`
    - Implement constructor with dependencies (NPMRegistry, PackageJsonParser, PatternMatcher, RiskScorer, IssueGenerator)
    - Implement analyze() method as main entry point (reads package.json file, orchestrates analysis)
    - Implement analyzeScript() method to analyze a single script and return ScriptAnalysisResult
    - Implement analyzeDependencies() private method to query NPMRegistry and analyze dependency scripts
    - Add file system integration using fs/promises readFile
    - Handle errors gracefully (log and return empty array for parsing failures)
    - Create "unverified" warning issues for network errors during dependency analysis
    - Use existing AnalysisError class for error reporting
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.3, 4.4, 4.5, 5.1, 5.2, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 7.2 Write property test for PostInstallDetector
    - **Property 5: Dependency Extraction**
    - **Property 6: Dependency Analysis Consistency**
    - **Property 11: Network Error Handling**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 9.2, 9.4**
    - Test that all dependencies are extracted and analyzed
    - Test that dependency scripts use same pattern detection as direct scripts
    - Test that network errors create warning issues and don't block analysis
    - Use fast-check with 100 iterations


  - [ ]* 7.3 Write unit tests for PostInstallDetector
    - Test analyze() with package.json containing postinstall script
    - Test analyze() with package.json containing preinstall script
    - Test analyze() with package.json containing install script
    - Test analyze() with package.json containing no installation scripts (Requirement 1.4)
    - Test analyze() with package.json containing dependencies
    - Test analyze() with package.json containing devDependencies
    - Test dependency analysis with checkNPMRegistry enabled (Requirement 4.3)
    - Test dependency script analysis creates issues with dependency name (Requirement 4.5)
    - Test publish date extraction from Package_Metadata (Requirement 5.1)
    - Test recently published flag for packages < 7 days old (Requirement 5.2)
    - Test error handling for invalid package.json (Requirement 9.1)
    - Test error handling for NPMRegistry failures (Requirement 9.2)
    - Test error handling for script extraction failures (Requirement 9.3)
    - Test "unverified" warning for network errors (Requirement 9.4)
    - Test AnalysisError usage (Requirement 9.5)
    - _Requirements: 1.4, 4.3, 4.5, 5.1, 5.2, 9.1, 9.2, 9.3, 9.4, 9.5_


- [ ] 8. Integrate PostInstallDetector with CodeAnalyzer
  - [x] 8.1 Modify CodeAnalyzer in `src/analyzers/CodeAnalyzer.ts`
    - Add PostInstallDetector as a private field
    - Instantiate PostInstallDetector in constructor with required dependencies
    - Add enableSecurityAnalysis field to AnalysisOptions interface
    - Add security analysis invocation in analyze() method (wrapped in try-catch)
    - Only invoke PostInstallDetector when enableSecurityAnalysis is true
    - Pass checkNPMRegistry option to PostInstallDetector
    - Merge security issues into allIssues array
    - Log errors if security analysis fails but continue with other analysis
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 12.1, 12.2, 12.3_

  - [x] 8.2 Update calculateSummary() in CodeAnalyzer
    - Add securityRisks counter to AnalysisSummary
    - Increment securityRisks for each issue with type 'postinstall_risk'
    - _Requirements: 7.3_

  - [ ]* 8.3 Write property test for CodeAnalyzer integration
    - **Property 9: CodeAnalyzer Integration**
    - **Property 14: Opt-In Behavior**
    - **Validates: Requirements 7.2, 7.3, 7.5, 12.2, 12.3**
    - Test that enableSecurityAnalysis=true invokes PostInstallDetector
    - Test that enableSecurityAnalysis=false skips PostInstallDetector
    - Test that security issues are included in AnalysisResult
    - Test that securityRisks counter is incremented correctly
    - Use fast-check with 100 iterations


  - [ ]* 8.4 Write integration tests for CodeAnalyzer
    - Test CodeAnalyzer invokes PostInstallDetector when enableSecurityAnalysis is true (Requirement 7.1)
    - Test security issues are included in AnalysisResult.issues (Requirement 7.2)
    - Test securityRisks counter increments for postinstall_risk issues (Requirement 7.3)
    - Test CodeAnalyzer continues analysis when PostInstallDetector fails (Requirement 7.4)
    - Test checkNPMRegistry option is passed to PostInstallDetector (Requirement 7.5)
    - Test enableSecurityAnalysis defaults to false (Requirement 12.4)
    - Test enableSecurityAnalysis=false skips PostInstallDetector (Requirement 12.2)
    - Test enableSecurityAnalysis=true invokes PostInstallDetector (Requirement 12.3)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 12.2, 12.3, 12.4_


- [ ] 9. Update MCP tool handlers
  - [x] 9.1 Modify analyze tool handler in `src/tools/analyze.ts`
    - Add enableSecurityAnalysis parameter to analyzeCode function
    - Pass enableSecurityAnalysis to CodeAnalyzer.analyze() options
    - Default enableSecurityAnalysis to false
    - Update tool schema to expose the new parameter
    - _Requirements: 12.5_

  - [ ]* 9.2 Write unit tests for analyze tool handler
    - Test that enableSecurityAnalysis parameter is passed to CodeAnalyzer
    - Test that enableSecurityAnalysis defaults to false when not provided
    - Test that tool schema includes enableSecurityAnalysis parameter
    - _Requirements: 12.5_


- [x] 10. Checkpoint - Ensure all integration tests pass
  - Run all integration tests for CodeAnalyzer and tool handlers
  - Verify security analysis works end-to-end
  - Test with real package.json files
  - Ask the user if questions arise


- [x] 11. Validate against popular packages (zero false positives)
  - [x] 11.1 Create validation test suite in `tests/security/PopularPackages.test.ts`
    - Test axios package produces zero false positives (Requirement 11.1)
    - Test react package produces zero false positives (Requirement 11.1)
    - Test lodash package produces zero false positives (Requirement 11.1)
    - Test express package produces zero false positives (Requirement 11.1)
    - Test TypeScript compilation scripts score below 40 (Requirement 11.2)
    - Test node-gyp rebuild scripts score below 40 (Requirement 11.2)
    - Test webpack build scripts score below 40 (Requirement 11.2)
    - Fetch real package.json files from npm registry for testing
    - _Requirements: 11.1, 11.2_

  - [ ]* 11.2 Write unit tests for legitimate pattern handling
    - Test that node-gyp patterns reduce risk score (Requirement 11.3)
    - Test that tsc patterns reduce risk score (Requirement 11.3)
    - Test that webpack patterns reduce risk score (Requirement 11.3)
    - Test that legitimate build script note is added (Requirement 11.4)
    - _Requirements: 11.3, 11.4_


- [x] 12. Validate against known malicious patterns
  - [x] 12.1 Create malicious pattern test suite in `tests/security/MaliciousPatterns.test.ts`
    - Test Shai-Hulud attack pattern detection (curl piped to bash)
    - Test postmark-mcp attack pattern detection (eval with base64 environment variables)
    - Test GlassWorm attack pattern detection (child_process.exec with AWS credentials)
    - Test that malicious patterns score above 70 (severity "error")
    - Test that all expected patterns are detected in each attack
    - Test that appropriate remediation suggestions are generated
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 3.8_

  - [ ]* 12.2 Write unit tests for malicious pattern combinations
    - Test multiple pattern types in single script
    - Test pattern deduplication (same type multiple times)
    - Test score capping at 100 for extreme cases
    - Test severity assignment for various score ranges
    - _Requirements: 3.7, 3.8, 3.9, 3.10_


- [x] 13. Performance validation
  - [x] 13.1 Create performance test suite in `tests/security/Performance.test.ts`
    - Test dependency analysis completes within 5 seconds for 50 dependencies (Requirement 4.6)
    - Test parallel NPMRegistry queries using Promise.all
    - Test that NPMRegistry caching reduces query time
    - Measure and log analysis time for various project sizes
    - _Requirements: 4.6_

  - [ ]* 13.2 Optimize performance if needed
    - Profile slow operations
    - Optimize regex patterns if needed
    - Ensure parallel dependency queries
    - Verify NPMRegistry caching is working
    - _Requirements: 4.6_


- [x] 14. Final checkpoint - Comprehensive validation
  - Run all tests (unit, property-based, integration, validation, performance)
  - Verify all 12 requirements are satisfied
  - Verify all 14 correctness properties are validated
  - Test end-to-end workflow with real projects
  - Ensure all tests pass, ask the user if questions arise


## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties from the design document
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate end-to-end workflows
- Validation tests ensure zero false positives on popular packages
- Performance tests ensure dependency analysis completes within 5 seconds
- All property tests use fast-check with minimum 100 iterations
- Implementation uses TypeScript throughout
- Feature is opt-in via enableSecurityAnalysis flag (defaults to false)
- Graceful error handling ensures security analysis failures don't block other analysis

## Success Criteria

The implementation will be complete when:
- All 5 core components are implemented (PackageJsonParser, PatternMatcher, RiskScorer, IssueGenerator, PostInstallDetector)
- PostInstallDetector is integrated with CodeAnalyzer
- MCP tool handlers expose enableSecurityAnalysis option
- All 14 correctness properties are validated with property-based tests
- Zero false positives on top packages (axios, react, lodash, express)
- Known malicious patterns (Shai-Hulud, postmark-mcp, GlassWorm) are detected
- Dependency analysis completes within 5 seconds for 50 dependencies
- All tests pass (unit, property-based, integration, validation, performance)
