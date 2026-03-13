# Control Flow

Control-flow in canonical CASTM is explicit and spatial (`if/while ... at @r,c`).

## When to use

- Use `if/else` for branch-dependent cycle blocks.
- Use `while` for explicit hardware loop control.
- Use `break`/`continue` inside `while` and runtime `for` bodies for explicit loop exits.
- Keep control PE placement explicit in headers.

## Target and assumptions

- Snippets use `target base;`.
- `if`/`while` require `at @row,col` in header.
- CSV shown is generated from snippets.

## Case A — `if` with explicit control PE

::: code-group
<<< ../snippets/features/control-flow/01-if.castm{castm} [CASTM]
<<< ../snippets/features/control-flow/01-if.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/control-flow/01-if.csv`.

## Case B — `if/else`

::: code-group
<<< ../snippets/features/control-flow/02-if-else.castm{castm} [CASTM]
<<< ../snippets/features/control-flow/02-if-else.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/control-flow/02-if-else.csv`.

## Case C — `while`

::: code-group
<<< ../snippets/features/control-flow/03-while.castm{castm} [CASTM]
<<< ../snippets/features/control-flow/03-while.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/control-flow/03-while.csv`.

## Case D — Composition with `for`

::: code-group
<<< ../snippets/features/control-flow/04-for-if.castm{castm} [CASTM]
<<< ../snippets/features/control-flow/04-for-if.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/control-flow/04-for-if.csv`.

## Case E — Short-point placements inside control block

::: code-group
<<< ../snippets/features/control-flow/05-short-point.castm{castm} [CASTM]
<<< ../snippets/features/control-flow/05-short-point.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/control-flow/05-short-point.csv`.

## Case F — Invalid header (missing control location)

<<< ../snippets/features/control-flow/06-invalid.castm{castm-fail} [CASTM fail]

Expected diagnostic: `E2002`.

## Related examples

- [/examples/for-control-flow](/examples/for-control-flow)
- [/examples/loops](/examples/loops)
