# OpenEdgeDSL v2 Feature Parity Matrix

This matrix is the v2 closure baseline. Source of truth is stable v1 behavior validated by tests and stable docs (excluding `docs/future/*`).

## Status Legend

- `done`: Implemented in v2 with tests.
- `partial`: Implemented subset in v2; explicit gap tracked.
- `pending`: Not implemented in v2 yet.

## Language Core

| Feature | Status | Tests | Notes |
|---|---|---|---|
| `target` declaration | done | `tests/compiler-api.contract.test.ts` | Required by parser (`E2001`). |
| `kernel` + `cycle` blocks | done | `tests/compiler-api.contract.test.ts` | Basic AST and lowering in place. |
| `@row,col`, `row`, `col`, `all` placement | done | `tests/compiler-api.contract.test.ts` | NxM grid override supported. |
| C-like assignment desugar | partial | `tests/compiler-api.contract.test.ts` | Baseline arithmetic only. |
| `function` (definition + call expansion) | partial | `tests/compiler-api.contract.test.ts` | Supports pre-kernel definitions, parameter substitution, nested non-recursive calls, and cycle-based bodies. |
| Labeled cycles + branch label resolution | partial | `tests/compiler-api.contract.test.ts` | Supports `label: cycle { ... }`, branch/jump label resolution, duplicate/unknown label diagnostics. |
| `while` / `if` | pending | - | Planned in v2 frontend/lowering phases. |
| `for ... in range(...)` inside `cycle` | partial | `tests/compiler-api.contract.test.ts` | Compile-time unroll with nested loops and collision detection; advanced pragmas/runtime loops pending. |

## Directives

| Feature | Status | Tests | Notes |
|---|---|---|---|
| `.const`, `.alias` parse | done | indirect (`compile` contracts) | Exposed via `artifacts.symbols`. |
| `.data` parse + regions | done | `tests/compiler-api.contract.test.ts` | Also exposed in `memoryRegions`. |
| `.data2d` | pending | - | Not ported yet. |
| `.io_load`, `.io_store` | partial | `tests/compiler-api.contract.test.ts` | Parsed as raw directives, emitted in `ioConfig`. |
| `.assert` | partial | `tests/compiler-api.contract.test.ts` | Collected into `artifacts.assertions`; lowering pending. |
| `.limit` | pending | - | Not ported yet. |

## Pragmas

| Feature | Status | Tests | Notes |
|---|---|---|---|
| Pragma parsing (`#pragma ...`) | done | `tests/compiler-api.contract.test.ts` | Preserves text + span in AST. |
| Strict unsupported validation | done | `tests/compiler-api.contract.test.ts` | `strictUnsupported` default is `true` (`E3008`). |
| `route` lowering | pending | - | Transitional behavior: allowed only with `strictUnsupported: false`. |
| `auto_cycle` lowering | pending | - | Pass currently no-op. |
| Advanced codegen pragmas (`reduce`, `scan`, etc.) | pending | - | Tracked for v2 completion phases. |

## IR / Backend / Tooling

| Feature | Status | Tests | Notes |
|---|---|---|---|
| Pipeline `AST -> HIR -> MIR` | done | `tests/compiler-api.contract.test.ts` | Structured pass pipeline in place. |
| LIR stage (`MIR -> LIR`) | done | `tests/compiler-api.contract.test.ts` | Baseline structural lowering implemented. |
| CSV emitter `flat-csv` | done | `tests/compiler-api.contract.test.ts` | Canonical output with optional header. |
| CSV emitter `sim-matrix-csv` | done | `tests/compiler-api.contract.test.ts` | Format compatible with simulator matrix layout. |
| Import boundary checker | done | `v2/scripts/check-boundaries.mjs` | Root resolution fixed; now validates real tree. |
| v2 CI workflow | done | `.github/workflows/v2-ci.yml` | Adds test + docs + boundary gates. |

## Cross-Repo Cutover Checklist (Simulator)

| Item | Status | Owner | Exit Condition |
|---|---|---|---|
| Replace path alias imports to v2 internals | pending | Simulator | Consume only published `@openedge/*` versions. |
| Remove legacy fallback for stable feature set | pending | Simulator | Contract parity in CI is green. |
| Cross-repo parity workflow | pending | OpenEdgeDSL + Simulator | Compile parity + simulation parity fixtures in CI. |

## Executable Snippet

```openedge
target "uma-cgra-v1";
kernel "snippet_ok" {
  cycle {
    @0,0: EXIT;
  }
}
```
