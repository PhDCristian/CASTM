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
  route(@0,1 -> @0,0, payload=R3, accum=R1);
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
    cycle { at @0,1: R1 = R0 + IMM(1); }
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
"BGE R0, IMM(3), __loop_end",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
NOP,"SADD R1, R0, IMM(1)",NOP,NOP
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
  scan(op=add, src=R0, dest=R2, dir=right, mode=exclusive);
  reduce(op=add, dest=R1, src=R0, axis=row);
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R2, ZERO, IMM(0)","SADD R2, R0, RCL",...,...
...,...,...,...
...,...,...,...
...,...,...,...
1,,,
"SADD R1, R0, ZERO","SADD R1, R1, RCL",...,...
...,...,...,...
...,...,...,...
...,...,...,...
```
:::

## Output Modes

- `flat-csv`: instruction list by `(cycle,row,col)`
- `sim-matrix-csv`: matrix per cycle (shown above)

Use `openedge emit --format sim-matrix-csv` for simulator-oriented output.
