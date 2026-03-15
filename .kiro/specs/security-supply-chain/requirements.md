# Requirements Document: Security Supply Chain Analysis

## Introduction

This document specifies requirements for implementing supply chain security analysis in EscapeKit MCP, with primary focus on detecting malicious postinstall scripts. The npm ecosystem has experienced major supply chain attacks in 2025 (Shai-Hulud, postmark-mcp, GlassWorm), making this capability critical for protecting developers.

The PostInstallDetector will analyze package.json files and their dependencies to identify potentially malicious installation scripts, suspicious code patterns, and risky package characteristics. This feature integrates with EscapeKit's existing code analysis infrastructure (CodeAnalyzer, NPMRegistry, Tree-sitter parsing) to provide comprehensive security warnings.

## Glossary

- **PostInstallDetector**: The security analyzer component that detects malicious postinstall scripts
- **Installation_Script**: npm lifecycle scripts (postinstall, preinstall, install) that execute during package installation
- **Risk_Score**: A numerical value (0-100) indicating the likelihood that a script is malicious
- **Suspicious_Pattern**: Code patterns commonly found in supply chain attacks (network requests, environment access, obfuscation)
- **CodeAnalyzer**: The main orchestrator that coordinates parsing, npm queries, and issue detection
- **NPMRegistry**: The service that queries npm registry for package metadata
- **Security_Issue**: An Issue object with type 'postinstall_risk' representing detected security concerns
- **Package_Metadata**: Information from npm registry including publish date, version, maintainer details
- **Dependency_Tree**: The set of direct and transitive dependencies declared in package.json

## Requirements

### Requirement 1: Detect Installation Scripts in package.json

**User Story:** As a developer, I want to detect postinstall scripts in my package.json, so that I can identify potential security risks before installation.

#### Acceptance Criteria

1. WHEN a package.json file contains a "postinstall" script, THE PostInstallDetector SHALL identify it as an Installation_Script
2. WHEN a package.json file contains a "preinstall" script, THE PostInstallDetector SHALL identify it as an Installation_Script
3. WHEN a package.json file contains an "install" script, THE PostInstallDetector SHALL identify it as an Installation_Script
4. WHEN a package.json file contains no installation scripts, THE PostInstallDetector SHALL return an empty result set
5. THE PostInstallDetector SHALL extract the complete script content for analysis

### Requirement 2: Analyze Script Content for Suspicious Patterns

**User Story:** As a developer, I want to detect suspicious patterns in installation scripts, so that I can identify potentially malicious code.

#### Acceptance Criteria

1. WHEN an Installation_Script contains curl commands, THE PostInstallDetector SHALL flag it as a network request pattern
2. WHEN an Installation_Script contains wget commands, THE PostInstallDetector SHALL flag it as a network request pattern
3. WHEN an Installation_Script contains fetch API calls, THE PostInstallDetector SHALL flag it as a network request pattern
4. WHEN an Installation_Script accesses process.env variables matching AWS_*, THE PostInstallDetector SHALL flag it as environment variable access
5. WHEN an Installation_Script accesses process.env.GITHUB_TOKEN, THE PostInstallDetector SHALL flag it as environment variable access
6. WHEN an Installation_Script uses fs.writeFile or fs.appendFile, THE PostInstallDetector SHALL flag it as file system operation
7. WHEN an Installation_Script uses eval or Function constructor, THE PostInstallDetector SHALL flag it as code execution pattern
8. WHEN an Installation_Script uses child_process.exec or child_process.spawn, THE PostInstallDetector SHALL flag it as code execution pattern
9. WHEN an Installation_Script contains base64 encoding, THE PostInstallDetector SHALL flag it as potential obfuscation
10. WHEN an Installation_Script contains hex encoding patterns, THE PostInstallDetector SHALL flag it as potential obfuscation

### Requirement 3: Calculate Risk Scores

**User Story:** As a developer, I want to see risk scores for installation scripts, so that I can prioritize security concerns.

#### Acceptance Criteria

