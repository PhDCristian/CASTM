# Loop Composition Patterns

This page focuses on canonical loop composition for useful parallel work on a 4x4 grid.

## Canonical Patterns

```text
for i in range(0, N) { ... }                  // static expansion
for i in range(0, N) unroll(k) { ... }        // static strategy hint
for i in range(0, N) collapse(n) { ... }      // static nested-loop flattening
for R0 in range(0, N) at @r,c runtime { ... } // runtime-controlled loop
pipeline(stageA(), stageB(R0), stageC(R1));   // staged composition
```

## Recommended Usage

- Prefer static loops (`for i in range(...)`) when ranges are compile-time known.
- Use `collapse(n)` for perfectly nested static loops to express deterministic row-major mapping.
- Use runtime loops only when bounds/control must be hardware-driven.
- Combine with `std::latency_hide(window=...)` only after correctness is stable.

## DSL to CSV Example (Matrix)

```openedge
target "uma-cgra-base";
kernel "parallel_patterns_doc" {
  for i in range(0, 4) unroll(2) {
    cycle { at @0,i: R2 = R0 + 1; }
  }
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R2, R0, 1",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
NOP,"SADD R2, R0, 1",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
NOP,NOP,"SADD R2, R0, 1",NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
NOP,NOP,NOP,"SADD R2, R0, 1"
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```

`NOP` cells above are matrix-format placeholders for empty PEs in that cycle, not injected scheduling barriers.
