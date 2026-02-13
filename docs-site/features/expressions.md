# Expressions

OpenEdgeDSL supports C-like assignment expressions in cycle placements.

## Supported Forms

- `R2 = R0 + R1;`
- `R2 = R0 - IMM(1);`
- `R2 = R0 << 2;`
- `R2 = R0 >> 8;`
- `R2 = R0 & MASK;`

Expressions are lowered to ISA opcodes (`SADD`, `SSUB`, `SLT`, `SRT`, `LAND`, ...).

## Inline Arithmetic in Operands

Resolvable arithmetic in operands is folded at compile time.

```openedge
target "uma-cgra-base";
kernel "expr" {
  cycle {
    at @0,0: SRT R1, R0, IMM((2+3)*2);
    at @0,1: LWI R2, 360 + 2*4;
  }
}
```

## Notes

- Non-resolvable symbolic expressions are preserved when legal for the target lowering stage.
- Diagnostics are emitted for invalid expression shapes.
