# Basic: Load + Add + Store

## What this demonstrates

- canonical `let` declarations,
- memory sugar (`R = A[i]`, `A[i] = R`),
- simple arithmetic lowering (`R2 = R0 + R1`).

## When to use

Use this as the first reference for validating end-to-end toolchain setup and DSL↔CSV understanding.

## Target and assumptions

- `target base;` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/basic/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/basic/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Why this CSV looks like this

- 2 cycles total.
- Cycle 0 loads two values.
- Cycle 1 computes sum and stores result.

## API check

```ts
import { compile } from '@castm/compiler-api';

const result = compile(source);
console.log(result.success, result.stats.cycles);
```

Full generated CSV: `docs-site/snippets/examples/basic/01-main.csv`.

## Related features

- [/features/expressions](/features/expressions)
- [/features/memory-sugar](/features/memory-sugar)
- [/features/named-arrays](/features/named-arrays)

## Continue

- Next: [/examples/loops](/examples/loops)
- All examples: [/examples](/examples/index)
