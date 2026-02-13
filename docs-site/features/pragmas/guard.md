# `std::guard(...)`

Predicate-driven spatial activation for one canonical instruction template.

## Syntax

```text
std::guard(cond=<boolean-expr>, op=OPCODE, dest=RD, srcA=RA, srcB=RB);
```

## Predicate Variables

- `row`, `col`
- `idx` (`row * cols + col`)
- `rows`, `cols`

Supported operators include arithmetic (`+ - * / %`) and comparators (`== != < <= > >=`).

## Semantics

- compile-time predicate evaluation per PE
- deterministic row-major placement emission
- non-matching PEs are omitted

## Executable Example

```openedge
target "uma-cgra-base";
kernel "guard_doc" {
  std::guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
"SMUL R2, R0, R1","SMUL R2, R0, R1","SMUL R2, R0, R1","SMUL R2, R0, R1"
NOP,"SMUL R2, R0, R1","SMUL R2, R0, R1","SMUL R2, R0, R1"
NOP,NOP,"SMUL R2, R0, R1","SMUL R2, R0, R1"
NOP,NOP,NOP,"SMUL R2, R0, R1"
```

## Diagnostics

Invalid predicates or malformed argument sets produce explicit diagnostics with source spans.
