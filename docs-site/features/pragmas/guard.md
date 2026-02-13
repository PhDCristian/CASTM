# `guard(...)`

Predicate-driven spatial activation for one canonical instruction template.

## Syntax

```text
guard(cond=<boolean-expr>, op=OPCODE, dest=RD, srcA=RA, srcB=RB);
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
  guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
```

## Diagnostics

Invalid predicates or malformed argument sets produce explicit diagnostics with source spans.
