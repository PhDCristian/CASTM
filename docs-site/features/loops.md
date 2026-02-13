# Loops

OpenEdgeDSL supports compile-time and runtime `for` loops.

## Compile-Time Loop

```openedge
target "uma-cgra-base";
kernel "for_static" {
  for i in range(0, 4) {
    cycle { @0,i: NOP; }
  }
}
```

## Runtime Loop

```openedge
target "uma-cgra-base";
kernel "for_runtime" {
  for R0 in range(0, 3) at @0,0 runtime {
    cycle { at @0,1: R1 = R0 + IMM(1); }
  }
}
```

## Notes

- Runtime loops require a register loop variable and control location.
- Compile-time loops support computed spatial expressions inside `cycle`.
