# CASTM Feature Parity Matrix

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
| Labeled cycles + branch label resolution | done | `tests/compiler-api.contract.test.ts` | Supports `label: bundle { ... }`, branch/jump label resolution, duplicate/unknown label diagnostics, and expansion-safe function label prefixing. |
| `while` / `if` | done | `tests/compiler-api.contract.test.ts` | Kernel/function lowering to branch+jump labeled cycles is in place, including fused-while neighbor-operand rewriting for control conditions. |
| `for ... in range(...)` (kernel + `cycle`) | done | `tests/compiler-api.contract.test.ts`, `tests/issues/bug-07-computed-loop-coords.test.ts` | Supports compile-time unroll (including descending ranges) in kernel/cycle scopes, explicit runtime loop form (`at @r,c runtime`), and computed spatial coordinates like `@k/4,k%4`. |
| Loop modifiers (`FEAT-18`): `unroll(k)` / `collapse(n)` contracts | done | `tests/issues/feat-18-loop-modifiers.test.ts`, `tests/issues/feat-20-collapse-edge-cases.test.ts` | Deterministic static expansion with duplicate/invalid modifier diagnostics and explicit runtime-loop rejection for static-only modifiers. |
| Function expansion mode (`FEAT-18`): `full-unroll` / `jump-reuse` | done | `tests/issues/feat-18-expansion-mode.test.ts` | `full-unroll` remains default; `jump-reuse` reuses per-signature specializations with deterministic call/return lowering. |
| Scheduler modes (`FEAT-19`) | done | `tests/issues/feat-19-scheduler-modes.test.ts` | `safe`, `balanced`, `aggressive` modes preserve deterministic output and non-regressive instruction workload invariants. |
| For/control-flow contract hardening (`FEAT-21`) | done | `tests/issues/feat-21-for-control-flow-contract.test.ts` | Explicit parser diagnostics for malformed for/if/while headers and valid nested composition behavior. |
| Spatial compaction idioms (`FEAT-22`) | done | `tests/issues/feat-22-spatial-compaction-idioms.test.ts` | Canonical compact idioms (`at all`, range + loop index addressing) compile deterministically to expected full-grid placements. |
| Multi-statement cycle-line parsing | done | `tests/issues/issue-03-multi-statement-cycle-line.test.ts` | `bundle { ... }` bodies support semicolon-separated placements on the same line without instruction-text corruption. |

## Declarations & Runtime Statements

| Feature | Status | Tests | Notes |
|---|---|---|---|
| `let` const/alias parse | done | indirect (`compile` contracts) | Exposed via `artifacts.symbols`. |
| `let` 1D arrays + regions | done | `tests/compiler-api.contract.test.ts` | Also exposed in `memoryRegions`. |
| `let` 2D arrays | done | `tests/compiler-api.contract.test.ts` | Supports declaration, region allocation, literal and dynamic 2D index lowering to address expressions. |
| `io.load(...)`, `io.store(...)` | done | `tests/compiler-api.contract.test.ts` | Parsed into typed runtime statements, validated as non-negative addresses, and propagated through `ioConfig` artifacts. |
| `assert(...)` | done | `tests/compiler-api.contract.test.ts` | Parsed as typed assertion runtime statements and propagated to simulator/runtime contract artifacts. |
| `limit(...)` | done | `tests/compiler-api.contract.test.ts` | Parsed as typed runtime statement, exposed in `artifacts.cycleLimit`, and enforced against expanded cycle count. |

## Advanced Statements

