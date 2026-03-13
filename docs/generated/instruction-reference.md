# CASTM Instruction Reference

| Opcode | Category | Operands | Description |
|---|---|---|---|
| `NOP` | control | - | No operation |
| `EXIT` | control | - | Terminate kernel execution |
| `SADD` | alu | dest, srcA, srcB | Signed add |
| `SSUB` | alu | dest, srcA, srcB | Signed subtract |
| `SMUL` | alu | dest, srcA, srcB | Signed multiply |
| `FXPMUL` | alu | dest, srcA, srcB | Fixed-point multiply |
| `LAND` | logic | dest, srcA, srcB | Bitwise and |
| `LNAND` | logic | dest, srcA, srcB | Bitwise nand |
| `LOR` | logic | dest, srcA, srcB | Bitwise or |
| `LNOR` | logic | dest, srcA, srcB | Bitwise nor |
| `LXOR` | logic | dest, srcA, srcB | Bitwise xor |
| `LXNOR` | logic | dest, srcA, srcB | Bitwise xnor |
| `SLT` | shift | dest, srcA, srcB | Shift left |
| `SRT` | shift | dest, srcA, srcB | Logical shift right |
| `SRA` | shift | dest, srcA, srcB | Arithmetic shift right |
| `LWD` | memory | dest | Load word from stream pointer |
| `SWD` | memory | src | Store word to stream pointer |
| `LWI` | memory | dest, addr | Load word immediate address |
| `SWI` | memory | src, addr | Store word immediate address |
| `BSFA` | control | dest, srcA, srcB, pred | Branch select on sign flag |
| `BZFA` | control | dest, srcA, srcB, pred | Branch select on zero flag |
| `BEQ` | branch | srcA, srcB, label | Branch if equal |
| `BNE` | branch | srcA, srcB, label | Branch if not equal |
| `BLT` | branch | srcA, srcB, label | Branch if less than |
| `BGE` | branch | srcA, srcB, label | Branch if greater/equal |
| `JUMP` | branch | pred, label | Unconditional jump |

## Target Profiles

- `uma-cgra-base` (canonical alias in source: `target base;`): UMA CGRA baseline profile (4x4, torus, wrap)
- `uma-cgra-mesh`: Portable mesh-oriented profile for larger arrays (8x8, mesh, clamp)
