# Issue Status Matrix — `ISSUES_SBOX_K7_PORT.md`

This matrix is the operational source of truth for issue triage across compiler, simulator, and docs.

Execution roadmap (tasks/subtasks/timeline): `docs/issue-closure-roadmap.md`.

## Status Legend

- `resolved-verified`: fixed and backed by executable tests.
- `pending-fix`: reproducible defect still open in active scope.
- `canonical-intentional`: behavior differs from historical syntax by design in canonical-only mode.
- `simulator-pending`: compiler behavior is fixed, simulator contract/update still pending.

## Defects and Regressions

| id | ambito | estado | evidencia-test | owner |
|---|---|---|---|---|
| Issue-1 | compiler | resolved-verified | `tests/issues/resolved-core-broadcast-and-loop.test.ts` | openedge-dsl |
| Issue-2 | compiler | resolved-verified | `tests/compiler-api.contract.test.ts` | openedge-dsl |
| Issue-3 | compiler | resolved-verified | `tests/issues/issue-03-multi-statement-cycle-line.test.ts` | openedge-dsl |
| Issue-4 | compiler/docs | canonical-intentional | `tests/issues/resolved-and-legacy.test.ts` (legacy reject) | openedge-dsl |
| Issue-5 | compiler | resolved-verified | `tests/issues/resolved-core-broadcast-and-loop.test.ts` | openedge-dsl |
| Issue-6 | compiler | resolved-verified | `tests/compiler-api.contract.test.ts`, `tests/issues/resolved-and-legacy.test.ts` | openedge-dsl |
| Issue-7 | compiler/docs | canonical-intentional | `tests/compiler-api.contract.test.ts` (legacy pragma rejection) | openedge-dsl |
| Issue-8 | compiler/docs | canonical-intentional | `tests/compiler-api.contract.test.ts` (legacy pragma rejection) | openedge-dsl |
| Issue-9 | compiler | resolved-verified | `tests/issues/resolved-core-broadcast-and-loop.test.ts` | openedge-dsl |
| Issue-10 | compiler | resolved-verified | `tests/issues/resolved-core-broadcast-and-loop.test.ts` | openedge-dsl |
| Issue-11 | compiler/docs | canonical-intentional | language policy + legacy pragma rejection tests | openedge-dsl |
| Issue-12 | compiler | resolved-verified | `tests/compiler-api.contract.test.ts` | openedge-dsl |
| BUG-1 | compiler | resolved-verified | `tests/issues/resolved-core-broadcast-and-loop.test.ts` | openedge-dsl |
| BUG-2 | compiler | resolved-verified | `tests/compiler-api.contract.test.ts`, `tests/issues/issue-03-multi-statement-cycle-line.test.ts` | openedge-dsl |
| BUG-3 | simulator | resolved-verified | `UMA-CGRA-Simulator/src/__tests__/dsl-compiler-v2-adapter.test.ts` | uma-simulator |
| BUG-4 | simulator | resolved-verified | `UMA-CGRA-Simulator/src/__tests__/dsl-compiler-v2-adapter.test.ts` | uma-simulator |
| BUG-5 | simulator | resolved-verified | simulator imports `@openedge/*` packages (no stale `libs/OpenEdgeDSL`) | uma-simulator |
| BUG-6 | compiler | resolved-verified | `tests/issues/resolved-and-legacy.test.ts` | openedge-dsl |
| BUG-7 | compiler | resolved-verified | `tests/issues/bug-07-computed-loop-coords.test.ts` | openedge-dsl |
| BUG-8 | compiler | resolved-verified | `tests/issues/bug-08-route-order.test.ts` | openedge-dsl |
| BUG-9 | compiler | resolved-verified | `tests/issues/issue-03-multi-statement-cycle-line.test.ts` | openedge-dsl |
| REG-1 | compiler/docs | canonical-intentional | canonical route/control syntax; computed coords restored by BUG-7 fix | openedge-dsl |
| REG-2 | compiler/docs | canonical-intentional | canonical `at row/col/all` replaces row-pipe syntax | openedge-dsl |
| REG-3 | compiler/docs | canonical-intentional | canonical cycle block style + per-placement statements | openedge-dsl |
| REG-4 | compiler | resolved-verified | `tests/issues/bug-08-route-order.test.ts` + route contracts | openedge-dsl |
| REG-5 | compiler | resolved-verified | `tests/issues/resolved-and-legacy.test.ts` | openedge-dsl |
| REG-6 | compiler/docs | canonical-intentional | `_` placeholder is legacy pipe-era syntax | openedge-dsl |
| REG-7 | compiler | resolved-verified | config parsing path in structured parser + contract tests | openedge-dsl |
| REG-8 | compiler | resolved-verified | BUG-7 fixed, manual-unroll bug surface reduced | openedge-dsl |

## Optimization / Feature Proposals (Backlog)

These IDs are proposal/backlog items, not active correctness defects in canonical scope.

| id | ambito | estado | evidencia-test | owner |
|---|---|---|---|---|
| OPT-A | compiler | canonical-intentional | proposal only | backlog |
| OPT-B | compiler | canonical-intentional | proposal only | backlog |
| OPT-C | compiler | canonical-intentional | proposal only | backlog |
| OPT-D | compiler | resolved-verified | `tests/compiler-api.contract.test.ts`, `tests/issues/resolved-and-legacy.test.ts` | openedge-dsl |
| OPT-E | simulator/algo | canonical-intentional | algorithmic optimization (outside compiler correctness scope) | backlog |
| OPT-F | simulator/algo | canonical-intentional | algorithmic optimization (outside compiler correctness scope) | backlog |
| OPT-G | simulator/algo | canonical-intentional | algorithmic optimization (outside compiler correctness scope) | backlog |
| FEAT-1 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-2 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-3 | compiler | resolved-verified | `tests/issues/feat-03-specialize.test.ts` | openedge-dsl |
| FEAT-4 | compiler | resolved-verified | `tests/compiler-api.contract.test.ts`, `tests/issues/resolved-and-legacy.test.ts` | openedge-dsl |
| FEAT-5 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-6 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-7 | compiler | resolved-verified | advanced statement coverage in `tests/compiler-api.contract.test.ts` | openedge-dsl |
| FEAT-8 | compiler | resolved-verified | `tests/issues/feat-08-range-coordinates.test.ts` | openedge-dsl |
| FEAT-9 | compiler | resolved-verified | `tests/issues/feat-09-inline-arithmetic.test.ts` | openedge-dsl |
| FEAT-10 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-11 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-12 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-13 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-14 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-15 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-16 | compiler | canonical-intentional | proposal only | backlog |
| FEAT-17 | compiler | canonical-intentional | proposal only | backlog |
