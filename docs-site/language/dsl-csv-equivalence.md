# DSL to CSV Equivalence

This page shows representative canonical source snippets and the corresponding emitted CSV patterns.

All CSV blocks are **abridged excerpts** focused on the instructions of interest.

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

```csv [CSV (abridged)]
cycle,row,col,instruction
0,0,0,SADD R2 R0 R1
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

```csv [CSV (abridged)]
cycle,row,col,instruction
0,0,0,LWI R0 4
0,0,1,SWI R0 108
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

```csv [CSV (abridged)]
cycle,row,col,instruction
0,0,1,SADD ROUT R3 ZERO
1,0,0,SADD R1 R1 RCR
```
:::

## 4) Runtime Loop Lowering

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "eq_runtime_for" {
  for R0 in range(0, 3) at @0,0 runtime {
    cycle { at @0,1: R1 = R0 + IMM(1); }
  }
}
```

```csv [CSV (abridged)]
cycle,row,col,instruction
0,0,0,SADD R0 ZERO ZERO
1,0,0,BGE R0 IMM(3) __loop_end
...,0,1,SADD R1 R0 IMM(1)
```
:::

## 5) Scan + Reduce

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "eq_scan_reduce" {
  scan(op=add, src=R0, dest=R2, dir=right, mode=exclusive);
  reduce(op=add, dest=R1, src=R0, axis=row);
}
```

```csv [CSV (abridged)]
cycle,row,col,instruction
...,0,0,SADD R2 ZERO IMM(0)
...,0,1,SADD R2 R0 RCL
...,0,0,SADD R1 R0 ZERO
```
:::

## Notes

- Emission can target `flat-csv` or `sim-matrix-csv` without changing DSL semantics.
- Diagnostic spans and lowering artifacts are available through `compile(..., { emitArtifacts: [...] })`.
