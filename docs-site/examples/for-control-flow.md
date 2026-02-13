# For + Control-Flow Patterns

Executable canonical patterns combining `for`, `if/else`, and `while`.

## 1) Static `for` with spatial coordinates

```openedge
target "uma-cgra-base";
kernel "ex_for_spatial" {
  for i in range(0, 4) {
    cycle { at @0,i: R2 = R0 + 1; }
  }
}
```

## 2) Static `for` with `unroll + collapse`

```openedge
target "uma-cgra-base";
kernel "ex_for_unroll_collapse" {
  for r in range(0, 2) unroll(2) collapse(2) {
    for c in range(0, 2) {
      cycle { at @r,c: R3 = R1 + R2; }
    }
  }
}
```

## 3) Static `for` with nested `if/else`

```openedge
target "uma-cgra-base";
kernel "ex_for_if_else" {
  for i in range(0, 2) {
    if (R0 == 0) at @0,0 {
      cycle { at @0,i: R1 = R1 + 1; }
    } else {
      cycle { at @1,i: R1 = R1 + 2; }
    }
  }
}
```

## 4) Runtime `for` with explicit control PE

```openedge
target "uma-cgra-base";
kernel "ex_for_runtime" {
  for R0 in range(0, 3) at @0,0 runtime {
    cycle { at @0,1: R1 = R0 + 1; }
  }
}
```

## 5) `while` with explicit control PE

```openedge
target "uma-cgra-base";
kernel "ex_while" {
  while (R1 < 3) at @0,0 {
    cycle { at @0,1: R1 = R1 + 1; }
  }
}
```

## 6) Invalid control header (diagnostic)

```openedge-fail
// expect-error: E2002
target "uma-cgra-base";
kernel "ex_bad_if_header" {
  if (R0 == 0) {
    cycle { at @0,1: R1 = R1 + 1; }
  }
}
```
