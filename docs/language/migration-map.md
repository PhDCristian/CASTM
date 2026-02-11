# OpenEdgeDSL Canonical Migration Map (Private)

## Declarations

| Legacy | Canonical |
|---|---|
| `.const MASK 0xFFFF` | `let MASK = 0xFFFF;` |
| `.alias acc = R1` | `let acc = R1;` |
| `.data input { 1, 2, 3 }` | `let input = { 1, 2, 3 };` |
| `.data output 100 { 0, 0, 0 }` | `let output @100 = { 0, 0, 0 };` |
| `.data2d M[2][2] { 1,2,3,4 }` | `let M[2][2] = { 1,2,3,4 };` |

## Advanced Statements

| Legacy | Canonical |
|---|---|
| `#pragma route @0,1 -> @0,0 payload(R3) accum(R1)` | `route(@0,1 -> @0,0, payload=R3, accum=R1);` |
| `#pragma reduce(sum, R1, R0, axis=row)` | `reduce(op=sum, dest=R1, src=R0, axis=row);` |
| `#pragma scan(add, R0, R1, right, exclusive)` | `scan(op=add, src=R0, dest=R1, dir=right, mode=exclusive);` |

## Control-flow

| Legacy | Canonical |
|---|---|
| `if (R0 == IMM(0)) @0,0 { ... }` | `if (R0 == IMM(0)) at @0,0 { ... }` |
| `while (R1 < IMM(10)) @0,0 { ... }` | `while (R1 < IMM(10)) at @0,0 { ... }` |
| `#pragma no_unroll` + `for R0 in range(...) @0,0 { ... }` | `for R0 in range(...) at @0,0 runtime { ... }` |

## Spatial namespace

| Legacy | Canonical |
|---|---|
| `row 1: NOP;` | `at row 1: NOP;` |
| `col 2: R3 = R1;` | `at col 2: R3 = R1;` |
| `all: NOP;` | `at all: NOP;` |

## Migration Tooling

The core compiler/CLI/LSP are canonical-only and do not ship a legacy migration mode.
If bulk rewriting is needed, run an external migration tool outside the core package set.
