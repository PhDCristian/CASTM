# Instruction Set

OpenEdgeDSL lowers to the ISA catalog in `packages/lang-spec/src/instruction-set.json`.

## Registers and Neighbor Inputs (default profile)

| Class | Values |
|---|---|
| General registers | `R0`, `R1`, `R2`, `R3` |
| Special registers | `ROUT`, `ZERO` |
| Neighbor inputs | `SELF`, `RCL`, `RCR`, `RCT`, `RCB`, `PREV` |

## Opcode Families

| Family | Opcodes |
|---|---|
| Control | `NOP`, `EXIT`, `BSFA`, `BZFA` |
| Branch | `BEQ`, `BNE`, `BLT`, `BGE`, `JUMP` |
| Arithmetic | `SADD`, `SSUB`, `SMUL`, `FXPMUL` |
| Logic | `LAND`, `LNAND`, `LOR`, `LNOR`, `LXOR`, `LXNOR` |
| Shift | `SLT`, `SRT`, `SRA` |
| Memory | `LWI`, `SWI`, `LWD`, `SWD` |

## Canonical Lowering Examples

- `R2 = R0 + R1;` -> `SADD R2, R0, R1`
- `R0 = A[i];` -> `LWI R0, <resolved-address>`
- `A[i] = R0;` -> `SWI R0, <resolved-address>`

For full side-by-side examples, see [DSL to CSV Equivalence](/language/dsl-csv-equivalence).
