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

- Routing/streaming: [/features/pragmas/route](/features/pragmas/route), [/features/pragmas/stream](/features/pragmas/stream)
- Collectives: [/features/pragmas/reduce](/features/pragmas/reduce), [/features/pragmas/scan](/features/pragmas/scan), [/features/pragmas/allreduce](/features/pragmas/allreduce)
- Geometry/patterns: [/features/pragmas/stencil](/features/pragmas/stencil), [/features/pragmas/triangle](/features/pragmas/triangle), [/features/pragmas/gather](/features/pragmas/gather)
- Arithmetic blocks: [/features/pragmas/carry-chain](/features/pragmas/carry-chain), [/features/pragmas/normalize](/features/pragmas/normalize), [/features/pragmas/conditional-sub](/features/pragmas/conditional-sub), [/features/pragmas/mulacc-chain](/features/pragmas/mulacc-chain)
- Scheduling/helpers: [/features/pragmas/auto-cycle](/features/pragmas/auto-cycle), [/features/pragmas/stash](/features/pragmas/stash), [/features/pragmas/pipeline](/features/pragmas/pipeline)

## Jump to examples

- General examples catalog: [/examples](/examples/index)
- Streaming + route example: [/examples/fft](/examples/fft)
- Arithmetic chain example: [/examples/barrett](/examples/barrett)
