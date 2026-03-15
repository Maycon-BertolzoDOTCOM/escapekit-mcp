# Requirements Document: Phase 3 Transformation Engine

## Introduction

The Phase 3 Transformation Engine is the code transformation and project generation component of EscapeKit MCP, implementing a 5-layer procedural architecture (Camada 1-5) aligned with Chinese technological sovereignty principles (自主创新 - Zizhu Chuangxin). This engine converts analyzed sandbox code into deployable, production-ready projects by resolving ghost imports, transforming AST nodes, generating project scaffolding, and validating outputs.

The transformation engine integrates with Phase 2 components (CodeAnalyzer, NPMRegistry, detectors) and implements tasks 3.1-3.7 from the EscapeKit MCP roadmap. It follows a strict layered approach where each layer (Fundação, Resolução, Transformação, Geração, Validação) builds upon the previous, ensuring independence, security, and innovation.

## Glossary

- **Transformation_Engine**: The complete Phase 3 system implementing 5 procedural layers for code transformation
- **Ghost_Import**: An import statement referencing a non-existent npm package (detected by Phase 2 Analysis Engine)
- **Real_Package**: A verified npm package that exists in the public registry
- **Package_Mapping**: A rule that maps a Ghost_Import to one or more Real_Package alternatives
- **AST**: Abstract Syntax Tree representation of source code
- **Escape_Contract**: A YAML document recording all transformations applied to sandbox code
- **Project_Scaffold**: The generated directory structure and configuration files for a deployable project
- **Camada**: Portuguese for "layer" - refers to the 5 procedural layers (Fundação, Resolução, Transformação, Geração, Validação)
- **Analysis_Result**: The output from Phase 2 CodeAnalyzer containing detected issues and confidence scores
- **Dependency_Resolution**: The process of mapping Ghost_Imports to Real_Packages using semantic analysis
- **Code_Transformation**: The process of modifying AST nodes to replace Ghost_Imports with Real_Packages
- **Template_Engine**: The system for generating configuration files from templates
- **Validation_Pipeline**: The automated testing system for generated projects
- **NPMRegistry_Service**: The Phase 2 service for querying npm package information
- **Babel_Transformer**: The AST manipulation library for JavaScript/TypeScript code transformation
- **Project_Generator**: The Camada 4 component responsible for creating project scaffolding
- **Dependency_Resolver**: The Camada 2 component responsible for mapping Ghost_Imports to Real_Packages
- **Import_Replacer**: The Camada 3 component responsible for AST-based import replacement
- **Confidence_Score**: A numeric value (0-1) indicating the reliability of the analysis and transformation

## Requirements

### Requirement 1: Transformation Data Foundation

**User Story:** As a developer, I want well-defined data structures for all transformation operations, so that the system has a solid foundation for processing code transformations.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL define a PackageMapping interface with fields for ghostPackage, realPackages, confidence, and mappingStrategy
2. THE Transformation_Engine SHALL define a TransformationRule interface with fields for ruleId, ruleType, sourcePattern, targetPattern, and metadata
3. THE Transformation_Engine SHALL define a DependencyResolution interface with fields for originalImport, resolvedPackage, version, resolutionMethod, and confidence
4. THE Transformation_Engine SHALL define a CodeTransformation interface with fields for transformationId, sourceCode, transformedCode, appliedRules, and timestamp
5. THE Transformation_Engine SHALL define a ProjectStructure interface with fields for rootPath, directories, files, dependencies, and configuration
6. THE Transformation_Engine SHALL define an EscapeContract interface with fields for contractId, analysisId, origin, transformations, assumptions, validationStatus, and metadata
7. THE Transformation_Engine SHALL define supporting enums for MappingStrategy (EXACT_MATCH, SEMANTIC_MATCH, MANUAL_OVERRIDE, FALLBACK)
8. THE Transformation_Engine SHALL define supporting enums for ResolutionMethod (KNOWLEDGE_BASE, NPM_SEARCH, SEMANTIC_ANALYSIS, USER_PROVIDED)
9. THE Transformation_Engine SHALL define supporting enums for TransformationType (IMPORT_REPLACEMENT, POLYFILL_INJECTION, API_MIGRATION, CONFIGURATION_GENERATION)
10. THE Transformation_Engine SHALL store all data structures in src/models/transformation.ts

