# Accumulate Statement (`accumulate(...)`)

`accumulate(...)` is a canonical advanced statement for deterministic NxM accumulation patterns that are frequently repeated as manual ROUT chains.

## Canonical Syntax

```text
accumulate(pattern=row|col|anti_diagonal, products=R2, accum=R3, out=ROUT[, combine=add|sum|sub|and|or|xor|mul]);
```

Accepted values:

- `pattern`: accumulation topology.
- `products`: source register that holds per-PE product/input values.
- `accum`: intermediate accumulation register.
- `out`: final output register written in the last cycle.
- `combine`: optional combiner opcode selector (default `add`).

## Semantics

Lowering is deterministic and grid-wide:

1. Stage 0: seed `accum` from `products` (`SADD accum, products, ZERO`) on all PEs.
2. Pattern stage(s):
   - `row`: one lane-wise stage using `RCL` (left incoming).
   - `col`: one lane-wise stage using `RCT` (top incoming).
   - `anti_diagonal`: two stages (`RCT` then `RCR`) to create an anti-diagonal wave.
3. Final stage: materialize to `out` (`SADD out, accum, ZERO`) on all PEs.

## Examples

Row accumulation:

```text
accumulate(pattern=row, products=R2, accum=R3, out=ROUT);
```

Column accumulation with bitwise combine:

```text
accumulate(pattern=col, products=R1, accum=R4, out=R5, combine=xor);
```

Anti-diagonal accumulation:

```text
accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
```

## Executable Snippet

```dsl
target "uma-cgra-base";
kernel "accumulate_doc" {
  accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
}
```

## Diagnostics

Malformed statements or unsupported values produce explicit diagnostics:

- parse diagnostics for missing/invalid arguments.
- semantic diagnostics for unsupported combine modes (defensive checks in lowering).

## Verification

Executable contract tests:

- `tests/issues/feat-13-accumulate.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
