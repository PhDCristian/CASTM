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
| C-like assignment desugar | done | `tests/compiler-api.contract.test.ts` | Supports copy form and full stable operator map (`+ - * ** << >> >>> & ~& \| ~\| ^ ~^`) with deterministic single-binary-expression lowering. |
| `function` (definition + call expansion) | partial | `tests/compiler-api.contract.test.ts` | Supports pre-kernel definitions, parameter substitution, nested non-recursive calls, and cycle-based bodies. |
| Labeled cycles + branch label resolution | done | `tests/compiler-api.contract.test.ts` | Supports `label: cycle { ... }`, branch/jump label resolution, duplicate/unknown label diagnostics, and expansion-safe function label prefixing. |
| `while` / `if` | partial | `tests/compiler-api.contract.test.ts` | Kernel/function lowering to branch+jump labeled cycles is in place; `#pragma no_fuse` now disables back-edge fusion where applicable (full v1 fusion parity still pending). |
| `for ... in range(...)` (kernel + `cycle`) | partial | `tests/compiler-api.contract.test.ts` | Supports compile-time unroll in kernel and cycle scopes, plus baseline `#pragma unroll(N)`, `#pragma no_unroll`, and `#pragma parallel collapse` including `collapse(N)` propagation over nested loops. |

## Directives

| Feature | Status | Tests | Notes |
|---|---|---|---|
| `.const`, `.alias` parse | done | indirect (`compile` contracts) | Exposed via `artifacts.symbols`. |
| `.data` parse + regions | done | `tests/compiler-api.contract.test.ts` | Also exposed in `memoryRegions`. |
| `.data2d` | done | `tests/compiler-api.contract.test.ts` | Supports declaration, region allocation, literal and dynamic 2D index lowering to address expressions. |
| `.io_load`, `.io_store` | done | `tests/compiler-api.contract.test.ts` | Parsed into `ioConfig` with non-negative validation and propagated through simulator v2 adapter contract tests. |
| `.assert` | done | `tests/compiler-api.contract.test.ts` | Structured assertion artifacts parsed and propagated to simulator v2 adapter/runtime contract tests. |
| `.limit` | done | `tests/compiler-api.contract.test.ts` | Parsed from directives, exposed in `artifacts.cycleLimit`, and enforced against expanded cycle count. |

## Pragmas

| Feature | Status | Tests | Notes |
|---|---|---|---|
| Pragma parsing (`#pragma ...`) | done | `tests/compiler-api.contract.test.ts` | Preserves text + span in AST. |
| Strict unsupported validation | done | `tests/compiler-api.contract.test.ts` | `strictUnsupported` default is `true` (`E3008`). |
| `unroll` / `no_unroll` / `parallel` / `no_fuse` | partial | `tests/compiler-api.contract.test.ts` | Parser-level control pragmas for loop lowering: unroll factor truncation, runtime `no_unroll` standard/aggressive paths (adjacent single-cycle fusion), nested `parallel collapse(N)` propagation, and no_fuse-controlled while back-edge fusion. |
| `route` lowering | done | `tests/compiler-api.contract.test.ts` | Compact `@r,c` and legacy `(r,c)` lower to route cycles with topology-aware paths, including custom-op destination forms with `INCOMING` resolution. |
| `broadcast` lowering | done | `tests/compiler-api.contract.test.ts` | Fanout implemented via route-style lowering for `row`/`column`/`all` scopes (including NxM grids). |
| `rotate`/`shift` lowering | done | `tests/compiler-api.contract.test.ts` | Lowering applies across all grid rows; `rotate` remains torus-only by design and `shift` supports fill values. |
| `scan` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `add/and/or/xor/max/min`, `inclusive/exclusive`, and `left/right/up/down` across all rows/cols lanes. |
| `reduce` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `sum/add/and/or/xor/mul/max/min` with `axis=row|col` using route-based NxM lowering. |
| `stencil` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `cross/horizontal/vertical` with `sum/add/avg` lowering across full grid. |
| `allreduce` lowering | done | `tests/compiler-api.contract.test.ts` | Composes NxM reduce + broadcast from `@0,0` with support for `axis=row|col`. |
| `transpose` lowering | done | `tests/compiler-api.contract.test.ts` | Square-grid lowering implemented via pairwise route swaps using scratch registers with non-square validation diagnostics. |
| `gather` lowering | done | `tests/compiler-api.contract.test.ts` | Full-grid gather to configurable destination with `add/sum/and/or/xor/mul` accumulation using route transfers. |
| `stream_load` / `stream_store` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `row` and `count` parameters with row-wide `LWD`/`SWD` emission over current grid width (including NxM). |
| `auto_cycle` lowering | done | `tests/compiler-api.contract.test.ts` | Parser-level grouping of PE-prefixed statements with conflict-based cycle inference and explicit diagnostics for malformed/nested/mixed regions. |

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
| Replace path alias imports to v2 internals | done | Simulator | `UMA-CGRA-Simulator/package.json` now consumes `@openedge/*` via fixed semver (`2.0.0-alpha.1`) rather than `file:` paths. |
| Remove legacy fallback for stable feature set | done | Simulator | Wrapper default and `auto` mode are now v2-first without silent fallback; legacy remains explicit opt-in (`backend: 'legacy'`). |
| Cross-repo parity workflow | done | OpenEdgeDSL + Simulator | Automated in `.github/workflows/v2-cross-repo-parity.yml` via `v2/scripts/run-simulator-parity.mjs` against simulator parity fixtures (`dsl-compiler-parity` + `dsl-compiler-v2-adapter`). |

## Executable Snippet

```openedge
target "uma-cgra-v1";
kernel "snippet_ok" {
  cycle {
    @0,0: EXIT;
  }
}
```