### Requirement 2: Dependency Resolution Knowledge Base

**User Story:** As a developer, I want a knowledge base that maps ghost imports to real packages, so that the system can automatically resolve non-existent dependencies.

#### Acceptance Criteria

1. THE Dependency_Resolver SHALL maintain a knowledge base mapping common Ghost_Imports to Real_Packages
2. WHEN a Ghost_Import is provided, THE Dependency_Resolver SHALL search the knowledge base for exact matches
3. WHEN no exact match exists, THE Dependency_Resolver SHALL perform semantic analysis to find similar Real_Packages
4. THE Dependency_Resolver SHALL integrate with NPMRegistry_Service to validate Real_Package existence
5. THE Dependency_Resolver SHALL return DependencyResolution results with confidence scores between 0.0 and 1.0
6. THE Dependency_Resolver SHALL cache resolution results to improve performance
7. WHEN multiple Real_Package alternatives exist, THE Dependency_Resolver SHALL rank them by confidence score
8. THE Dependency_Resolver SHALL support manual override mappings provided by users
9. THE Dependency_Resolver SHALL log all resolution attempts with timestamps and outcomes
10. WHEN a Ghost_Import cannot be resolved, THE Dependency_Resolver SHALL return a DependencyResolution with confidence 0.0 and suggest manual intervention

### Requirement 3: NPM Registry Integration for Package Validation

**User Story:** As a developer, I want the dependency resolver to validate packages against npm registry, so that only real, installable packages are used in transformations.

#### Acceptance Criteria

1. THE Dependency_Resolver SHALL use NPMRegistry_Service.packageExists() to verify Real_Package existence
2. THE Dependency_Resolver SHALL use NPMRegistry_Service.getLatestVersion() to retrieve current package versions
3. WHEN NPMRegistry_Service returns a network error, THE Dependency_Resolver SHALL retry up to 3 times with exponential backoff
4. WHEN NPMRegistry_Service validation fails after retries, THE Dependency_Resolver SHALL mark the resolution as UNVERIFIED
5. THE Dependency_Resolver SHALL respect NPMRegistry_Service cache to minimize network requests
6. THE Dependency_Resolver SHALL handle rate limiting from npm registry by implementing request throttling
7. THE Dependency_Resolver SHALL validate package versions are compatible with target runtime (Node.js version, browser compatibility)
8. WHEN a Real_Package is deprecated, THE Dependency_Resolver SHALL log a warning and suggest alternatives
9. THE Dependency_Resolver SHALL support offline mode using cached NPMRegistry_Service data
10. THE Dependency_Resolver SHALL track NPMRegistry_Service query statistics (hits, misses, errors)

### Requirement 4: Semantic Package Name Matching

**User Story:** As a developer, I want semantic analysis for package name matching, so that the system can find appropriate alternatives even when exact matches don't exist.

#### Acceptance Criteria

1. THE Dependency_Resolver SHALL implement fuzzy string matching for package names with minimum similarity threshold 0.7
2. THE Dependency_Resolver SHALL analyze package descriptions and keywords from npm registry metadata
3. THE Dependency_Resolver SHALL use Levenshtein distance algorithm for string similarity calculation
4. WHEN multiple packages match semantically, THE Dependency_Resolver SHALL rank by combined score of name similarity, download count, and maintenance status
5. THE Dependency_Resolver SHALL prefer packages with higher npm weekly downloads (weight 0.3)
6. THE Dependency_Resolver SHALL prefer packages with recent updates within 12 months (weight 0.2)
7. THE Dependency_Resolver SHALL prefer packages with similar functionality based on keyword overlap (weight 0.5)
8. THE Dependency_Resolver SHALL exclude packages marked as deprecated or security-vulnerable
9. THE Dependency_Resolver SHALL limit semantic search results to top 5 candidates
10. THE Dependency_Resolver SHALL log semantic matching decisions with justification for auditability

### Requirement 5: AST-Based Import Replacement

**User Story:** As a developer, I want AST-based transformation of import statements, so that ghost imports are replaced with real packages while preserving code structure and formatting.

#### Acceptance Criteria

