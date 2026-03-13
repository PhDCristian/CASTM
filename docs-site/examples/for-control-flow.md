# Control Flow with For/If/While

Executable canonical patterns for control-flow inside kernels.

## What this demonstrates

- static `for` placement expansion,
- runtime `for` with explicit control PE,
- explicit `if/else` and `while` control headers.

## When to use

Use this page when you need explicit control placement while mixing looping and branching in a single kernel.

## Target and assumptions

- `target base;` is explicit in snippets.
- control-flow placement stays explicit (`at @r,c`).
- CSV shown is generated from source artifacts.

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/for-control-flow/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/for-control-flow/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## 1) Static `for` with spatial coordinates

```castm
target base;
kernel "ex_for_spatial" {
  for i in range(0, 4) {
    bundle { at @0,i: R2 = R0 + 1; }
  }
}
```

## 2) Static `for` with `unroll + collapse`

```castm
target base;
kernel "ex_for_unroll_collapse" {
  for r in range(0, 2) unroll(2) collapse(2) {
    for c in range(0, 2) {
      bundle { at @r,c: R3 = R1 + R2; }
    }
  }
}
```

## 3) Static `for` with nested `if/else`

```castm
target base;
kernel "ex_for_if_else" {
  for i in range(0, 2) {
    if (R0 == 0) at @0,0 {
      bundle { at @0,i: R1 = R1 + 1; }
    } else {
      bundle { at @1,i: R1 = R1 + 2; }
    }
  }
}
```

## 4) Runtime `for` with explicit control PE

```castm
target base;
kernel "ex_for_runtime" {
  for R0 in range(0, 3) at @0,0 runtime {
    bundle { at @0,1: R1 = R0 + 1; }
  }
}
```

## 5) `while` with explicit control PE

```castm
target base;
kernel "ex_while" {
  while (R1 < 3) at @0,0 {
    bundle { at @0,1: R1 = R1 + 1; }
  }
}
```

## 6) Invalid control header (diagnostic)

```castm-fail
// expect-error: E2002
target base;
kernel "ex_bad_if_header" {
  if (R0 == 0) {
    bundle { at @0,1: R1 = R1 + 1; }
  }
}
```

## Why this CSV looks like this

- static loops expand deterministically by iteration order,
- runtime loops emit control-flow instructions at the declared control PE,
- `if/else` and `while` introduce branch cycles tied to explicit control headers.

## Practical rule

- `if`/`while` require explicit control PE (`at @r,c` in the header).
- static `for` and runtime `for` are different constructs; runtime form keeps control explicit.

Full generated CSV: `docs-site/snippets/examples/for-control-flow/01-main.csv`.

## Related features

- [/features/control-flow](/features/control-flow)
- [/features/loops](/features/loops)
- [/features/dynamic-coordinates](/features/dynamic-coordinates)

## Continue

- Next: [/examples/scheduler-modes](/examples/scheduler-modes)
- All examples: [/examples](/examples/index)
