# Basic: Load + Add + Store

## What this demonstrates

- canonical `let` declarations,
- memory sugar (`R = A[i]`, `A[i] = R`),
- simple arithmetic lowering (`R2 = R0 + R1`).

## Target and assumptions

- `target "uma-cgra-base";` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## OpenEdgeDSL / CSV

::: code-group
<<< ../snippets/examples/basic/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/basic/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Expected effect

- 2 cycles total.
- Cycle 0 loads two values.
- Cycle 1 computes sum and stores result.

## API check

```ts
import { compile } from '@openedge/compiler-api';

const result = compile(source);
console.log(result.success, result.stats.cycles);
```

Full generated CSV: `docs-site/snippets/examples/basic/01-main.csv`.
