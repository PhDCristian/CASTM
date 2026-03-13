# Error Codes

Canonical diagnostics currently exposed by `@castm/compiler-ir`.

## Target and assumptions

- Diagnostic examples are canonical syntax.
- Snippets use `target base;`.
- CSV excerpt is generated from a valid example snippet.

## Parse

- `E2001` Missing target declaration
- `E2002` Invalid syntax
- `E2003` Missing kernel declaration

## Semantic / Lowering

- `E3001` Invalid assignment
- `E3002` Unsupported operation
- `E3003` Coordinate out of bounds
- `E3004` Spatial collision in the same cycle
- `E3005` Unknown opcode
- `E3006` Unknown target profile
- `E3007` Invalid grid specification
- `E3008` Unsupported advanced statement
- `E3009` Unknown label
- `E3010` Duplicate label
- `E3011` Unresolved coordinate expression
- `E3012` Invalid loop control usage
- `E3013` Invalid collect path

## Internal

- `E9001` Unexpected internal state

## Valid compile reference (CASTM ↔ CSV)

::: code-group
<<< ../snippets/reference/error-codes/01-valid.castm{castm} [CASTM]
<<< ../snippets/reference/error-codes/01-valid.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/reference/error-codes/01-valid.csv`.

## Invalid usage reference

<<< ../snippets/reference/error-codes/02-invalid.castm{castm-fail} [CASTM (invalid)]

Expected diagnostic:

- `E3004` Spatial collision in the same cycle
- hint: keep one placement per PE (`row,col`) in each cycle

## Diagnostic Shape

Each diagnostic contains:

- `code`
- `severity`
- `span`
- `message`
- optional `hint`
- optional `hintCode`
