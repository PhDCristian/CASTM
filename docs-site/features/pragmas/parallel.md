# Loop Composition Patterns

This page summarizes canonical loop composition patterns for parallel kernel design.

## Preferred Patterns

- compile-time loops for static expansion:

```text
for i in range(0, 4) {
  cycle { @0,i: NOP; }
}
```

- runtime loops for hardware-controlled iteration:

```text
for R0 in range(0, 8) at @0,0 runtime {
  cycle { at @0,1: R1 = R0 + IMM(1); }
}
```

- staged function composition:

```text
pipeline(stage_a(), stage_b(R0), stage_c(R1));
```

## Notes

- keep loop intent explicit in source.
- combine with `latency_hide(...)` when conservative compaction is desired.
