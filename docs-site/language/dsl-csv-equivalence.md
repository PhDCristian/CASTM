# DSL to CSV Equivalence

This page maps canonical DSL snippets to simulator-oriented matrix CSV (`sim-matrix-csv`) using generated artifacts.

## Target and assumptions

- Every snippet includes `target base;`.
- CSV is generated automatically from the snippet (never handwritten).
- Matrix layout is `cycle header + 4 PE rows + 4 PE columns`.

## 1) Arithmetic in `cycle`

::: code-group
<<< ../snippets/language/dsl-csv-equivalence/01-arith.castm{castm} [CASTM]
<<< ../snippets/language/dsl-csv-equivalence/01-arith.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/dsl-csv-equivalence/01-arith.csv`.

## 2) Memory sugar

::: code-group
<<< ../snippets/language/dsl-csv-equivalence/02-memory.castm{castm} [CASTM]
<<< ../snippets/language/dsl-csv-equivalence/02-memory.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/dsl-csv-equivalence/02-memory.csv`.

## 3) `std::route(...)`

::: code-group
<<< ../snippets/language/dsl-csv-equivalence/03-route.castm{castm} [CASTM]
<<< ../snippets/language/dsl-csv-equivalence/03-route.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/dsl-csv-equivalence/03-route.csv`.

## 4) Static loop modifiers (`unroll` / `collapse`)

::: code-group
<<< ../snippets/language/dsl-csv-equivalence/04-loop-mods.castm{castm} [CASTM]
<<< ../snippets/language/dsl-csv-equivalence/04-loop-mods.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/dsl-csv-equivalence/04-loop-mods.csv`.

## 5) Runtime `for`

::: code-group
<<< ../snippets/language/dsl-csv-equivalence/05-runtime-for.castm{castm} [CASTM]
<<< ../snippets/language/dsl-csv-equivalence/05-runtime-for.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/dsl-csv-equivalence/05-runtime-for.csv`.

## 6) `std::scan(...)` + `std::reduce(...)`

::: code-group
<<< ../snippets/language/dsl-csv-equivalence/06-scan-reduce.castm{castm} [CASTM]
<<< ../snippets/language/dsl-csv-equivalence/06-scan-reduce.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/dsl-csv-equivalence/06-scan-reduce.csv`.

## Output modes

- `flat-csv`: instruction list by `(cycle,row,col)`.
- `sim-matrix-csv`: matrix per cycle (used in this documentation).

Use:

```bash
castm emit kernel.castm --format sim-matrix-csv -o kernel.csv
```

Matrix note:

- `NOP` cells in matrix CSV represent empty PE slots for that cycle.
- They are not implicit control barriers unless emitted by passes as real instructions.
