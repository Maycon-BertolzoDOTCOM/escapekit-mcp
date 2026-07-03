# CodeMemória Periodization Roadmap Implementation Tasks

## Phase 2 - GitHub Action for Compliance Report in PRs
- [x] 2.1 Create GitHub Action package structure
  - Set up `packages/github-action/` with `action.yml`, `package.json` and `src/main.ts`
  - Define inputs: `github-token`, `config-path`, `contracts-dir` in `action.yml`
  - Configure `@actions/core`, `@actions/github` as dependencies

- [x] 2.2 Implement `ConfigLoader.ts`
  - Read `.codememoría.yml` with secure defaults
  - Return defaults when file doesn't exist
  - Log warnings for malformed config without failing workflow

- [x] 2.3 Implement `CheckRunner.ts`
  - Get modified files list via GitHub API
  - Apply `ignorePatterns` from config
  - Run `GovernanceEngine` on PR diff files
  - Calculate aggregate `riskLevel` from passports

- [x] 2.4 Implement `PRCommentBuilder.ts`
  - Generate inline SVG badge by risk level
  - Include compliance report hash in comment
  - Format markdown report with findings summary

- [x] 2.5 Integrate in `main.ts`
  - Wire up complete flow: config → diff → analysis → comment → check status
  - Set check status (`failure` for high/critical risk)
  - Handle errors gracefully with job summaries

- [x]* 2.6 Write unit tests
  - Test `ConfigLoader` default values
  - Verify inline SVG badge generation
  - Test error cases

- [x]* 2.7 Write property test P2
  - **Property 2**: Verify hash in PR comment matches CLI hash
  - Ensure cross-environment consistency
  - Run minimum 100 iterations

- [ ]* 2.8 Write property test P3
  - **Property 3**: Risk level determines check status
  - Verify bidirectional mapping for all levels

- [ ] 2.9 Phase 2 checkpoint
  - Verify action processes simulated PR diff
  - Confirm comment posting with verifiable hash
  - Get user approval before Phase 3

## Subsequent Phases
(Will be added after completing Phase 2)
