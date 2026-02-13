# Issue Closure Roadmap — Canonical Compiler

This document is the execution roadmap for `ISSUES_SBOX_K7_PORT.md` in canonical-only mode.

Source of truth:

- `docs/issue-status-matrix.md` for per-ID status.
- executable tests under `tests/`.
- commit history on `main`.

## Snapshot (2026-02-13)

- Defect/regression IDs tracked (`Issue-*`, `BUG-*`, `REG-*`): `29`
- `resolved-verified`: `21`
- `canonical-intentional`: `8`
- `pending-fix`: `0`
- `simulator-pending`: `0`
- Backlog proposal IDs (`OPT-*`, `FEAT-*`): `24` (`15` validated, `9` in backlog)

## Workstreams

### WS-01 — Canonical Language Hardening

Status: `done`  
Completed: `2026-02-11`

Why:

- enforce one canonical syntax and remove ambiguity from historical forms.
- avoid technical debt from parser duality.

Subtasks:

- [x] Remove compatibility/migration path from the compilation core.
- [x] Reject non-canonical syntax explicitly with diagnostics.
- [x] Keep canonical advanced statements (`route(...)`, `reduce(...)`, `scan(...)`, etc.) as the single public surface.

Evidence:

- Commits: `6b130a1`, `c39bcf6`, `453517b`, `137e2b8`.
- Tests: `tests/compiler-api.contract.test.ts`, `tests/issues/resolved-and-legacy.test.ts`.

### WS-02 — Compiler Architecture Refactor

Status: `done`  
Completed: `2026-02-11`

Why:

- split monolithic parser/passes into maintainable modules.
- keep lowering responsibilities outside parsing code.

Subtasks:

- [x] Modularize parser scope/cycle/control/function handlers.
- [x] Split pragma/desugar/lower helpers into dedicated modules.
- [x] Split driver/runtime artifact flow.

Evidence:

- Commits: `dc35293`, `91ff171`, `b16a0c2`, `1ec7259`, `4c24359`, `31a324d`, `38c65c0`, `3b76884`.
- Tests: `tests/compiler-front.tokenizer.test.ts`, `tests/compiler-api.contract.test.ts`.

### WS-03 — Contract and Coverage Hardening

Status: `done`  
Completed: `2026-02-12` to `2026-02-13`

Why:

- refactors without deep tests are not safe.
- issue closure requires reproducible regression guards.

Subtasks:

- [x] Add branch/edge coverage suites for parser, lowering and passes.
- [x] Reach and maintain global coverage gate at `100%`.
- [x] Keep contract tests for docs snippets and LSP behavior.

Evidence:

- Commits: `f4a4daf`, `ec65c6c`, `b780254`, `d119d07`.
- Tests: all suites under `tests/` (current baseline in green).

### WS-04 — SBOX K7 Critical Bug Closure

Status: `done`  
Completed: `2026-02-13`

Why:

- remove correctness regressions found during the K7 port.
- stabilize coordinate expansion, ordering semantics, and cycle-line parsing.

Subtasks:

- [x] Fix computed loop coordinates (`BUG-7`) for canonical `for { cycle {} }`.
- [x] Fix route lexical-order preservation (`BUG-8`) to avoid hoisting.
- [x] Fix multi-statement cycle-line parsing (`Issue-3` / `BUG-9` surface).
- [x] Add issue-specific regression suites.

Evidence:

- Commit: `384e350`.
- Tests:
  - `tests/issues/bug-07-computed-loop-coords.test.ts`
  - `tests/issues/bug-08-route-order.test.ts`
  - `tests/issues/issue-03-multi-statement-cycle-line.test.ts`

### WS-05 — Issue Governance and Tracking

Status: `done`  
Completed: `2026-02-13`

Why:

- distinguish real defects from intentional canonical behavior.
- keep a single operational matrix with explicit ownership and evidence.

Subtasks:

- [x] Create and maintain `docs/issue-status-matrix.md`.
- [x] Tag each ID as `resolved-verified`, `canonical-intentional`, or backlog.
- [x] Add non-regression tests for previously resolved issue families.

Evidence:

