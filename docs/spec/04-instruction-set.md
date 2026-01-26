# Instruction Set & Operands

[← Spatial-Temporal](03-spatial-temporal.md) | [Index](../README.md) | [Next: Compilation →](05-compilation.md)

---

The DSL supports the standard OpenEdgeCGRA ISA.

## Operands

| Type | Examples | Description |
|------|----------|-------------|
| **Registers** | `R0`, `R1`, `R2`, `R3`, `ROUT` | Local registers or defined `.alias` |
| **Neighbors** | `SELF`, `RCL`, `RCR`, `RCT`, `RCB` | Neighbor references |
| **Immediates** | `IMM(<value>)` or just `<value>` | Immediate values |
| **Data References** | `data[<index>]` | Memory address of n-th `.data` value |
| **Constants** | `.const` names | Replaced at compile time |
| **Labels** | Label names | Valid targets for Branch instructions |

### Neighbor References

```
            RCT (Row - 1)
                ↑
  RCL (Col - 1) ← PE → RCR (Col + 1)
                ↓
            RCB (Row + 1)
```

- `SELF`: Current PE's output
- `RCL`: Left neighbor (Column - 1)
- `RCR`: Right neighbor (Column + 1)
- `RCT`: Top neighbor (Row - 1)
- `RCB`: Bottom neighbor (Row + 1)

### Data References

The `data[<index>]` syntax resolves to the memory address of the n-th value defined in `.data` directives.

**Note:** The resolved address uses byte addressing (multiples of 4 for 32-bit words).

**Arithmetic Expressions:** Indices support arithmetic operations (`+`, `-`, `*`, `/`) evaluated at compile time.

```c
.data 0 { 10, 20, 30, 40, 50, 60 }

// Examples:
data[0]       // → Address 0
data[1]       // → Address 4
data[3 + i]   // (where i=0) → Address 12
data[i * 2]   // (where i=2) → Address 16
```

---

## Instruction Categories

### Control

| Instruction | Description |
|-------------|-------------|
| `NOP` | No operation |
| `EXIT` | Terminate execution |

### ALU (Arithmetic)

| Instruction | Syntax | Description |
|-------------|--------|-------------|
| `SADD` | `SADD rd, rs1, rs2` | Signed addition |
| `SSUB` | `SSUB rd, rs1, rs2` | Signed subtraction |
| `SMUL` | `SMUL rd, rs1, rs2` | Signed multiplication |
| `FXPMUL` | `FXPMUL rd, rs1, rs2` | Fixed-point multiplication |

### Logic

| Instruction | Syntax | Description |
|-------------|--------|-------------|
| `LAND` | `LAND rd, rs1, rs2` | Bitwise AND |
| `LOR` | `LOR rd, rs1, rs2` | Bitwise OR |
| `LXOR` | `LXOR rd, rs1, rs2` | Bitwise XOR |
| `LNAND` | `LNAND rd, rs1, rs2` | Bitwise NAND |
| `LNOR` | `LNOR rd, rs1, rs2` | Bitwise NOR |
| `LXNOR` | `LXNOR rd, rs1, rs2` | Bitwise XNOR |

### Shift

| Instruction | Syntax | Description |
|-------------|--------|-------------|
| `SLT` | `SLT rd, rs1, rs2` | Shift left |
| `SRT` | `SRT rd, rs1, rs2` | Shift right (logical) |
| `SRA` | `SRA rd, rs1, rs2` | Shift right (arithmetic) |

### Memory

| Instruction | Syntax | Description |
|-------------|--------|-------------|
| `LWD` | `LWD rd` | Load word direct (uses IO pointer) |
| `SWD` | `SWD rs` | Store word direct (uses IO pointer) |
| `LWI` | `LWI rd, addr` | Load word immediate (absolute address) |
| `SWI` | `SWI rs, addr` | Store word immediate (absolute address) |

### Select

| Instruction | Syntax | Description |
|-------------|--------|-------------|
| `BSFA` | `BSFA rd, rs1, rs2, flagSrc` | Branch select on flag A |
| `BZFA` | `BZFA rd, rs1, rs2, flagSrc` | Branch select on zero flag A |

---

## Branching & Labels

Branch instructions (`BEQ`, `BNE`, `BLT`, `BGE`, `JUMP`) accept a **Label** as the target address. The compiler calculates the absolute address.

| Instruction | Syntax | Condition |
|-------------|--------|-----------|
| `BEQ` | `BEQ rs1, rs2, target` | Branch if equal |
| `BNE` | `BNE rs1, rs2, target` | Branch if not equal |
| `BLT` | `BLT rs1, rs2, target` | Branch if less than |
| `BGE` | `BGE rs1, rs2, target` | Branch if greater or equal |
| `JUMP` | `JUMP rs1, rs2, target` | Unconditional jump |

### Example

```c
// Source
@0,0: BEQ R0, R1, end_loop;

// Compiles to (assuming end_loop is at cycle 15)
// BEQ R0, R1, 15
```

### Forward and Backward Jumps

```c
kernel "FlowControl" {
    config(0xF, 0);

    // Cycle 0: Label 'loop_start'
    loop_start:
    cycle {
        // Forward Branch: Jump to 'cleanup' if R0 == 10
        row 0: BEQ R0, IMM(10), cleanup | _ | _ | _;
    }

    // Cycle 1: Body
    cycle {
        row 0: SADD R0, R0, IMM(1) | _ | _ | _;
        // Backward Branch: Unconditional jump to 'loop_start' (Cycle 0)
        row 1: JUMP ZERO, ZERO, loop_start | _ | _ | _;
    }

    // Cycle 2: Label 'cleanup'
    cleanup:
    cycle {
        @0,0: EXIT;
    }
}
```

---

## Navigation

- [← Spatial-Temporal](03-spatial-temporal.md)
- [Index](../README.md)
- [Next: Compilation →](05-compilation.md)
