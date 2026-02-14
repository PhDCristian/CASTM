# Basic: Load + Add + Store

## What this demonstrates

- canonical `let` declarations,
- memory sugar (`R = A[i]`, `A[i] = R`),
- simple arithmetic lowering (`R2 = R0 + R1`).

## OpenEdgeDSL / CSV

::: code-group
<<< ./artifacts/basic.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/basic.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
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

Full generated CSV: `docs-site/examples/artifacts/basic.csv`.
