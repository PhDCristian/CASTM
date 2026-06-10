# Features Overview

Use this section as the canonical feature map of CASTM.

## How to use this section

1. Start with core syntax pages.
2. Move to advanced statements (`std::*`) by operation family.
3. Jump to practical examples for end-to-end compositions.

## Target and assumptions

- Canonical syntax only.
- Snippets include `target base;`.
- CSV shown is generated from source artifacts.

## Quick CASTM ↔ CSV preview

::: code-group
<<< ../snippets/features/index/01-main.castm{castm} [CASTM]
<<< ../snippets/features/index/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/index/01-main.csv`.

## Core syntax (by topic)

- Expressions: [/features/expressions](/features/expressions)
- Memory sugar: [/features/memory-sugar](/features/memory-sugar)
- Functions: [/features/functions](/features/functions)
- Loops: [/features/loops](/features/loops)
- Control flow: [/features/control-flow](/features/control-flow)
- Labels: [/features/labels](/features/labels)
- Coordinate model: [/features/coordinate-expressions](/features/coordinate-expressions), [/features/dynamic-coordinates](/features/dynamic-coordinates), [/features/spatial-short-forms](/features/spatial-short-forms)

## Advanced statements (by family)

- Routing/streaming: [/features/advanced-statements/route](/features/advanced-statements/route), [/features/advanced-statements/stream](/features/advanced-statements/stream)
- Collectives: [/features/advanced-statements/reduce](/features/advanced-statements/reduce), [/features/advanced-statements/scan](/features/advanced-statements/scan), [/features/advanced-statements/allreduce](/features/advanced-statements/allreduce)
- Geometry/patterns: [/features/advanced-statements/stencil](/features/advanced-statements/stencil), [/features/advanced-statements/triangle](/features/advanced-statements/triangle), [/features/advanced-statements/gather](/features/advanced-statements/gather)
- Arithmetic blocks: [/features/advanced-statements/carry-chain](/features/advanced-statements/carry-chain), [/features/advanced-statements/normalize](/features/advanced-statements/normalize), [/features/advanced-statements/conditional-sub](/features/advanced-statements/conditional-sub), [/features/advanced-statements/mulacc-chain](/features/advanced-statements/mulacc-chain)
- Scheduling/helpers: [/features/advanced-statements/auto-bundle](/features/advanced-statements/auto-bundle), [/features/advanced-statements/stash](/features/advanced-statements/stash), [/features/advanced-statements/pipeline](/features/advanced-statements/pipeline)

## Jump to examples

- General examples catalog: [/examples](/examples/index)
- Streaming + route example: [/examples/fft](/examples/fft)
- Arithmetic chain example: [/examples/barrett](/examples/barrett)
