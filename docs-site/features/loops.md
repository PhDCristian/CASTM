# Loops

OpenEdgeDSL supports static and runtime `for` loops with explicit canonical syntax.

## Static `for`

```openedge
target "uma-cgra-base";
kernel "for_static" {
  for i in range(0, 4) {
    cycle { @0,i: R2 = R0 + 1; }
  }
}
```

## Static `for` with strategy modifiers

```openedge
target "uma-cgra-base";
kernel "for_static_modifiers" {
  for i in range(0, 4) unroll(2) {
    cycle { @0,i: R2 = R0 + 1; }
  }

  for r in range(0, 2) collapse(2) {
    for c in range(0, 2) {
      cycle { @r,c: R3 = R1 + R2; }
    }
  }
}
```

## Static `for` with combined strategy

```openedge
target "uma-cgra-base";
kernel "for_static_combo" {
  for r in range(0, 2) unroll(2) collapse(2) {
    for c in range(0, 2) {
      cycle { at @r,c: R3 = R1 + R2; }
    }
  }
}
```

## Runtime `for`

```openedge
target "uma-cgra-base";
kernel "for_runtime" {
  for R0 in range(0, 3) at @0,0 runtime {
    cycle { at @0,1: R1 = R0 + 1; }
  }
}
```

## Notes

- `unroll(k)` and `collapse(n)` are static-only loop modifiers.
- `collapse(n)` currently requires perfectly nested static loops and lowers in deterministic row-major order.
- Runtime loops require a register loop variable and explicit control location.

## Invalid Loop Modifier Examples

```openedge-fail
// expect-error: E2002
target "uma-cgra-base";
kernel "invalid_runtime_collapse" {
  for R0 in range(0, 4) at @0,0 runtime collapse(2) {
    cycle { at @0,1: R1 = R0 + 1; }
  }
}
```

```openedge-fail
// expect-error: E2002
target "uma-cgra-base";
kernel "invalid_collapse_depth" {
  for i in range(0, 4) collapse(2) {
    cycle { at @0,i: NOP; }
  }
}
```

```openedge-fail
// expect-error: E2002
target "uma-cgra-base";
kernel "invalid_cycle_scope_unroll" {
  cycle {
    for i in range(0, 4) unroll(2) {
      @0,i: NOP;
    }
  }
}
```

```openedge-fail
// expect-error: E2002
target "uma-cgra-base";
kernel "invalid_unroll_zero" {
  for i in range(0, 4) unroll(0) {
    cycle { at @0,i: NOP; }
  }
}
```
