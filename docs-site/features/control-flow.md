# Control Flow

Control-flow in canonical OpenEdgeDSL is explicit and spatial:

- `if (...) at @row,col { ... } else { ... }`
- `while (...) at @row,col { ... }`

The `at @row,col` location is the control PE where branch instructions are emitted.

## If-Else {#if-else}

```openedge
target "uma-cgra-base";
kernel "if_else_basic" {
  if (R0 == 0) at @0,0 {
    cycle { at @0,1: R1 = R1 + 1; }
  } else {
    cycle { at @0,1: R1 = R1 + 2; }
  }
}
```

## For + If-Else Composition

```openedge
target "uma-cgra-base";
kernel "if_else_in_for" {
  for i in range(0, 2) {
    if (R0 == 0) at @0,0 {
      cycle { at @0,i: R1 = R1 + 1; }
    } else {
      cycle { at @1,i: R1 = R1 + 2; }
    }
  }
}
```

## While

```openedge
target "uma-cgra-base";
kernel "while_loop" {
  while (R1 < 3) at @0,0 {
    cycle { at @0,1: R1 = R1 + 1; }
  }
}
```

## Invalid Headers (diagnostics)

```openedge-fail
// expect-error: E2002
target "uma-cgra-base";
kernel "bad_if_header" {
  if (R0 == 0) {
    cycle { at @0,1: R1 = R1 + 1; }
  }
}
```

```openedge-fail
// expect-error: E2002
target "uma-cgra-base";
kernel "bad_while_control" {
  while (R0 < 3) at @x,0 {
    cycle { at @0,1: R0 = R0 + 1; }
  }
}
```

## Notes

- `else` does not take its own control location; it pairs with the preceding `if (...) at @...`.
- control coordinates are explicit integer literals (decimal or hex).
- lowering emits deterministic branch labels/cycles from these canonical headers.
