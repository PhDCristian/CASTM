# Changelog

All notable changes to OpenEdgeDSL are documented in this file.

The format follows Keep a Changelog and Semantic Versioning intent for package releases.

## [Unreleased]

### Added
- Compiler phase contract document (`docs/compiler-contracts.md`).

### Changed
- Structured parser is now canonical-only (no fallback path to classic parser).
- Route coordinates are canonical-only (`@row,col`).
- `@openedge/compiler-front` public API now exports canonical entrypoints only.

### Removed
- Root compatibility layer (`compat/index.ts`, `compat/compiler.ts`).
- Local residual directories from transition phase (versioned staging tree and `editors/`).
- Migration/cutover/deprecation docs tied to compatibility paths.

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
- Pragmas and directives parity implementation for the stable feature set (see `docs/feature-parity-matrix.md`).
- CSV emission formats:
  - `flat-csv`
  - `sim-matrix-csv`
- Cross-repo parity workflow and simulator parity runner.

### Changed
- Repository root now hosts the package-based architecture directly.
- Root workflows renamed and aligned with the package-based architecture:
  - `.github/workflows/ci.yml`
  - `.github/workflows/cross-repo-parity.yml`

### Removed
- Legacy active compiler tree from root (`src/`), legacy editor extension sources, and old build flow from active development.

### Notes
- Legacy documentation is archived under `docs-legacy/`.
- Simulator consumption is expected through versioned `@openedge/*` packages.