1. WHEN an Installation_Script contains zero suspicious patterns, THE PostInstallDetector SHALL assign a Risk_Score of 0
2. WHEN an Installation_Script contains network requests to external domains, THE PostInstallDetector SHALL increase the Risk_Score by 30 points
3. WHEN an Installation_Script accesses sensitive environment variables, THE PostInstallDetector SHALL increase the Risk_Score by 40 points
4. WHEN an Installation_Script uses code execution patterns, THE PostInstallDetector SHALL increase the Risk_Score by 25 points
5. WHEN an Installation_Script contains obfuscation indicators, THE PostInstallDetector SHALL increase the Risk_Score by 20 points
6. WHEN an Installation_Script performs file system writes, THE PostInstallDetector SHALL increase the Risk_Score by 15 points
7. THE PostInstallDetector SHALL cap the Risk_Score at 100 maximum
8. WHEN the Risk_Score exceeds 70, THE PostInstallDetector SHALL assign severity "error"
9. WHEN the Risk_Score is between 40 and 70, THE PostInstallDetector SHALL assign severity "warning"
10. WHEN the Risk_Score is below 40, THE PostInstallDetector SHALL assign severity "info"

### Requirement 4: Analyze Dependency Installation Scripts

**User Story:** As a developer, I want to check if my dependencies have postinstall scripts, so that I can identify supply chain risks in third-party packages.

#### Acceptance Criteria

1. WHEN analyzing a package.json file, THE PostInstallDetector SHALL extract all dependency names from the "dependencies" field
2. WHEN analyzing a package.json file, THE PostInstallDetector SHALL extract all dependency names from the "devDependencies" field
3. FOR EACH dependency, THE PostInstallDetector SHALL query the NPMRegistry for Package_Metadata
4. WHEN Package_Metadata contains installation scripts, THE PostInstallDetector SHALL analyze them using the same pattern detection as Requirement 2
5. WHEN a dependency has a postinstall script, THE PostInstallDetector SHALL create a Security_Issue referencing the dependency name
6. THE PostInstallDetector SHALL complete dependency analysis within 5 seconds for projects with up to 50 dependencies

### Requirement 5: Detect Recently Published Packages

**User Story:** As a developer, I want to identify recently published packages in my dependencies, so that I can assess supply chain risk from new or potentially compromised packages.

#### Acceptance Criteria

1. WHEN querying Package_Metadata, THE PostInstallDetector SHALL extract the package publish date
2. WHEN a package was published less than 7 days ago, THE PostInstallDetector SHALL flag it as recently published
3. WHEN a recently published package has an Installation_Script, THE PostInstallDetector SHALL increase the Risk_Score by 10 points
4. THE PostInstallDetector SHALL include the publish date in the Security_Issue description

### Requirement 6: Generate Security Issues

**User Story:** As a developer, I want to receive detailed security warnings, so that I can understand and remediate supply chain risks.

#### Acceptance Criteria

1. WHEN a suspicious Installation_Script is detected, THE PostInstallDetector SHALL create a Security_Issue with type "postinstall_risk"
2. THE Security_Issue SHALL include the Risk_Score in the message
3. THE Security_Issue SHALL list all detected Suspicious_Pattern instances in the description
4. THE Security_Issue SHALL provide remediation suggestions based on the detected patterns
5. WHEN the script is in package.json, THE Security_Issue SHALL reference file "package.json" in the location
6. WHEN the script is in a dependency, THE Security_Issue SHALL include the dependency name in the message
7. THE Security_Issue SHALL set autoFixable to false
8. THE Security_Issue SHALL include a unique ID generated by generateId('issue')

### Requirement 7: Integrate with CodeAnalyzer

**User Story:** As a developer, I want security analysis integrated into my existing workflow, so that I receive security warnings alongside other code issues.

#### Acceptance Criteria

1. THE CodeAnalyzer SHALL invoke PostInstallDetector when analyzing projects containing package.json files
2. THE CodeAnalyzer SHALL include Security_Issue objects in the issues array of AnalysisResult
3. THE CodeAnalyzer SHALL increment the securityRisks counter in AnalysisSummary for each postinstall_risk issue
4. WHEN PostInstallDetector analysis fails, THE CodeAnalyzer SHALL log the error and continue with other analysis
5. THE CodeAnalyzer SHALL pass the checkNPMRegistry option to PostInstallDetector for dependency analysis

### Requirement 8: Provide Actionable Remediation Suggestions

