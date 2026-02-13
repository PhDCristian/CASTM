# Control Flow

Canonical control-flow uses explicit control PE location via `at @r,c`.

## If/Else

```openedge
target "uma-cgra-base";
kernel "if_else" {
  if (R0 == IMM(0)) at @0,0 {
    cycle { at @0,1: R1 = R1 + 1; }
  } else {
    cycle { at @0,1: R1 = R1 + 2; }
  }
}
```

## While

```openedge
target "uma-cgra-base";
kernel "while_loop" {
  while (R1 < IMM(3)) at @0,0 {
    cycle { at @0,1: R1 = R1 + 1; }
  }
}
```

## Notes

- branch instructions are emitted during lowering with resolved labels.
- control placement is explicit and deterministic in generated cycles.