- Commits: `c40d998`, `7e880c7`.
- Tests: `tests/issues/resolved-core-broadcast-and-loop.test.ts`, `tests/issues/resolved-and-legacy.test.ts`.

### WS-06 — Cross-Repo Simulator Contract

Status: `done` (current issue corpus)  
Completed: `2026-02-13`

Why:

- ensure compiler behavior is preserved when consumed by simulator tooling.

Subtasks:

- [x] Add simulator-side contract tests for critical issue corpus.
- [x] Verify route order, computed coordinates and multi-statement behavior end to end.

Evidence:

- Simulator commit: `c2b3e6e`.
- Simulator tests: `src/__tests__/dsl-compiler-issue-contract.test.ts`.

### WS-07 — FEAT-8 Range Coordinate Syntax

Status: `done`  
Completed: `2026-02-13`

Why:

- reduce boilerplate for repeated per-PE placements.
- keep canonical syntax while improving readability in dense cycle definitions.

Subtasks:

- [x] Add range placement support in cycle statements: `@r,c0..c1`, `@r0..r1,c`, `@r0..r1,c0..c1`.
- [x] Keep deterministic lowering by expanding ranges to concrete `@row,col` placements.
- [x] Support loop-bound unresolved axis via `at-expr` handoff for later binding.
- [x] Add dedicated regression tests and documentation updates.

Evidence:

