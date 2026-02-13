# DSL to CSV Equivalence

This page maps canonical DSL snippets to the simulator-oriented matrix CSV format (`sim-matrix-csv`).

Format shape:

- cycle header row (for example `0,,,`)
- one row per PE row
- one cell per PE column

## 1) Arithmetic in `cycle`

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "eq_arith" {
  cycle {
    at @0,0: R2 = R0 + R1;
  }
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R2, R0, R1",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
:::

## 2) Memory Sugar

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
let A = { 10, 20, 30, 40 };
let B @100 = { 0, 0, 0, 0 };

kernel "eq_mem" {
  cycle {
    at @0,0: R0 = A[1];
    at @0,1: B[2] = R0;
  }
}
```

```csv [CSV matrix excerpt]
0,,,
"LWI R0, 4","SWI R0, 108",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
:::

## 3) Route Statement

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "eq_route" {
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
}
```

```csv [CSV matrix excerpt]
0,,,
NOP,"SADD ROUT, R3, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
"SADD R1, R1, RCR",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
:::

## 4) Runtime Loop Lowering (Representative)

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "eq_runtime_for" {
  for R0 in range(0, 3) at @0,0 runtime {
    cycle { at @0,1: R1 = R0 + 1; }
  }
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R0, ZERO, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
"BGE R0, 3, 3","SADD R3, RCL, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
"SADD R0, R0, 1","SADD R1, R3, 1","JUMP 1, ZERO",NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
:::

## 5) Scan + Reduce (Representative)

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "eq_scan_reduce" {
  std::scan(op=add, src=R0, dest=R2, dir=right, mode=exclusive);
  std::reduce(op=add, dest=R1, src=R0, axis=row);
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R2, ZERO, 0",NOP,NOP,NOP
"SADD R2, ZERO, 0",NOP,NOP,NOP
"SADD R2, ZERO, 0",NOP,NOP,NOP
"SADD R2, ZERO, 0",NOP,NOP,NOP
1,,,
"SADD ROUT, R0, ZERO",NOP,NOP,NOP
"SADD ROUT, R0, ZERO",NOP,NOP,NOP
"SADD ROUT, R0, ZERO",NOP,NOP,NOP
"SADD ROUT, R0, ZERO",NOP,NOP,NOP
2,,,
NOP,"SADD R2, R2, RCL",NOP,NOP
NOP,"SADD R2, R2, RCL",NOP,NOP
NOP,"SADD R2, R2, RCL",NOP,NOP
NOP,"SADD R2, R2, RCL",NOP,NOP
3,,,
NOP,"SADD ROUT, R2, ZERO",NOP,NOP
NOP,"SADD ROUT, R2, ZERO",NOP,NOP
NOP,"SADD ROUT, R2, ZERO",NOP,NOP
NOP,"SADD ROUT, R2, ZERO",NOP,NOP
```
:::

## 6) Advanced Statements Coverage

All advanced statement pages include an executable `OpenEdgeDSL -> sim-matrix-csv` section with real compiler output.

| Statement | CSV-backed page |
|---|---|
| `std::route(...)` | [/features/pragmas/route](/features/pragmas/route) |
| `std::broadcast(...)` | [/features/pragmas/broadcast](/features/pragmas/broadcast) |
| `std::reduce(...)` | [/features/pragmas/reduce](/features/pragmas/reduce) |
| `std::scan(...)` | [/features/pragmas/scan](/features/pragmas/scan) |
| `std::rotate(...)` / `std::shift(...)` | [/features/pragmas/rotate](/features/pragmas/rotate), [/features/pragmas/shift](/features/pragmas/shift) |
| `std::stencil(...)` / `std::allreduce(...)` | [/features/pragmas/stencil](/features/pragmas/stencil), [/features/pragmas/allreduce](/features/pragmas/allreduce) |
| `std::transpose(...)` / `std::gather(...)` | [/features/pragmas/transpose](/features/pragmas/transpose), [/features/pragmas/gather](/features/pragmas/gather) |
| `std::stream_load/store(...)` | [/features/pragmas/stream](/features/pragmas/stream) |
| `std::accumulate(...)` / `std::carry_chain(...)` | [/features/pragmas/accumulate](/features/pragmas/accumulate), [/features/pragmas/carry-chain](/features/pragmas/carry-chain) |
| `std::conditional_sub(...)` / `std::collect(...)` | [/features/pragmas/conditional-sub](/features/pragmas/conditional-sub), [/features/pragmas/collect](/features/pragmas/collect) |
| `std::normalize(...)` / `std::extract_bytes(...)` | [/features/pragmas/normalize](/features/pragmas/normalize), [/features/pragmas/extract-bytes](/features/pragmas/extract-bytes) |
| `std::guard(...)` / `std::triangle(...)` | [/features/pragmas/guard](/features/pragmas/guard), [/features/pragmas/triangle](/features/pragmas/triangle) |
| `std::latency_hide(...)` / `std::stash(...)` | [/features/pragmas/auto-cycle](/features/pragmas/auto-cycle), [/features/pragmas/stash](/features/pragmas/stash) |
| loop composition helpers | [/features/pragmas/parallel](/features/pragmas/parallel), [/features/pragmas/unroll](/features/pragmas/unroll) |

## Output Modes

- `flat-csv`: instruction list by `(cycle,row,col)`
- `sim-matrix-csv`: matrix per cycle (shown above)

Use `openedge emit --format sim-matrix-csv` for simulator-oriented output.
