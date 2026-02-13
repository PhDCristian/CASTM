# Conditional Sub Statement (`conditional_sub(...)`)

`conditional_sub(...)` is a canonical advanced statement for branchless conditional subtraction on CGRA lanes.

## Canonical Syntax

```text
conditional_sub(value=R0, sub=R1, dest=R2[, target=all|row(N)|col(N)|point(r,c)]);
```

Accepted values:

- `value`: register holding the candidate value.
- `sub`: register to subtract.
- `dest`: destination register for the final selected value.
- `target`: optional spatial scope; defaults to `all`.

## Semantics

Lowering is deterministic and always emits two stages over the selected placement set:

1. `SSUB dest, value, sub`
2. `BSFA dest, value, dest, SELF`

This keeps selection branchless and explicit.

## Examples

All PEs:

```text
conditional_sub(value=R0, sub=R1, dest=R2);
```

Single row:

```text
conditional_sub(value=R4, sub=R5, dest=R6, target=row(1));
```

Single coordinate:

```text
conditional_sub(value=R7, sub=R1, dest=R0, target=point(1,2));
```

## Executable Snippet

```dsl
target "uma-cgra-base";
kernel "conditional_sub_doc" {
  conditional_sub(value=R0, sub=R1, dest=R2, target=row(1));
}
```

## Diagnostics

- parse diagnostics for malformed statements or invalid target syntax.
- semantic coordinate diagnostics when `target` points outside the configured grid.

## Verification

Executable contract tests:

- `tests/issues/feat-14-conditional-sub.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
