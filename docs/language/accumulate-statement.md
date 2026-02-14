# Accumulate Statement (`std::accumulate(...)`)

`std::accumulate(...)` is a canonical advanced statement for deterministic NxM accumulation patterns that are frequently repeated as manual ROUT chains.

## Canonical Syntax

```text
std::accumulate(pattern=row|col|anti_diagonal, products=R2, accum=R3, out=ROUT[, combine=add|sum|sub|and|or|xor|mul][, steps=<int>=1][, scope=all|row(i)|col(j)]);
```

Accepted values:

- `pattern`: accumulation topology.
- `products`: source register that holds per-PE product/input values.
- `accum`: intermediate accumulation register.
- `out`: final output register written in the last cycle.
- `combine`: optional combiner opcode selector (default `add`).
- `steps`: optional number of propagation passes per pattern stage (default `1`).
- `scope`: optional spatial subset (`all` by default).

## Semantics

Lowering is deterministic and grid-wide:

1. Stage 0: seed `accum` from `products` (`SADD accum, products, ZERO`) on all PEs.
2. Pattern stage(s), repeated `steps` times:
   - `row`: one lane-wise stage using `RCL` (left incoming).
   - `col`: one lane-wise stage using `RCT` (top incoming).
   - `anti_diagonal`: two stages (`RCT` then `RCR`) to create an anti-diagonal wave.
3. Final stage: materialize to `out` (`SADD out, accum, ZERO`) on all PEs.

Deterministic optimization:

- If `products == accum`, seed stage is omitted.
- If `accum == out`, final stage is omitted.

Grid-aware limits:

- `row`: `steps <= cols - 1`
- `col`: `steps <= rows - 1`
- `anti_diagonal`: `steps <= max(rows - 1, cols - 1)`

When `steps` exceeds the pattern/grid limit, lowering emits a semantic error.

Scope compatibility:

- `scope=all`: supports all accumulation patterns.
- `scope=row(i)`: supports only `pattern=row`.
- `scope=col(j)`: supports only `pattern=col`.

Out-of-bounds `row(i)` / `col(j)` values emit coordinate diagnostics.

## Examples

Row accumulation:

```text
std::accumulate(pattern=row, products=R2, accum=R3, out=ROUT);
```

Column accumulation with bitwise combine:

```text
std::accumulate(pattern=col, products=R1, accum=R4, out=R5, combine=xor);
```

Anti-diagonal accumulation:

```text
std::accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
```

Row accumulation with deeper propagation:

```text
std::accumulate(pattern=row, products=R1, accum=R4, out=R5, combine=xor, steps=2);
```

Single-row scoped accumulation:

```text
std::accumulate(pattern=row, products=R1, accum=R4, out=R5, scope=row(1));
```

## Executable Snippet

```dsl
target base;
kernel "accumulate_doc" {
  std::accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
}
```

## Diagnostics

Malformed statements or unsupported values produce explicit diagnostics:

- parse diagnostics for missing/invalid arguments.
- semantic diagnostics for unsupported combine modes (defensive checks in lowering).
- semantic diagnostics for `steps` that exceed the selected pattern/grid capacity.

## Verification

Executable contract tests:

- `tests/issues/feat-13-accumulate.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
