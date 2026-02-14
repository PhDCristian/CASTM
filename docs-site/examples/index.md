# Examples Index

Use this page to navigate examples by learning path and domain.

## What this demonstrates

- how examples are grouped by learning progression and domain,
- where to find runnable DSL↔CSV references quickly,
- how to jump between examples and feature-level docs.

## When to use

Use this as your starting point before opening individual examples.

## Target and assumptions

- Every runnable snippet in examples uses `target "uma-cgra-base";`.
- CSV is generated from the same OpenEdgeDSL snippet shown in each page.

## OpenEdgeDSL ↔ CSV

## Quick preview

::: code-group
<<< ../snippets/examples/index/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/index/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/index/01-main.csv`.

## Learning path (recommended)

1. [/examples/basic](/examples/basic)
2. [/examples/loops](/examples/loops)
3. [/examples/loop-strategies](/examples/loop-strategies)
4. [/examples/for-control-flow](/examples/for-control-flow)
5. [/examples/scheduler-modes](/examples/scheduler-modes)
6. [/examples/scheduler-practical](/examples/scheduler-practical)
7. [/examples/kernel-compaction](/examples/kernel-compaction)

## Domain-oriented path

- Streaming + route: [/examples/fft](/examples/fft)
- Multi-limb arithmetic: [/examples/barrett](/examples/barrett)
- Neighborhood + predicates: [/examples/stencil](/examples/stencil)
- Collectives: [/examples/scan](/examples/scan)
- Function sequencing: [/examples/parallel](/examples/parallel)

## Bridge to features

- Feature map: [/features](/features/index)
- Advanced statements index: [/features/pragmas/index](/features/pragmas/index)

## Why this CSV looks like this

The preview snippet is intentionally minimal: one cycle and one placement to make the DSL→matrix mapping obvious.

## Related features

- [/features/index](/features/index)
- [/features/spatial-short-forms](/features/spatial-short-forms)
- [/features/pragmas/index](/features/pragmas/index)

## Continue

- Browse practical path: [/examples/overview](/examples/overview)
- Start now: [/examples/basic](/examples/basic)
