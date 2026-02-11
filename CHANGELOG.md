# Changelog

All notable changes to OpenEdgeDSL are documented in this file.

The format follows Keep a Changelog and Semantic Versioning intent for package releases.

## [Unreleased]

### Added
- Release documentation for v2 cutover (`docs/migration-v1-to-v2.md`, `docs/release-cutover-checklist.md`, `docs/deprecation-policy.md`).

## [2.0.0-alpha.1] - 2026-02-11

### Added
- Multi-package architecture under `packages/*`:
  - `@openedge/lang-spec`
  - `@openedge/compiler-front`
  - `@openedge/compiler-ir`
  - `@openedge/compiler-backend-csv`
  - `@openedge/compiler-api`
  - `@openedge/lsp-server`
  - `@openedge/cli`
  - `@openedge/testkit`
- Structured compiler pipeline (`AST -> HIR -> MIR -> LIR`) with typed diagnostics and artifacts.
- Pragmas and directives parity implementation for stable v1 feature set (see `docs/feature-parity-matrix.md`).
- CSV emission formats:
  - `flat-csv`
  - `sim-matrix-csv`
- Cross-repo parity workflow and simulator parity runner.

### Changed
- Repository root now hosts the v2 architecture directly.
- Root workflows renamed and aligned with v2:
  - `.github/workflows/ci.yml`
  - `.github/workflows/cross-repo-parity.yml`
- Root package now provides compatibility exports for simulator integrations through:
  - `compat/index.ts`
  - `compat/compiler.ts`

### Removed
- Legacy v1 active compiler tree from root (`src/`), legacy editor extension sources, and old build flow from active development.

### Notes
- Legacy documentation is archived under `docs-legacy-v1/`.
- Simulator consumption is expected through versioned `@openedge/*` packages.
