# C-like Expression Syntax

[← Coordinate Expressions](coordinate-expressions.md) | [Main Index](../README.md)

---

The compiler supports **C-like register expressions** as syntactic sugar for ISA instructions. Expressions are desugared to standard instructions before parsing, so both syntaxes produce identical CSV output.

## Syntax

```c
dest = operand1 op operand2;
dest = operand;                  // Simple copy (desugars to SADD dest, operand, ZERO)
```

Where:
- `dest` is a register: `R0`, `R1`, `R2`, `R3`, `ROUT`
- `operand` is a register, neighbor, number, or data reference
- `op` is a C-like operator (see table below)

---

## Operator Mapping

| C Operator | ISA Instruction | Example | Description |
|-----------|----------------|---------|-------------|
| `+` | `SADD` | `R1 = R2 + R3` | Signed addition |
| `-` | `SSUB` | `R0 = R1 - 5` | Signed subtraction |
| `*` | `SMUL` | `ROUT = R0 * R2` | Signed multiplication |
| `**` | `FXPMUL` | `R1 = R0 ** R2` | Fixed-point multiplication |
| `<<` | `SLT` | `R1 = R0 << 2` | Shift left |
| `>>` | `SRT` | `R1 = R0 >> 4` | Shift right (logical) |
| `>>>` | `SRA` | `R1 = R0 >>> 1` | Shift right (arithmetic) |
| `&` | `LAND` | `R1 = R0 & 0xFF` | Bitwise AND |
| `\|` | `LOR` | `R1 = R0 \| R2` | Bitwise OR |
| `^` | `LXOR` | `R1 = R0 ^ R2` | Bitwise XOR |
| `~&` | `LNAND` | `R1 = R0 ~& R2` | Bitwise NAND |
| `~\|` | `LNOR` | `R1 = R0 ~\| R2` | Bitwise NOR |
| `~^` | `LXNOR` | `R1 = R0 ~^ R2` | Bitwise XNOR |

---

## Valid Operands

| Type | Examples | Description |
|------|----------|-------------|
| Registers | `R0`, `R1`, `R2`, `R3`, `ROUT`, `ZERO` | Local PE registers |
| Neighbors | `RCR`, `RCL`, `RCT`, `RCB`, `SELF` | Neighbor ROUT values |
| Numbers | `5`, `0xFF`, `42` | Immediate values |
| Data refs | `data[0]`, `myArray[i]` | Memory addresses |
| Constants | `.MY_CONST` | Compile-time constants |
| IMM() | `IMM(i * 2)` | Expressions in immediates |

---

## Example: Before and After

### Assembly syntax (original)

```c
kernel "Assembly" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
    }

    cycle {
        @0,0: SADD R1, R0, R0;
        @0,1: SSUB R1, R0, IMM(5);
    }

    cycle { @0,0: EXIT; }
}
```

### C-like syntax (equivalent)

```c
kernel "CLike" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);  // Assembly for load
        @0,1: SADD R0, ZERO, IMM(20);  // Assembly for load
    }

    cycle {
        @0,0: R1 = R0 + R0;     // SADD R1, R0, R0
        @0,1: R1 = R0 - 5;      // SSUB R1, R0, 5
    }

    cycle { @0,0: EXIT; }
}
```

Both produce **identical CSV output**.

---

## Mixing Syntax

Assembly and C-like expressions can be freely mixed within the same kernel, even within the same cycle block:

```c
cycle {
    @0,0: LWI R0, data[0];     // Assembly (memory ops stay as-is)
    @0,1: R1 = R0 + R2;        // C-like expression
    @0,2: SADD R2, R1, R3;     // Assembly
    @0,3: R3 = R1 & 0xFF;      // C-like expression
}
```

---

## Simple Copy

Assigning without an operator desugars to `SADD dest, src, ZERO`:

```c
@0,0: R1 = R2;     // desugars to: SADD R1, R2, ZERO
@0,0: R0 = RCR;    // desugars to: SADD R0, RCR, ZERO
```

---

## Inside For Loops

C-like expressions work inside for loops with loop variable substitution:

```c
for i in range(4) {
    cycle { @0,0: R0 = R0 + IMM(i); }
}
// Unrolls to:
//   SADD R0, R0, 0
//   SADD R0, R0, 1
//   SADD R0, R0, 2
//   SADD R0, R0, 3
```

---

## Instructions That Stay Assembly-Only

These instructions have no C-like equivalent and must be written in assembly:

| Category | Instructions |
|----------|-------------|
| Memory | `LWI`, `SWI`, `LWD`, `SWD` |
| Branch | `BEQ`, `BNE`, `BLT`, `BGE`, `JUMP` |
| Select | `BSFA`, `BZFA` |
| Control | `NOP`, `EXIT` |
| Debug | `PRINT`, `CHECK`, `ASSERT` |

---

## How It Works

The compiler inserts a **desugaring pass** between the lexer and the parser:

```
Source → Lexer → Tokens → [Desugar] → Tokens' → Parser → AST → CSV
```

The desugarer scans for `REGISTER = OPERAND OP OPERAND ;` patterns inside `cycle { ... }` blocks and rewrites them to `OPCODE REGISTER, OPERAND, OPERAND ;`. The parser never sees the C-like syntax.

---

## Limitations

1. **One operation per statement**: `R0 = R1 + R2 + R3` is NOT supported (would require chaining)
2. **No precedence/parentheses**: Each expression is exactly `dest = op1 OP op2`
3. **Destination must be a register**: `R0`-`R3` or `ROUT` (not `ZERO` or neighbors)
4. **Only inside cycle blocks**: Expressions outside cycles are not desugared
5. **No aliases as destination**: `.alias acc R0` defines an alias, but `acc = R1 + R2;` will NOT be desugared. Use the raw register name (`R0 = R1 + R2;`) or assembly syntax (`SADD acc, R1, R2;`)
6. **`|` in row pipe syntax**: In `row N: ... | ... ;` context, `|` is a column separator. Use `@row,col:` addressing for bitwise OR expressions: `@0,0: R1 = R0 | R2;`

---

## Navigation

- [← Coordinate Expressions](coordinate-expressions.md)
- [Main Index](../README.md)
