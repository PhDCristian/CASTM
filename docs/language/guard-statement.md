# Guard Statement (`std::guard(...)`)

`std::guard(...)` is a canonical advanced statement for predicate-driven spatial activation.

It expands to one cycle containing only placements whose coordinates satisfy a compile-time boolean condition.

## Canonical Syntax

```text
std::guard(cond=<condition>, op=OPCODE, dest=RD, srcA=RA, srcB=RB);
```

Required keys:

- `cond`: spatial predicate expression.
- `op`: opcode identifier.
- `dest`, `srcA`, `srcB`: operand identifiers.

## Predicate Variables

`cond` can use these symbols:

- `row`: current row index.
- `col`: current column index.
- `idx`: linear index (`row * cols + col`).
- `rows`: total row count.
- `cols`: total column count.

Supported operators:

- Arithmetic: `+ - * / %` with parentheses.
- Comparators: `== != < <= > >=`.

## Semantics

- Expansion order is deterministic row-major (`row` first, `col` second).
- Evaluation is done at compile-time for every PE on the active grid.
- Non-matching PEs are omitted from the generated cycle.
- Invalid or unevaluable predicates produce diagnostics.

## Examples

```text
std::guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
std::guard(cond=(idx%2)==0, op=SADD, dest=R3, srcA=R0, srcB=ZERO);
```

## Executable Snippet

```dsl
target base;
kernel "guard_doc" {
  std::guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
```

## Verification

- `tests/issues/feat-17-guard-condition.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