- Tests: `tests/issues/feat-08-range-coordinates.test.ts`.
- Docs: `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

### WS-08 — FEAT-9 Inline Operand Arithmetic

Status: `done`  
Completed: `2026-02-13`

Why:

- remove friction when writing address/immediate formulas directly in canonical DSL.
- avoid forcing temporary declarations for simple arithmetic constants.

Subtasks:

- [x] Add pass-level folding for resolvable arithmetic in instruction operands.
- [x] Support `IMM(expr)` and direct `LWI/SWI` address expressions.
- [x] Keep unresolved symbolic expressions unchanged (no false errors).
- [x] Add dedicated feature regression suite.

Evidence:

- Tests: `tests/issues/feat-09-inline-arithmetic.test.ts`.
- Pipeline update: `packages/compiler-api/src/compiler-driver/analyze-driver.ts` (desugar stage).

### WS-09 — FEAT-3 Specialize Pass

Status: `done`  
Completed: `2026-02-13`

Why:

- reduce redundant identity operations automatically without ISA changes.
- keep canonical output deterministic through safe algebraic rewrites only.

Subtasks:

- [x] Add `specialize` pass in desugar stage for proven-safe identities (`*1/*0`, `+0`, `-0`, logical neutral constants, shifts by zero).
- [x] Wire pass into canonical analyze pipeline after inline arithmetic folding.
- [x] Add dedicated regression coverage and update contracts/docs.

Evidence:

- Commit: `49424a6`.
- Tests: `tests/issues/feat-03-specialize.test.ts`, updated contracts in `tests/compiler-api.contract.test.ts`, `tests/issues/feat-09-inline-arithmetic.test.ts`.

### WS-10 — FEAT-6 Triangle Spatial Pattern

Status: `done`  
Completed: `2026-02-13`

Why:

- provide a general spatial pattern primitive for upper/lower triangular activation.
- avoid hand-written coordinate lists while preserving deterministic lowering.

Subtasks:

- [x] Add canonical advanced statement `triangle(shape=..., inclusive=..., op=..., dest=..., srcA=..., srcB=...)`.
- [x] Implement parser/handler/builder lowering with deterministic row-major expansion over NxM grid.
- [x] Add feature, handler, parser/tokenizer tests and documentation.

Evidence:

- Tests: `tests/issues/feat-06-triangle.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`, `tests/compiler-front.tokenizer.test.ts`.
- Docs: `docs/language/triangle-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

### WS-11 — FEAT-15 Row Auto-Broadcast

Status: `done`  
Completed: `2026-02-13`

Why:

- keep row-wide programming concise without repeating identical per-column placements.
- preserve deterministic semantics for both single-instruction and segmented row forms.

Subtasks:

- [x] Validate and document canonical row auto-broadcast semantics (`at row N: INSTR;`).
- [x] Add dedicated regression tests for default 4x4 and NxM grids.
- [x] Guard canonical-only policy by rejecting legacy row syntax without `at`.

Evidence:

- Tests: `tests/issues/feat-15-row-auto-broadcast.test.ts`.
- Docs: `docs/feature-parity-matrix.md`, `docs/language/language-spec.md`.

### WS-12 — FEAT-17 Guard Spatial Predicate

Status: `done`  
Completed: `2026-02-13`

Why:

- provide a general predicate-based spatial pattern beyond fixed triangle forms.
- keep deterministic compile-time lowering for sparse activation patterns.

Subtasks:

- [x] Add canonical `guard(cond=..., op=..., dest=..., srcA=..., srcB=...)` statement.
- [x] Implement predicate evaluation over `row`, `col`, `idx`, `rows`, `cols` in NxM grids.
- [x] Add diagnostics for malformed/unevaluable predicates and full regression coverage.

Evidence:

- Tests: `tests/issues/feat-17-guard-condition.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`.
- Docs: `docs/language/guard-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`.

### WS-13 — FEAT-12 Collect Lane Pattern

Status: `done`  
Completed: `2026-02-13`

Why:

- provide a canonical lane-collection primitive for row/column aligned single-hop data movement.
- replace repeated hand-written collect idioms with deterministic lowering and explicit geometry checks.

Subtasks:

- [x] Add canonical `collect(from=..., to=..., via=..., local=..., into=..., combine=...)` statement.
- [x] Implement parser/handler/builder lowering with deterministic NxM behavior and explicit diagnostics for unsupported geometry.
- [x] Add feature regression tests and language documentation.

Evidence:

- Tests: `tests/issues/feat-12-collect.test.ts`, `tests/compiler-api.collective-builders.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`.
- Docs: `docs/language/collect-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

### WS-14 — FEAT-5 Normalize Lane Primitive

Status: `done`  
Completed: `2026-02-13`

Why:

- abstract repeated carry-normalization idioms into a canonical statement with deterministic lowering.
- keep the feature general-purpose (lane-based arithmetic normalization) rather than kernel/domain-specific templates.

Subtasks:

- [x] Add canonical `normalize(reg=..., carry=..., width=..., lane=...)` statement with `axis/dir/mask` options.
- [x] Implement deterministic 4-cycle lowering (`SRT`, `LAND`, carry relay, lane add) for row/column lanes.
- [x] Add parser/handler/builder/issue tests and documentation.

Evidence:

- Tests: `tests/issues/feat-05-normalize.test.ts`, `tests/compiler-api.collective-builders.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`.
- Docs: `docs/language/normalize-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

### WS-15 — FEAT-11 Extract Bytes Unification

Status: `done`  
Completed: `2026-02-13`

Why:

- unify row/column byte-extraction idioms into one canonical statement.
- keep this abstraction general and parameterized (axis/byteWidth/mask), avoiding domain-specific hardcoded macros.

Subtasks:

- [x] Add canonical `extract_bytes(src=..., dest=...)` statement with `axis/byteWidth/mask` options.
- [x] Implement deterministic two-cycle lowering (`SRT`, `LAND`) over the active NxM grid.
- [x] Add parser/handler/builder/issue tests and language docs.

Evidence:

- Tests: `tests/issues/feat-11-extract-bytes.test.ts`, `tests/compiler-api.collective-builders.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`.
- Docs: `docs/language/extract-bytes-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

### WS-16 — FEAT-13 Accumulation Pattern

Status: `done`  
Completed: `2026-02-13`

Why:

- replace large manual accumulation graphs with one canonical statement.
- keep the feature general across NxM grids (`row`, `col`, `anti_diagonal`) and avoid domain hardcoding.

Subtasks:

- [x] Add canonical `accumulate(pattern=..., products=..., accum=..., out=...)` statement with optional `combine=...`.
- [x] Implement deterministic staged lowering for row/column/anti-diagonal patterns.
- [x] Add parser/handler/builder/issue tests and language docs.

Evidence:

- Tests: `tests/issues/feat-13-accumulate.test.ts`, `tests/compiler-api.collective-builders.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`.
- Docs: `docs/language/accumulate-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

### WS-17 — FEAT-14 Conditional Subtraction Primitive

Status: `done`  
Completed: `2026-02-13`

Why:

- replace repeated branchless subtraction idioms with one canonical primitive.
- keep semantics general and portable through explicit spatial targeting.

Subtasks:

- [x] Add canonical `conditional_sub(value=..., sub=..., dest=...)` statement with optional `target=all|row|col|point(r,c)`.
- [x] Implement deterministic two-cycle lowering (`SSUB`, `BSFA`) over selected placements.
- [x] Add parser/handler/builder/issue tests and language docs.

Evidence:

- Tests: `tests/issues/feat-14-conditional-sub.test.ts`, `tests/compiler-api.collective-builders.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`.
- Docs: `docs/language/conditional-sub-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

### WS-18 — FEAT-2 Carry Chain Primitive

Status: `done`  
Completed: `2026-02-13`

Why:

- replace repeated limb carry cycles with one canonical primitive.
- keep behavior deterministic and parameterized (width/mask/direction/start column) without domain hardcoding.

Subtasks:

- [x] Add canonical `carry_chain(src=..., carry=..., store=..., limbs=..., width=..., row=...)` statement.
- [x] Implement deterministic per-limb 4-stage lowering (`SADD`, `LAND`, `SWI`, `SRT`) with explicit bounds checks.
- [x] Add parser/handler/builder/issue tests and language docs.

Evidence:

- Tests: `tests/issues/feat-02-carry-chain.test.ts`, `tests/compiler-api.collective-builders.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`.
- Docs: `docs/language/carry-chain-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

### WS-19 — FEAT-16 Pipeline Function Sequencing Macro

Status: `done`  
Completed: `2026-02-13`

Why:

- preserve function-based composition while removing repeated call-tail boilerplate.
- avoid introducing a legacy macro engine by compiling `pipeline(...)` into canonical fn-call statements.

Subtasks:

- [x] Add canonical `pipeline(fnA(...), fnB(...), ...)` statement form.
- [x] Expand pipeline entries into ordered fn-call statements before function lowering.
- [x] Add parser/issue tests, LSP keyword completion coverage, and language docs.

Evidence:

- Tests: `tests/issues/feat-16-pipeline.test.ts`, `tests/compiler-front.parser-modules.test.ts`, `tests/lsp.contract.test.ts`.
- Docs: `docs/language/pipeline-statement.md`, `docs/language/grammar.md`, `docs/language/language-spec.md`, `docs/feature-parity-matrix.md`.

## FEAT Portfolio (1..17)

This section is the canonical roadmap projection for every `FEAT-*` item from `ISSUES_SBOX_K7_PORT.md`.

| FEAT | Scope | Status | Evidence | Next subtask |
|---|---|---|---|---|
| FEAT-1 `latency_hide` | scheduling/optimizer | `pending-backlog` | proposal only | Define scheduler contract and stall-slot legality model for NxM + neighbor hazards. |
| FEAT-2 `carry_chain` | arithmetic primitive | `resolved-verified` | `tests/issues/feat-02-carry-chain.test.ts` | Keep per-limb stage order deterministic and explicit; extend only with contract-backed scheduling variants. |
| FEAT-3 `specialize` | compile-time optimization | `resolved-verified` | `tests/issues/feat-03-specialize.test.ts` | Extend identity catalog conservatively and keep deterministic rewrites. |
| FEAT-4 `for` inside `cycle` | language core | `resolved-verified` | `tests/compiler-api.contract.test.ts`, `tests/issues/resolved-and-legacy.test.ts` | Keep regression guardrails for collision diagnostics and nested expansion. |
| FEAT-5 `normalize` | arithmetic primitive | `resolved-verified` | `tests/issues/feat-05-normalize.test.ts` | Extend with optional multi-lane orchestration only when deterministic cost model is defined. |
| FEAT-6 `triangle` | spatial pattern | `resolved-verified` | `tests/issues/feat-06-triangle.test.ts` | Keep deterministic row-major expansion and NxM coverage checks. |
| FEAT-7 `broadcast` implementation | advanced statement | `resolved-verified` | advanced statement coverage in `tests/compiler-api.contract.test.ts` | Extend benchmarks for route-vs-memory cost decisions (optional optimization track). |
| FEAT-8 range coordinates | language core | `resolved-verified` | `tests/issues/feat-08-range-coordinates.test.ts` | Keep contract tests for descending/rectangular and unresolved-axis diagnostics. |
| FEAT-9 inline operand arithmetic | desugar pass | `resolved-verified` | `tests/issues/feat-09-inline-arithmetic.test.ts` | Keep folding deterministic and side-effect free; extend with additional safe operators as needed. |
| FEAT-10 `stash` | scheduling/lifetime | `pending-backlog` | proposal only | Define spill-vs-route decision model and artifact visibility in compile stats. |
| FEAT-11 `extract_bytes(axis)` | language abstraction | `resolved-verified` | `tests/issues/feat-11-extract-bytes.test.ts` | Extend only with semantically explicit variants (no hidden control-flow or implicit routing). |
| FEAT-12 `collect` | lane pattern | `resolved-verified` | `tests/issues/feat-12-collect.test.ts` | Extend to multi-hop path synthesis only if deterministic cost model is documented. |
| FEAT-13 `accumulate` | domain pattern | `resolved-verified` | `tests/issues/feat-13-accumulate.test.ts` | Extend only with explicit additional patterns that preserve deterministic stage ordering and diagnostics. |
| FEAT-14 `conditional_sub` | domain primitive | `resolved-verified` | `tests/issues/feat-14-conditional-sub.test.ts` | Keep branchless two-stage contract stable (`SSUB`, `BSFA`) with explicit spatial targeting semantics. |
| FEAT-15 row auto-broadcast | syntax sugar | `resolved-verified` | `tests/issues/feat-15-row-auto-broadcast.test.ts` | Keep NxM and segmented-row regressions to preserve deterministic lowering. |
| FEAT-16 pipeline macro | abstraction/tooling | `resolved-verified` | `tests/issues/feat-16-pipeline.test.ts` | Keep pipeline entries restricted to canonical function calls and preserve ordered expansion semantics. |
| FEAT-17 guard condition | syntax/pattern | `resolved-verified` | `tests/issues/feat-17-guard-condition.test.ts` | Keep predicate evaluation deterministic and bounded to canonical spatial symbols. |

### FEAT Backlog Execution Blocks

#### Block A — Compiler Optimization Track

Status: `pending`

Subtasks:

- [ ] FEAT-1 scheduler RFC + legality checker.
- [ ] FEAT-10 lifetime/stash cost model draft.
- [ ] Extend FEAT-3 beyond identity set only when semantic proofs are documented.

#### Block B — Canonical Language Ergonomics Track

Status: `done`

Subtasks:

- [x] FEAT-5 grammar + lowering spec.

#### Block C — Domain Abstraction Track

Status: `done`

Subtasks:

- [x] FEAT-16 macro/tooling boundary decision: canonical in-core function-sequence expansion.
- [x] Contract tests added before acceptance (`tests/issues/feat-16-pipeline.test.ts` + parser/lsp contracts).

## Remaining Work (Backlog, Non-Blocking for Issue Closure)

These items are not open defects; they are optimization/feature proposals from `ISSUES_SBOX_K7_PORT.md`.

### BK-01 — Performance-Oriented Proposals

Status: `pending-backlog`

Subtasks:

- [ ] Prioritize `OPT-A`, `OPT-B`, `OPT-C` by measurable cycle/latency impact.
- [ ] Define benchmark corpus and acceptance thresholds.
- [ ] Convert selected proposal(s) into ADR + implementation plan.

Why pending:

- they require algorithm/scheduler research and are outside correctness closure.

### BK-02 — Extended Language Ergonomics

Status: `pending-backlog`

Subtasks:

- [ ] Prioritize `FEAT-1`, `FEAT-10`.
- [ ] Define canonical grammar impact and diagnostic strategy.
- [ ] Ship only features with strict contracts and deterministic lowering.

Why pending:

- these are additive language design tracks, not bug fixes.

## Update Protocol

For every new issue or closure:

1. Update `docs/issue-status-matrix.md` first (status + evidence).
2. Add or update regression tests in `tests/issues/`.
3. Append evidence in this roadmap (workstream + date + rationale).
4. If cross-repo behavior changes, mirror with simulator contract tests.