1. THE Import_Replacer SHALL use Babel_Transformer to parse JavaScript/TypeScript code into AST
2. WHEN an import statement matches a Ghost_Import, THE Import_Replacer SHALL replace the package name with the resolved Real_Package
3. THE Import_Replacer SHALL preserve import syntax (ES6 import, CommonJS require, dynamic import)
4. THE Import_Replacer SHALL preserve named imports, default imports, and namespace imports
5. THE Import_Replacer SHALL preserve code comments associated with import statements
6. THE Import_Replacer SHALL maintain original code formatting (indentation, line breaks, spacing)
7. THE Import_Replacer SHALL generate transformed code as a string output
8. WHEN import replacement fails, THE Import_Replacer SHALL throw a TransformationError with detailed context
9. THE Import_Replacer SHALL support TypeScript-specific import syntax (type imports, import type)
10. THE Import_Replacer SHALL validate transformed code syntax before returning results

### Requirement 6: Code Formatting Preservation

**User Story:** As a developer, I want transformed code to maintain original formatting, so that the output is readable and matches the original code style.

#### Acceptance Criteria

1. THE Import_Replacer SHALL use Babel_Transformer with recast option to preserve formatting
2. THE Import_Replacer SHALL maintain original indentation style (spaces vs tabs, indent size)
3. THE Import_Replacer SHALL preserve blank lines between import groups
4. THE Import_Replacer SHALL preserve trailing commas in import lists
5. THE Import_Replacer SHALL preserve quote style (single vs double quotes)
6. THE Import_Replacer SHALL preserve semicolon usage (present vs absent)
7. WHEN formatting cannot be preserved exactly, THE Import_Replacer SHALL apply consistent formatting rules
8. THE Import_Replacer SHALL preserve JSDoc comments and inline comments
9. THE Import_Replacer SHALL maintain line length within 100 characters where possible
10. THE Import_Replacer SHALL generate a diff report showing changes between original and transformed code

### Requirement 7: Project Directory Structure Generation

**User Story:** As a developer, I want automated project scaffolding, so that generated projects follow best practices and are ready for development.

#### Acceptance Criteria

1. THE Project_Generator SHALL create a root directory with the project name
2. THE Project_Generator SHALL create a src/ directory for source code files
3. THE Project_Generator SHALL create a public/ directory for static assets
4. THE Project_Generator SHALL create a tests/ directory for test files
5. THE Project_Generator SHALL create a config/ directory for configuration files
6. THE Project_Generator SHALL create a .gitignore file with Node.js defaults
7. THE Project_Generator SHALL create a README.md file with project description and setup instructions
8. THE Project_Generator SHALL create a LICENSE file with MIT license by default
9. WHEN directory creation fails, THE Project_Generator SHALL throw a FileSystemError with detailed context
10. THE Project_Generator SHALL support custom directory structures via configuration templates

### Requirement 8: Package.json Generation

**User Story:** As a developer, I want automated package.json generation, so that all resolved dependencies are properly declared with correct versions.

#### Acceptance Criteria

1. THE Project_Generator SHALL generate a package.json file with name, version, description, and author fields
2. THE Project_Generator SHALL populate dependencies section with all resolved Real_Packages and their versions
3. THE Project_Generator SHALL populate devDependencies section with TypeScript, ESLint, and testing tools
4. THE Project_Generator SHALL include scripts for build, dev, test, and lint commands
5. THE Project_Generator SHALL set type field to "module" for ES6 module support
6. THE Project_Generator SHALL include engines field specifying minimum Node.js version
7. THE Project_Generator SHALL use semantic versioning with caret (^) for dependency versions
8. WHEN a Real_Package has peer dependencies, THE Project_Generator SHALL include them in dependencies
9. THE Project_Generator SHALL validate package.json syntax before writing to disk
10. THE Project_Generator SHALL support custom package.json templates via configuration

### Requirement 9: TypeScript Configuration Generation

**User Story:** As a developer, I want automated tsconfig.json generation, so that TypeScript projects are properly configured for the target runtime.

#### Acceptance Criteria

1. THE Project_Generator SHALL generate a tsconfig.json file with strict mode enabled
2. THE Project_Generator SHALL set target to ES2020 or higher based on target runtime
3. THE Project_Generator SHALL set module to ESNext for modern JavaScript
4. THE Project_Generator SHALL set moduleResolution to bundler for compatibility
5. THE Project_Generator SHALL include src/ in include paths
6. THE Project_Generator SHALL exclude node_modules/ and dist/ directories
7. THE Project_Generator SHALL enable esModuleInterop and allowSyntheticDefaultImports
8. THE Project_Generator SHALL set outDir to dist/ for compiled output
9. THE Project_Generator SHALL enable sourceMap for debugging support
10. THE Project_Generator SHALL support custom tsconfig.json templates via configuration

