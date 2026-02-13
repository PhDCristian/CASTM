# Stencil + Guard

Combines neighborhood stencil generation with compile-time guarded activation.

```openedge
target "uma-cgra-base";

kernel "stencil_guard_example" {
  stencil(cross, add, R0, R1);
  guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
  triangle(shape=upper, inclusive=true, op=SADD, dest=R3, srcA=R1, srcB=R2);
}
```
