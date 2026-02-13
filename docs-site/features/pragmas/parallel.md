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
  cycle { at @0,1: R1 = R0 + 1; }
}
```

- staged function composition:

```text
pipeline(stage_a(), stage_b(R0), stage_c(R1));
```

## Notes

- keep loop intent explicit in source.
- combine with `std::latency_hide(...)` when conservative compaction is desired.

## DSL to CSV Example (Matrix)

```openedge
target "uma-cgra-base";
kernel "parallel_patterns_doc" {
  for i in range(0, 4) {
    cycle { at @0,i: NOP; }
  }

  for R0 in range(0, 2) at @0,0 runtime {
    cycle { at @0,1: R1 = R0 + 1; }
  }
}
```

```csv [CSV matrix excerpt]
0,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
4,,,
"SADD R0, ZERO, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
5,,,
"BGE R0, 2, 7","SADD R3, RCL, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
