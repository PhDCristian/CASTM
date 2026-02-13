# OpenEdgeDSL Feature Parity Matrix

This matrix is the closure baseline for the canonical compiler. Source of truth is behavior validated by tests and stable docs (excluding `docs/future/*`).

## Status Legend

- `done`: Implemented in the current compiler with tests.
- `partial`: Implemented subset; explicit gap tracked.
- `pending`: Not implemented yet.

## Language Core

| Feature | Status | Tests | Notes |
|---|---|---|---|
| `target` declaration | done | `tests/compiler-api.contract.test.ts` | Required by parser (`E2001`). |
| `kernel` + `cycle` blocks | done | `tests/compiler-api.contract.test.ts` | Basic AST and lowering in place. |
| `@row,col`, `row`, `col`, `all` placement | done | `tests/compiler-api.contract.test.ts` | NxM grid override supported. |
| Row auto-broadcast (`FEAT-15`) | done | `tests/issues/feat-15-row-auto-broadcast.test.ts` | `at row N: <single-instruction>;` auto-expands to all columns in that row; segmented row forms keep explicit slots and fill remainder with `NOP`. |
| Coordinate range placement (`@r,c0..c1`, `@r0..r1,c`, `@r0..r1,c0..c1`) | done | `tests/issues/feat-08-range-coordinates.test.ts` | Range coordinates expand deterministically to concrete per-PE placements before lowering. |
| C-like assignment desugar | done | `tests/compiler-api.contract.test.ts` | Supports copy form and full stable operator map (`+ - * ** << >> >>> & ~& \| ~\| ^ ~^`) with deterministic single-binary-expression lowering. |
| Specialization pass (`FEAT-3`) | done | `tests/issues/feat-03-specialize.test.ts` | Applies safe algebraic identities (`*1`, `*0`, `+0`, `-0`, logical/shift identities) without changing ISA/output format. |
| `function` (definition + call expansion) | done | `tests/compiler-api.contract.test.ts` | Supports pre-kernel definitions, named/positional argument binding, nested non-recursive calls, label-safe expansion, and `all:` cycle statements inside expanded bodies. |
| Labeled cycles + branch label resolution | done | `tests/compiler-api.contract.test.ts` | Supports `label: cycle { ... }`, branch/jump label resolution, duplicate/unknown label diagnostics, and expansion-safe function label prefixing. |
| `while` / `if` | done | `tests/compiler-api.contract.test.ts` | Kernel/function lowering to branch+jump labeled cycles is in place, including fused-while neighbor-operand rewriting for control conditions. |
| `for ... in range(...)` (kernel + `cycle`) | done | `tests/compiler-api.contract.test.ts`, `tests/issues/bug-07-computed-loop-coords.test.ts` | Supports compile-time unroll (including descending ranges) in kernel/cycle scopes, explicit runtime loop form (`at @r,c runtime`), and computed spatial coordinates like `@k/4,k%4`. |
| Multi-statement cycle-line parsing | done | `tests/issues/issue-03-multi-statement-cycle-line.test.ts` | `cycle { ... }` bodies support semicolon-separated placements on the same line without instruction-text corruption. |

## Declarations & Runtime Directives

| Feature | Status | Tests | Notes |
|---|---|---|---|
| `let` const/alias parse | done | indirect (`compile` contracts) | Exposed via `artifacts.symbols`. |
| `let` 1D arrays + regions | done | `tests/compiler-api.contract.test.ts` | Also exposed in `memoryRegions`. |
| `let` 2D arrays | done | `tests/compiler-api.contract.test.ts` | Supports declaration, region allocation, literal and dynamic 2D index lowering to address expressions. |
| `.io_load`, `.io_store` | done | `tests/compiler-api.contract.test.ts` | Parsed into `ioConfig` with non-negative validation and propagated through simulator adapter contract tests. |
| `.assert` | done | `tests/compiler-api.contract.test.ts` | Structured assertion artifacts parsed and propagated to simulator adapter/runtime contract tests. |
| `.limit` | done | `tests/compiler-api.contract.test.ts` | Parsed from directives, exposed in `artifacts.cycleLimit`, and enforced against expanded cycle count. |

## Advanced Statements