| Feature | Status | Tests | Notes |
|---|---|---|---|
| Legacy pragma rejection (`#pragma ...`) | done | `tests/compiler-api.contract.test.ts` | Rejected with explicit parse diagnostics; canonical form is statement-based (`route(...)`, `reduce(...)`, ...). |
| Strict unsupported validation | done | `tests/compiler-api.contract.test.ts` | `strictUnsupported` default is `true` (`E3008`). |
| `route` lowering (`OPT-B` baseline) | done | `tests/compiler-api.contract.test.ts`, `tests/issues/bug-08-route-order.test.ts`, `tests/issues/opt-b-route-parallel-pack.test.ts` | Canonical `@r,c` coordinates lower to topology-aware route cycles, including custom-op destination forms with lexical-position-preserving insertion (no route hoisting). Conservative packing now allows overlap of disjoint route steps while preserving direct hop dependencies. |
| `latency_hide` scheduling (`FEAT-1`, `OPT-A` baseline) | done | `tests/issues/feat-01-latency-hide.test.ts`, `tests/compiler-api.latency-hide.test.ts`, `tests/issues/opt-a-cycle-packing.test.ts`, `tests/compiler-api.slot-pack-pass.test.ts` | Deterministic post-expansion slot packing (placement-level) with hazard guards (PE overlap, route-hop dependencies, control barriers, memory-policy fences). Numeric branch targets are remapped when noop cycles are removed. |
| `stash` lowering (`FEAT-10`) | done | `tests/issues/feat-10-stash.test.ts` | Canonical explicit spill/restore statement `stash(action=save|restore, reg=..., addr=..., target=...)` lowers deterministically to one-cycle `SWI/LWI` placements over `all|row|col|point` targets. |
| `broadcast` lowering | done | `tests/compiler-api.contract.test.ts` | Fanout implemented via route-style lowering for `row`/`column`/`all` scopes (including NxM grids). |
| `carry_chain` lowering (`FEAT-2`) | done | `tests/issues/feat-02-carry-chain.test.ts` | Canonical carry primitive `carry_chain(src=..., carry=..., store=..., limbs=..., width=..., row=...)` lowers deterministically to four staged cycles per limb (`SADD`, `LAND`, `SWI`, `SRT`). |
| `accumulate` lowering (`FEAT-13`) | done | `tests/issues/feat-13-accumulate.test.ts` | Canonical accumulation pattern `accumulate(pattern=row|col|anti_diagonal, products=..., accum=..., out=..., steps=..., scope=...)` lowers deterministically across NxM grids with explicit stage ordering, bounded propagation depth, and scoped row/column execution. |
| `conditional_sub` lowering (`FEAT-14`) | done | `tests/issues/feat-14-conditional-sub.test.ts` | Canonical branchless subtraction/selection `conditional_sub(value=..., sub=..., dest=..., target=...)` lowers deterministically to two stages (`SSUB`, `BSFA`) over the selected spatial scope. |
| `collect` lowering (`FEAT-12`) | done | `tests/issues/feat-12-collect.test.ts` | Canonical aligned lane collection `collect(from=row|col(...), to=..., via=..., local=..., into=..., combine=...)` lowers deterministically for adjacent/same-lane transfers with explicit geometry diagnostics. |
| `normalize` lowering (`FEAT-5`) | done | `tests/issues/feat-05-normalize.test.ts` | Canonical lane normalization `normalize(reg=..., carry=..., width=..., lane=...)` lowers to deterministic four-cycle carry pipeline over selected row/column lanes in NxM grids. |
| `extract_bytes` lowering (`FEAT-11`) | done | `tests/issues/feat-11-extract-bytes.test.ts` | Canonical byte-lane extraction `extract_bytes(src=..., dest=..., axis=row|col)` lowers to deterministic two-cycle full-grid expansion (`SRT` + `LAND`) with configurable `byteWidth` and `mask`. |
| `rotate`/`shift` lowering | done | `tests/compiler-api.contract.test.ts` | Lowering applies across all grid rows; `rotate` remains torus-only by design and `shift` supports fill values. |
| `scan` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `add/and/or/xor/max/min`, `inclusive/exclusive`, and `left/right/up/down` across all rows/cols lanes. |
| `reduce` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `sum/add/and/or/xor/mul/max/min` with `axis=row|col` using route-based NxM lowering. |
| `stencil` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `cross/horizontal/vertical` with `sum/add/avg` lowering across full grid. |
| `guard` lowering (`FEAT-17`) | done | `tests/issues/feat-17-guard-condition.test.ts` | Predicate-driven spatial activation using `row/col/idx/rows/cols` with deterministic row-major expansion over NxM grids. |
| `triangle` lowering (`FEAT-6`) | done | `tests/issues/feat-06-triangle.test.ts` | Canonical spatial pattern statement: `triangle(shape=upper|lower, inclusive=true|false, op=..., dest=..., srcA=..., srcB=...)` lowers to deterministic row-major placements over the configured NxM grid. |
| `allreduce` lowering | done | `tests/compiler-api.contract.test.ts` | Composes NxM reduce + broadcast from `@0,0` with support for `axis=row|col`. |
| `transpose` lowering | done | `tests/compiler-api.contract.test.ts` | Square-grid lowering implemented via pairwise route swaps using scratch registers with non-square validation diagnostics. |
| `gather` lowering | done | `tests/compiler-api.contract.test.ts` | Full-grid gather to configurable destination with `add/sum/and/or/xor/mul` accumulation using route transfers. |
| `stream_load` / `stream_store` lowering | done | `tests/compiler-api.contract.test.ts` | Supports `row` and `count` parameters with row-wide `LWD`/`SWD` emission over current grid width (including NxM). |
| `auto_cycle` lowering | done | `tests/compiler-api.contract.test.ts` | Parser-level grouping of PE-prefixed statements with conflict-based cycle inference and explicit diagnostics for malformed/nested/mixed regions. |
| Inline operand arithmetic folding (`FEAT-9`) | done | `tests/issues/feat-09-inline-arithmetic.test.ts` | Constant arithmetic in operands (`expr`, `LWI/SWI addrExpr`, memory-sugar addresses) folds to deterministic integer literals when resolvable. |
| `pipeline` function-sequence macro (`FEAT-16`) | done | `tests/issues/feat-16-pipeline.test.ts` | `pipeline(fnA(...), fnB(...), ...)` expands to ordered canonical function calls before function lowering, preserving existing function semantics and diagnostics. |

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
| Replace path alias imports to package internals | done | Simulator | `UMA-CGRA-Simulator/package.json` now consumes `@castm/*` via fixed semver (`2.0.0-alpha.1`) rather than `file:` paths. |
| Remove legacy fallback for stable feature set | done | Simulator | Wrapper default and `auto` mode use the package-based compiler (no legacy compiler path). |
| Cross-repo parity workflow | done | CASTM + Simulator | Automated in `.github/workflows/cross-repo-parity.yml` via `scripts/run-simulator-parity.mjs` against simulator parity fixtures (`dsl-compiler-parity` + adapter suite). |

## Executable Snippet

```castm
target base;
kernel "snippet_ok" {
  bundle {
    @0,0: EXIT;
  }
}
```