### Requirement 10: Escape Contract YAML Generation

**User Story:** As a developer, I want an escape contract document, so that all transformations are recorded for auditability and reproducibility.

#### Acceptance Criteria

1. THE Project_Generator SHALL generate an escape-contract.yaml file in the project root
2. THE Escape_Contract SHALL include contractId, analysisId, and timestamp fields
3. THE Escape_Contract SHALL include origin section with sandboxType, originalCode hash, and detectedIssues count
4. THE Escape_Contract SHALL include transformations section listing all applied TransformationRules
5. FOR EACH Ghost_Import resolution, THE Escape_Contract SHALL record originalImport, resolvedPackage, version, and confidence
6. THE Escape_Contract SHALL include assumptions section documenting any manual interventions or unresolved issues
7. THE Escape_Contract SHALL include validationStatus field (PENDING, PASSED, FAILED)
8. THE Escape_Contract SHALL include metadata section with generatedBy, toolVersion, and targetPlatform
9. THE Escape_Contract SHALL use YAML format for human readability
10. THE Escape_Contract SHALL validate against a JSON schema before writing to disk

### Requirement 11: Parser and Pretty Printer for Escape Contracts

**User Story:** As a developer, I want to parse and print escape contracts, so that I can validate contract integrity and support round-trip transformations.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL implement a parseEscapeContract() function that parses YAML into EscapeContract objects
2. WHEN an invalid escape contract is provided, THE parseEscapeContract() function SHALL return a descriptive ParseError
3. THE Transformation_Engine SHALL implement a printEscapeContract() function that formats EscapeContract objects into valid YAML
4. THE printEscapeContract() function SHALL preserve field order (contractId, analysisId, origin, transformations, assumptions, validationStatus, metadata)
5. THE printEscapeContract() function SHALL format arrays and nested objects with proper indentation
6. FOR ALL valid EscapeContract objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
7. THE parseEscapeContract() function SHALL validate required fields are present
8. THE parseEscapeContract() function SHALL validate field types match the EscapeContract interface
9. THE printEscapeContract() function SHALL escape special YAML characters in string values
10. THE Transformation_Engine SHALL include unit tests verifying round-trip property for 100 randomly generated EscapeContract objects

### Requirement 12: Template-Based File Generation

**User Story:** As a developer, I want template-based file generation, so that configuration files can be customized for different target platforms.

#### Acceptance Criteria

