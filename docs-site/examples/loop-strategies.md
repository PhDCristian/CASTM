# Loops: Unroll and Collapse

## What this demonstrates

- static loop expansion controls (`unroll`, `collapse`),
- deterministic row-major flattening for nested static loops,
- explicit separation between static strategies and runtime loops.

## When to use

Use this when a loop is compile-time resolvable and you want predictable expansion shape with less source boilerplate.

## Target and assumptions

- Snippets use `target base;`.
- `unroll(k)` and `collapse(n)` apply to static loops.
- CSV is generated from the executable snippet.

## CASTM ↔ CSV

## 1) Static baseline loop

::: code-group
<<< ../snippets/examples/loop-strategies/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/loop-strategies/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## 2) Static `unroll(2)`

```castm
target base;
kernel "ex_loop_unroll" {
  for i in range(0, 4) unroll(2) {
    bundle { at @0,i: R2 = R0 + 1; }
  }
}
```

## 3) Static `collapse(2)` row-major

```castm
target base;
kernel "ex_loop_collapse" {
  for r in range(0, 2) collapse(2) {
    for c in range(0, 2) {
      bundle { at @r,c: R3 = R1 + R2; }
    }
  }
}
```

## 4) Static combined `unroll + collapse`

```castm
target base;
kernel "ex_loop_combo" {
  for r in range(0, 2) unroll(2) collapse(2) {
    for c in range(0, 2) {
      bundle { at @r,c: R3 = R1 + R2; }
    }
  }
}
```

## 5) Runtime loop with explicit control PE (no static modifiers)

```castm
target base;
kernel "ex_loop_runtime" {
  for R0 in range(0, 3) at @0,0 runtime {
    bundle { at @0,1: R1 = R0 + 1; }
  }
}
```

## 6) Runtime invalid with static modifiers

```castm-fail
// expect-error: E2002
target base;
kernel "ex_loop_runtime_invalid" {
  for R0 in range(0, 3) at @0,0 runtime unroll(2) {
    bundle { at @0,1: R1 = R0 + 1; }
  }
}
```

## Why this CSV looks like this

- `unroll(k)` duplicates static loop bodies in deterministic chunks.
- `collapse(n)` flattens nested static indices in row-major order.
- runtime loops remain explicit control-flow and reject static-only modifiers.

## Practical rule

- use `unroll(k)` when you want wider static expansion chunks.
- use `collapse(n)` for perfectly nested static loops.
- runtime loops are explicit and do not accept static modifiers.

Full generated CSV: `docs-site/snippets/examples/loop-strategies/01-main.csv`.

## Related features

- [/features/loops](/features/loops)
- [/features/pragmas/unroll](/features/pragmas/unroll)
- [/features/pragmas/parallel](/features/pragmas/parallel)

## Continue

- Next: [/examples/for-control-flow](/examples/for-control-flow)
- All examples: [/examples](/examples/index)
