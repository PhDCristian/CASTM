# Memory Sugar

Canonical memory sugar is available inside `cycle {}` and lowers to existing `LWI/SWI` ISA forms.

## Target and assumptions

- Snippets use `target "uma-cgra-base";`.
- Address expressions are resolved at compile-time.
- CSV output shown is generated from the linked snippet.

## Supported Forms

- `R3 = A[i];`
- `A[i] = R3;`
- `R3 = [addrExpr];`
- `[addrExpr] = R3;`

## Behavioral Rules

| Rule | Description |
|---|---|
| Load destination | must be a register |
| Store source | must be a register |
| Memory-to-memory | not allowed |
| Addressing | supports 1D, 2D, and raw-address expressions |

## DSL to CSV Example (Matrix)

::: code-group
<<< ../snippets/features/memory-sugar/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/memory-sugar/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/memory-sugar/01-main.csv`.