| Feature | Status | Tests | Notes |
|---|---|---|---|
| Legacy pragma rejection (`#pragma ...`) | done | `tests/compiler-api.contract.test.ts` | Rejected with explicit parse diagnostics; canonical form is statement-based (`route(...)`, `reduce(...)`, ...). |
| Strict unsupported validation | done | `tests/compiler-api.contract.test.ts` | `strictUnsupported` default is `true` (`E3008`). |
| `route` lowering | done | `tests/compiler-api.contract.test.ts`, `tests/issues/bug-08-route-order.test.ts` | Canonical `@r,c` coordinates lower to topology-aware route cycles, including custom-op destination forms with `INCOMING` resolution and lexical-position-preserving insertion (no route hoisting). |
| `broadcast` lowering | done | `tests/compiler-api.contract.test.ts` | Fanout implemented via route-style lowering for `row`/`column`/`all` scopes (including NxM grids). |
| `rotate`/`shift` lowering | done | `tests/compiler-api.contract.test.ts` | Lowering applies across all grid rows; `rotate` remains torus-only by design and `shift` supports fill values. |
| `scan` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `add/and/or/xor/max/min`, `inclusive/exclusive`, and `left/right/up/down` across all rows/cols lanes. |
| `reduce` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `sum/add/and/or/xor/mul/max/min` with `axis=row|col` using route-based NxM lowering. |
| `stencil` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `cross/horizontal/vertical` with `sum/add/avg` lowering across full grid. |
| `triangle` lowering (`FEAT-6`) | done | `tests/issues/feat-06-triangle.test.ts` | Canonical spatial pattern statement: `triangle(shape=upper|lower, inclusive=true|false, op=..., dest=..., srcA=..., srcB=...)` lowers to deterministic row-major placements over the configured NxM grid. |
| `allreduce` lowering | done | `tests/compiler-api.contract.test.ts` | Composes NxM reduce + broadcast from `@0,0` with support for `axis=row|col`. |
| `transpose` lowering | done | `tests/compiler-api.contract.test.ts` | Square-grid lowering implemented via pairwise route swaps using scratch registers with non-square validation diagnostics. |
| `gather` lowering | done | `tests/compiler-api.contract.test.ts` | Full-grid gather to configurable destination with `add/sum/and/or/xor/mul` accumulation using route transfers. |
| `stream_load` / `stream_store` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `row` and `count` parameters with row-wide `LWD`/`SWD` emission over current grid width (including NxM). |
| `auto_cycle` lowering | done | `tests/compiler-api.contract.test.ts` | Parser-level grouping of PE-prefixed statements with conflict-based cycle inference and explicit diagnostics for malformed/nested/mixed regions. |
| Inline operand arithmetic folding (`FEAT-9`) | done | `tests/issues/feat-09-inline-arithmetic.test.ts` | Constant arithmetic in operands (`IMM(expr)`, `LWI/SWI addrExpr`, memory-sugar addresses) folds to deterministic integer literals when resolvable. |

## IR / Backend / Tooling

| Feature | Status | Tests | Notes |
|---|---|---|---|
| Pipeline `AST -> HIR -> MIR` | done | `tests/compiler-api.contract.test.ts` | Structured pass pipeline in place. |
| LIR stage (`MIR -> LIR`) | done | `tests/compiler-api.contract.test.ts` | Baseline structural lowering implemented. |
| CSV emitter `flat-csv` | done | `tests/compiler-api.contract.test.ts` | Canonical output with optional header. |
| CSV emitter `sim-matrix-csv` | done | `tests/compiler-api.contract.test.ts` | Format compatible with simulator matrix layout. |
| Import boundary checker | done | `scripts/check-boundaries.mjs` | Root resolution fixed; now validates real tree. |
| CI workflow | done | `.github/workflows/ci.yml` | Adds test + docs + boundary gates. |

## Cross-Repo Cutover Checklist (Simulator)

| Item | Status | Owner | Exit Condition |
|---|---|---|---|
| Replace path alias imports to package internals | done | Simulator | `UMA-CGRA-Simulator/package.json` now consumes `@openedge/*` via fixed semver (`2.0.0-alpha.1`) rather than `file:` paths. |
| Remove legacy fallback for stable feature set | done | Simulator | Wrapper default and `auto` mode use the package-based compiler (no legacy compiler path). |
| Cross-repo parity workflow | done | OpenEdgeDSL + Simulator | Automated in `.github/workflows/cross-repo-parity.yml` via `scripts/run-simulator-parity.mjs` against simulator parity fixtures (`dsl-compiler-parity` + adapter suite). |

## Executable Snippet

```openedge
target "uma-cgra-base";
kernel "snippet_ok" {
  cycle {
    @0,0: EXIT;
  }
}
```
