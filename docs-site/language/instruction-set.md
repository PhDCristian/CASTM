# Instruction Set

CASTM lowers to the ISA catalog in `packages/lang-spec/src/instruction-set.json`.

## Target and assumptions

- Target profile examples assume `target base;`.
- Register/opcode availability is profile-dependent; this page reflects current base profile.
- CSV shown is generated from executable snippets.

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
- `goto L0;` -> `JUMP ZERO, L0` (canonical operand order is `pred, label`)

## Executable ISA sample (CASTM ↔ CSV)

::: code-group
<<< ../snippets/language/instruction-set/01-main.castm{castm} [CASTM]
<<< ../snippets/language/instruction-set/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/instruction-set/01-main.csv`.

For full side-by-side examples, see [DSL to CSV Equivalence](/language/dsl-csv-equivalence).
