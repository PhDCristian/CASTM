# Compiler Contracts

This document defines the stable I/O contract between compiler stages.

## Stage 1: Parse

- Input: `source: string`
- Output: `StructuredProgramAst`
- Errors: `E2xxx` parse diagnostics with `span`

## Stage 2: Semantic

- Input: `StructuredProgramAst`
- Output: semantically validated `StructuredProgramAst`
- Artifacts: symbol table seed (`constants`, `aliases`, declared data symbols)
- Errors: duplicate symbols, invalid identifiers, unresolved references

## Stage 3: Expand

- Input: validated `StructuredProgramAst`
- Output: `AstProgram` (flat cycles)
- Rules:
  - `for`, `if`, `while`, function calls are lowered outside parser
  - cycle conflict checks happen here

## Stage 4: Desugar + Advanced Lowering

- Input: `AstProgram`
- Output: `AstProgram`
- Rules:
  - memory sugar lowers to `LWI/SWI`
  - expression sugar lowers to ISA instructions
  - advanced statements lower to cycle-level operations

## Stage 5: Resolve + Validate Grid

- Input: lowered `AstProgram`
- Output: `HirProgram`
- Rules:
  - label resolution is complete
  - PE placement is validated against `GridSpec`

## Stage 6: MIR/LIR + Emit

- Input: `HirProgram`
- Output: `MirProgram` -> `LirProgram` -> CSV
- Supported emit formats:
  - `flat-csv`
  - `sim-matrix-csv`

## Determinism

- Stage outputs are deterministic for the same source/options.
- Contract tests snapshot:
  - `structuredAst`
  - `ast`
  - `hir`
  - `mir`
  - `lir`
  - `csv`