1. THE Project_Generator SHALL support Handlebars template syntax for file generation
2. THE Project_Generator SHALL provide template variables for projectName, dependencies, targetPlatform, and nodeVersion
3. THE Project_Generator SHALL load templates from a templates/ directory
4. THE Project_Generator SHALL support templates for package.json, tsconfig.json, README.md, and Dockerfile
5. WHEN a template file is missing, THE Project_Generator SHALL use built-in default templates
6. THE Project_Generator SHALL validate template syntax before rendering
7. THE Project_Generator SHALL support conditional blocks in templates ({{#if}}, {{#unless}})
8. THE Project_Generator SHALL support iteration blocks in templates ({{#each}})
9. THE Project_Generator SHALL support custom Handlebars helpers for formatting (camelCase, kebabCase, upperCase)
10. THE Project_Generator SHALL cache compiled templates for performance

### Requirement 13: Integration with Phase 2 Analysis Results

**User Story:** As a developer, I want seamless integration with Phase 2 analysis results, so that transformation decisions are based on detected issues and confidence scores.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL accept Analysis_Result as input to transformation functions
2. THE Transformation_Engine SHALL extract Ghost_Imports from Analysis_Result.issues where type is 'ghost_import'
3. THE Transformation_Engine SHALL use Analysis_Result.confidenceScore to determine transformation strategy
4. WHEN Analysis_Result.confidenceScore is below 0.5, THE Transformation_Engine SHALL require manual review before transformation
5. THE Transformation_Engine SHALL preserve Analysis_Result.analysisId in generated Escape_Contract
6. THE Transformation_Engine SHALL use Analysis_Result.sandboxType to select appropriate transformation rules
7. THE Transformation_Engine SHALL log warnings for issues marked as 'security_risk' in Analysis_Result
8. THE Transformation_Engine SHALL skip transformation for issues marked as autoFixable false unless forced by user
9. THE Transformation_Engine SHALL generate transformation summary comparing Analysis_Result.summary before and after
10. THE Transformation_Engine SHALL validate that all ghost_import issues are addressed in transformation output

### Requirement 14: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that transformation failures are debuggable and recoverable.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL use existing EscapeKitError classes (TransformationError, ValidationError, FileSystemError)
2. WHEN a transformation operation fails, THE Transformation_Engine SHALL throw a TransformationError with operation name and context
3. THE Transformation_Engine SHALL log all transformation steps at DEBUG level using the existing logger
4. THE Transformation_Engine SHALL log transformation start and completion at INFO level
5. THE Transformation_Engine SHALL log warnings for low-confidence resolutions (confidence < 0.7) at WARN level
6. THE Transformation_Engine SHALL log errors with full stack traces at ERROR level
7. THE Transformation_Engine SHALL include transformation context in error messages (file path, line number, package name)
8. THE Transformation_Engine SHALL support dry-run mode that logs transformations without applying them
9. THE Transformation_Engine SHALL create a transformation log file in the output directory
10. THE Transformation_Engine SHALL implement graceful degradation for non-critical errors (continue transformation with warnings)

### Requirement 15: Backward Compatibility with Existing APIs

**User Story:** As a developer, I want 100% backward compatibility with existing APIs, so that Phase 2 components continue to work without modification.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL NOT modify existing interfaces in src/models/schemas.ts
2. THE Transformation_Engine SHALL NOT modify existing error classes in src/errors.ts
3. THE Transformation_Engine SHALL NOT modify existing NPMRegistry_Service interface
4. THE Transformation_Engine SHALL NOT modify existing CodeAnalyzer interface
5. THE Transformation_Engine SHALL use existing logger instance from src/logger.ts
6. THE Transformation_Engine SHALL use existing configuration system from src/config.ts
7. THE Transformation_Engine SHALL maintain all 183 existing tests in passing state
8. WHEN new functionality requires interface changes, THE Transformation_Engine SHALL extend interfaces rather than modify them
9. THE Transformation_Engine SHALL use existing generateId() function for creating unique identifiers
10. THE Transformation_Engine SHALL follow existing code style and formatting conventions

### Requirement 16: MCP Tool Implementation for Code Generation

**User Story:** As a Claude Desktop user, I want an MCP tool to generate escape kits, so that I can transform analyzed code through the MCP interface.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL implement a generate_escape_kit MCP tool in src/tools/generate.ts
2. THE generate_escape_kit tool SHALL accept parameters: analysisId, targetPlatform, outputDir, and options
3. THE generate_escape_kit tool SHALL validate analysisId exists and corresponds to a valid Analysis_Result
4. THE generate_escape_kit tool SHALL call Dependency_Resolver to resolve all Ghost_Imports
5. THE generate_escape_kit tool SHALL call Import_Replacer to transform source code
6. THE generate_escape_kit tool SHALL call Project_Generator to create project scaffolding
7. THE generate_escape_kit tool SHALL return an MCPResponse with EscapeKit data on success
8. WHEN generation fails, THE generate_escape_kit tool SHALL return an MCPResponse with error details
9. THE generate_escape_kit tool SHALL support options for includeDocker, includeCI, and templatePath
10. THE generate_escape_kit tool SHALL log generation progress and completion time

### Requirement 17: CLI Command Implementation for Code Generation

**User Story:** As a command-line user, I want a CLI command to generate escape kits, so that I can transform analyzed code from the terminal.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL implement an escapekit generate CLI command in cli/index.ts
2. THE escapekit generate command SHALL accept --analysis-id parameter for loading Analysis_Result
3. THE escapekit generate command SHALL accept --output parameter for specifying output directory
4. THE escapekit generate command SHALL accept --platform parameter for target platform (vercel, netlify, docker, local)
5. THE escapekit generate command SHALL accept --include-docker flag for generating Dockerfile
6. THE escapekit generate command SHALL accept --include-ci flag for generating GitHub Actions workflow
7. THE escapekit generate command SHALL display generation progress with a progress bar
8. THE escapekit generate command SHALL display summary of generated files and next steps
9. WHEN generation fails, THE escapekit generate command SHALL display error message and exit with code 1
10. THE escapekit generate command SHALL support --dry-run flag for previewing transformations without applying them

### Requirement 18: Property-Based Testing for Transformation Layers

**User Story:** As a developer, I want property-based tests for each transformation layer, so that the system is robust against edge cases and unexpected inputs.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL include property-based tests for Dependency_Resolver using fast-check library
2. THE Dependency_Resolver tests SHALL verify that resolution confidence is always between 0.0 and 1.0
3. THE Dependency_Resolver tests SHALL verify that resolved packages always exist in npm registry (when online)
4. THE Import_Replacer tests SHALL verify that transformed code is syntactically valid JavaScript/TypeScript
5. THE Import_Replacer tests SHALL verify that import count remains constant after transformation
6. THE Project_Generator tests SHALL verify that generated package.json is valid JSON
7. THE Project_Generator tests SHALL verify that all generated files are writable and readable
8. THE Escape_Contract tests SHALL verify round-trip property (parse → print → parse produces equivalent object)
9. THE Transformation_Engine tests SHALL verify that transformation is idempotent (applying twice produces same result as once)
10. THE Transformation_Engine tests SHALL generate 1000 random inputs per property test

### Requirement 19: Integration Testing for Complete Pipeline

**User Story:** As a developer, I want integration tests for the complete transformation pipeline, so that all layers work together correctly.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL include integration tests that execute the complete pipeline (Analysis → Resolution → Transformation → Generation)
2. THE integration tests SHALL use real Analysis_Result data from Phase 2 tests
3. THE integration tests SHALL verify that generated projects have valid package.json, tsconfig.json, and escape-contract.yaml
4. THE integration tests SHALL verify that generated projects can be installed (npm install succeeds)
5. THE integration tests SHALL verify that generated projects can be built (npm run build succeeds)
6. THE integration tests SHALL verify that generated projects pass linting (npm run lint succeeds)
7. THE integration tests SHALL verify that all Ghost_Imports are resolved in generated code
8. THE integration tests SHALL verify that Escape_Contract accurately reflects applied transformations
9. THE integration tests SHALL clean up generated test projects after execution
10. THE integration tests SHALL run in under 60 seconds for the complete suite

### Requirement 20: Performance Benchmarks and Optimization

**User Story:** As a developer, I want performance benchmarks for transformation operations, so that the system meets performance requirements and bottlenecks are identified.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL complete dependency resolution for 100 Ghost_Imports in under 10 seconds (with warm cache)
2. THE Transformation_Engine SHALL complete AST transformation for 1000 lines of code in under 2 seconds
3. THE Transformation_Engine SHALL complete project generation with 50 files in under 5 seconds
4. THE Transformation_Engine SHALL use less than 500MB memory for transforming projects up to 10,000 lines
5. THE Transformation_Engine SHALL implement caching for Dependency_Resolver results with 90% hit rate after warmup
6. THE Transformation_Engine SHALL implement parallel processing for independent transformation operations
7. THE Transformation_Engine SHALL include performance benchmarks in test suite measuring throughput and latency
8. THE Transformation_Engine SHALL log performance metrics (execution time, memory usage) for each layer
9. WHEN performance degrades by more than 20%, THE Transformation_Engine SHALL log a warning
10. THE Transformation_Engine SHALL support streaming transformation for large files (>10,000 lines)

### Requirement 21: Documentation and API Reference

**User Story:** As a developer, I want comprehensive documentation for all transformation APIs, so that I can understand and extend the system.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL include JSDoc comments for all public classes, interfaces, and functions
2. THE Transformation_Engine SHALL include usage examples in JSDoc comments
3. THE Transformation_Engine SHALL document all parameters with types and descriptions
4. THE Transformation_Engine SHALL document all return values with types and descriptions
5. THE Transformation_Engine SHALL document all thrown errors with conditions
6. THE Transformation_Engine SHALL include a README.md in .kiro/specs/phase3-transformation-engine/ with architecture overview
7. THE Transformation_Engine SHALL include sequence diagrams showing data flow through the 5 layers
8. THE Transformation_Engine SHALL include examples of PackageMapping, TransformationRule, and EscapeContract
9. THE Transformation_Engine SHALL document integration points with Phase 2 components
10. THE Transformation_Engine SHALL include a migration guide for extending the knowledge base

### Requirement 22: Test Coverage Requirements

**User Story:** As a developer, I want >70% test coverage for all new code, so that the transformation engine is reliable and maintainable.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL achieve >70% line coverage for all files in src/models/transformation.ts
2. THE Transformation_Engine SHALL achieve >70% line coverage for all files in src/resolvers/
3. THE Transformation_Engine SHALL achieve >70% line coverage for all files in src/transformers/
4. THE Transformation_Engine SHALL achieve >70% line coverage for all files in src/generators/
5. THE Transformation_Engine SHALL achieve >70% branch coverage for all conditional logic
6. THE Transformation_Engine SHALL include unit tests for all public methods
7. THE Transformation_Engine SHALL include unit tests for all error handling paths
8. THE Transformation_Engine SHALL include integration tests for cross-layer interactions
9. THE Transformation_Engine SHALL run coverage reports in CI/CD pipeline
10. WHEN coverage drops below 70%, THE CI/CD pipeline SHALL fail the build

### Requirement 23: Chinese Technological Sovereignty Alignment

**User Story:** As a Chinese developer, I want the transformation engine to align with 自主创新 (Zizhu Chuangxin) principles, so that the system supports technological independence and security.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL prioritize Chinese npm mirrors (npmmirror.com, npm.taobao.org) when available
2. THE Transformation_Engine SHALL support offline operation using cached package data
3. THE Transformation_Engine SHALL implement supply chain security checks for resolved packages
4. THE Transformation_Engine SHALL detect and warn about packages with known security vulnerabilities
5. THE Transformation_Engine SHALL support custom package registries for enterprise deployments
6. THE Transformation_Engine SHALL log all external network requests for audit purposes
7. THE Transformation_Engine SHALL support air-gapped environments with pre-populated package cache
8. THE Transformation_Engine SHALL include Chinese language error messages and documentation (optional)
9. THE Transformation_Engine SHALL implement rate limiting to respect npm registry fair use policies
10. THE Transformation_Engine SHALL support reproducible builds with locked dependency versions

### Requirement 24: Layered Architecture Enforcement

**User Story:** As a developer, I want strict enforcement of the 5-layer architecture, so that the system maintains separation of concerns and testability.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL implement Camada 1 (Fundação) in src/models/transformation.ts with zero dependencies on other layers
2. THE Transformation_Engine SHALL implement Camada 2 (Resolução) in src/resolvers/ depending only on Camada 1 and external services
3. THE Transformation_Engine SHALL implement Camada 3 (Transformação) in src/transformers/ depending only on Camada 1 and Camada 2
4. THE Transformation_Engine SHALL implement Camada 4 (Geração) in src/generators/ depending only on Camada 1, 2, and 3
5. THE Transformation_Engine SHALL implement Camada 5 (Validação) in tests/ depending on all previous layers
6. THE Transformation_Engine SHALL NOT allow circular dependencies between layers
7. THE Transformation_Engine SHALL NOT allow Camada 1 to import from any other layer
8. THE Transformation_Engine SHALL NOT allow Camada 2 to import from Camada 3 or 4
9. THE Transformation_Engine SHALL enforce layer boundaries using ESLint import rules
10. THE Transformation_Engine SHALL document layer responsibilities in architecture documentation

### Requirement 25: Validation of Generated Projects

**User Story:** As a developer, I want automated validation of generated projects, so that I can verify they are buildable and deployable before manual testing.

#### Acceptance Criteria

1. THE Transformation_Engine SHALL implement a validateProject() function that checks generated project integrity
2. THE validateProject() function SHALL verify all required files exist (package.json, tsconfig.json, src/index.ts, escape-contract.yaml)
3. THE validateProject() function SHALL verify package.json has valid JSON syntax
4. THE validateProject() function SHALL verify tsconfig.json has valid JSON syntax
5. THE validateProject() function SHALL verify escape-contract.yaml has valid YAML syntax
6. THE validateProject() function SHALL verify all dependencies in package.json exist in npm registry
7. THE validateProject() function SHALL verify no Ghost_Imports remain in transformed source code
8. THE validateProject() function SHALL verify generated code has no syntax errors
9. THE validateProject() function SHALL return a ValidationResult with pass/fail status and detailed issues
10. WHEN validation fails, THE validateProject() function SHALL provide actionable error messages with file paths and line numbers
