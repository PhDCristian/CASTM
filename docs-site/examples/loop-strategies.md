# Loops: Unroll and Collapse

This page shows canonical loop strategy modifiers for static loops.

## 1) Static baseline loop

::: code-group
<<< ./artifacts/loop-strategies.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/loop-strategies.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## 2) Static `unroll(2)`

```openedge
target "uma-cgra-base";
kernel "ex_loop_unroll" {
  for i in range(0, 4) unroll(2) {
    cycle { at @0,i: R2 = R0 + 1; }
  }
}
```

## 3) Static `collapse(2)` row-major

```openedge
target "uma-cgra-base";
kernel "ex_loop_collapse" {
  for r in range(0, 2) collapse(2) {
    for c in range(0, 2) {
      cycle { at @r,c: R3 = R1 + R2; }
    }
  }
}
```

## 4) Static combined `unroll + collapse`

```openedge
target "uma-cgra-base";
kernel "ex_loop_combo" {
  for r in range(0, 2) unroll(2) collapse(2) {
    for c in range(0, 2) {
      cycle { at @r,c: R3 = R1 + R2; }
    }
  }
}
```

## 5) Runtime loop with explicit control PE (no static modifiers)

```openedge
target "uma-cgra-base";
kernel "ex_loop_runtime" {
  for R0 in range(0, 3) at @0,0 runtime {
    cycle { at @0,1: R1 = R0 + 1; }
  }
}
```

## 6) Runtime invalid with static modifiers

```openedge-fail
// expect-error: E2002
target "uma-cgra-base";
kernel "ex_loop_runtime_invalid" {
  for R0 in range(0, 3) at @0,0 runtime unroll(2) {
    cycle { at @0,1: R1 = R0 + 1; }
  }
}
```

## Practical rule

- use `unroll(k)` when you want wider static expansion chunks.
- use `collapse(n)` for perfectly nested static loops.
- runtime loops are explicit and do not accept static modifiers.

Full generated CSV: `docs-site/examples/artifacts/loop-strategies.csv`.