**User Story:** As a developer, I want specific remediation guidance, so that I can fix security issues effectively.

#### Acceptance Criteria

1. WHEN network request patterns are detected, THE PostInstallDetector SHALL suggest "Review the external domains being contacted and verify they are legitimate"
2. WHEN environment variable access is detected, THE PostInstallDetector SHALL suggest "Audit environment variable usage and remove access to sensitive credentials"
3. WHEN code execution patterns are detected, THE PostInstallDetector SHALL suggest "Replace dynamic code execution with static alternatives"
4. WHEN obfuscation is detected, THE PostInstallDetector SHALL suggest "Investigate why code is obfuscated and consider alternative packages"
5. WHEN file system operations are detected, THE PostInstallDetector SHALL suggest "Verify file operations are necessary and review file paths"
6. WHEN multiple patterns are detected, THE PostInstallDetector SHALL combine suggestions into a prioritized list

### Requirement 9: Handle Analysis Errors Gracefully

**User Story:** As a developer, I want security analysis to handle errors gracefully, so that analysis failures do not block my workflow.

#### Acceptance Criteria

1. WHEN package.json parsing fails, THE PostInstallDetector SHALL log the error and return an empty result set
2. WHEN NPMRegistry queries fail, THE PostInstallDetector SHALL log the error and continue analyzing remaining dependencies
3. WHEN script content extraction fails, THE PostInstallDetector SHALL log the error and skip that script
4. IF network errors occur during dependency analysis, THE PostInstallDetector SHALL mark affected packages as "unverified" with severity "warning"
5. THE PostInstallDetector SHALL use the existing AnalysisError class for error reporting

### Requirement 10: Support Parser and Serializer Round-Trip Testing

**User Story:** As a developer, I want to ensure package.json parsing is reliable, so that security analysis produces accurate results.

#### Acceptance Criteria

1. THE PackageJsonParser SHALL parse package.json files into structured PackageJson objects
2. THE PackageJsonSerializer SHALL format PackageJson objects back into valid JSON strings
3. FOR ALL valid PackageJson objects, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
4. WHEN package.json contains invalid JSON, THE PackageJsonParser SHALL return a descriptive error
5. THE PackageJsonParser SHALL preserve all fields including scripts, dependencies, and devDependencies

### Requirement 11: Maintain Zero False Positives on Popular Packages

**User Story:** As a developer, I want accurate security warnings, so that I can trust the analysis results.

#### Acceptance Criteria

1. WHEN analyzing popular packages (axios, react, lodash, express), THE PostInstallDetector SHALL produce zero false positive Security_Issue objects
2. WHEN a package uses postinstall for legitimate build steps (TypeScript compilation, binary downloads), THE PostInstallDetector SHALL assign a Risk_Score below 40
3. THE PostInstallDetector SHALL recognize common legitimate patterns (node-gyp, tsc, webpack) and reduce Risk_Score accordingly
4. WHEN legitimate build tools are detected, THE Security_Issue description SHALL note "This may be a legitimate build script"

### Requirement 12: Enable Opt-In Security Analysis

**User Story:** As a developer, I want to control when security analysis runs, so that I can validate the feature before enabling it by default.

#### Acceptance Criteria

1. THE CodeAnalyzer SHALL accept an enableSecurityAnalysis option in AnalysisOptions
2. WHEN enableSecurityAnalysis is false, THE CodeAnalyzer SHALL skip PostInstallDetector invocation
3. WHEN enableSecurityAnalysis is true, THE CodeAnalyzer SHALL invoke PostInstallDetector
4. WHEN enableSecurityAnalysis is undefined, THE CodeAnalyzer SHALL default to false (opt-in behavior)
5. THE MCP tool handlers SHALL expose the enableSecurityAnalysis option to users

## Success Metrics

The implementation will be considered successful when:

- PostInstallDetector detects 80% or more of known malicious postinstall patterns from Shai-Hulud and similar attacks
- Zero false positives occur on the top 100 most downloaded npm packages
- Dependency analysis completes in under 5 seconds for typical projects (up to 50 dependencies)
- Security warnings include clear, actionable remediation guidance
- Integration with CodeAnalyzer maintains backward compatibility with existing analysis workflows
