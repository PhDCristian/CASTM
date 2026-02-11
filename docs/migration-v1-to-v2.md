# Migrating from v1 to v2

This guide describes how to move stable integrations from legacy OpenEdgeDSL v1 to the v2 package-based architecture.

## Scope

- Applies to stable features only (excluding proposals in `docs/future/*`).
- Assumes simulator and tools consume versioned `@openedge/*` packages.

## 1. Dependency model changes

### Before (v1, legacy patterns)

- Direct imports from internal `src` paths.
- `file:` dependencies or repo-relative aliases to compiler internals.

### After (v2)

- Consume public packages only:
  - `@openedge/compiler-api`
  - `@openedge/compiler-ir`
  - `@openedge/lang-spec`
- Pin versions by semver (no `file:` in production).

## 2. Public API changes

Use `@openedge/compiler-api` as the integration surface.

```ts
import { parse, analyze, compile, emit } from "@openedge/compiler-api";
```

### `compile` result model

v2 returns structured artifacts and diagnostics, including:
- `csv`
- `ast` / `hir` / `mir` / `lir`
- `memoryRegions`
- `ioConfig`
- `assertions`
- `symbols`

### Emitter format selection

```ts
emit(program, { format: "flat-csv" });      // default
emit(program, { format: "sim-matrix-csv" }); // simulator-oriented
```

## 3. Language compatibility notes

Stable v1 language/pragmas/directives are available in v2 (see `docs/feature-parity-matrix.md`).

Key points:
- `strictUnsupported` defaults to `true` and emits explicit errors for unsupported constructs.
- Route supports both compact and legacy syntax.
- NxM grid behavior is profile-driven (`targetProfile` + optional `grid` override).

## 4. Simulator migration checklist

1. Replace legacy compiler aliases with `@openedge/*` imports.
2. Pin package versions (example: `2.0.0-alpha.1`).
3. Run parity tests against shared fixtures.
4. Switch default backend to v2 after CI parity is green.
5. Keep legacy backend only as explicit opt-in during transition.

## 5. Compatibility layer note

The root package `@phdcristian/openedge-dsl` currently exposes compatibility entrypoints under `compat/*` for transition support. New integrations should target `@openedge/*` packages directly.

## 6. Validation commands

From OpenEdgeDSL root:

```bash
npm test
npm run check:boundaries
npm run docs:generate
npm run test:simulator-parity -- --simulator /path/to/UMA-CGRA-Simulator --skip-install
```
