# Examples Overview

This section is organized as executable, practical examples with deterministic lowering.

## What this demonstrates

- the global examples map with practical outcomes,
- direct navigation between examples and feature docs,
- one canonical DSL↔CSV preview to anchor interpretation.

## When to use

Use this page to choose the right example based on your current goal (learning path or domain path).

## Target and assumptions

- Every runnable snippet uses `target base;`.
- CSV shown in examples is generated from source snippets (never handwritten).
- Default interpretation is `4x4` torus unless a page states otherwise.

## CASTM ↔ CSV

## Quick preview

::: code-group
<<< ../snippets/examples/overview/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/overview/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/overview/01-main.csv`.

## Recommended reading order

1. [/examples/basic](/examples/basic)
2. [/examples/loops](/examples/loops)
3. [/examples/loop-strategies](/examples/loop-strategies)
4. [/examples/for-control-flow](/examples/for-control-flow)
5. [/examples/scheduler-modes](/examples/scheduler-modes)
6. [/examples/scheduler-practical](/examples/scheduler-practical)
7. [/examples/optimization-profiles](/examples/optimization-profiles)
8. [/examples/kernel-compaction](/examples/kernel-compaction)

## What each page demonstrates

| Page | Main goal | Practical outcome |
|---|---|---|
| [/examples/basic](/examples/basic) | first canonical kernel | load/add/store in 2 cycles |
| [/examples/loops](/examples/loops) | static + runtime loop syntax | correct expansion and runtime control PE |
| [/examples/loop-strategies](/examples/loop-strategies) | `unroll(k)` + `collapse(n)` | deterministic static scheduling strategy |
| [/examples/for-control-flow](/examples/for-control-flow) | `for` with `if/else` and `while` | explicit control-flow placement in kernel |
| [/examples/scheduler-modes](/examples/scheduler-modes) | API options | deterministic scheduler configuration |
| [/examples/scheduler-practical](/examples/scheduler-practical) | measured scheduler behavior | real cycle deltas and branch remap behavior |
| [/examples/optimization-profiles](/examples/optimization-profiles) | same kernel, different presets | direct O0/O1/O2/O3 cycle comparison |
| [/examples/kernel-compaction](/examples/kernel-compaction) | replacing boilerplate | shorter source with same semantics |
| [/examples/parallel](/examples/parallel) | `pipeline(...)` | ordered function composition |
| [/examples/scan](/examples/scan) | lane collectives | scan/reduce/allreduce composition |
| [/examples/stencil](/examples/stencil) | neighborhood + predicates | stencil + guard + triangle on one kernel |
| [/examples/barrett](/examples/barrett) | multi-limb arithmetic blocks | carry/normalize/conditional-sub composition |
| [/examples/fft](/examples/fft) | streaming + route | stream load/store + route transfer |

## Related sections

- Feature map: [/features](/features/index)
- Advanced statements: [/features/pragmas/index](/features/pragmas/index)
- Examples index: [/examples](/examples/index)

## Why this CSV looks like this

The preview snippet is intentionally small so cycle headers and slot placement can be read without noise.

## Related features

- [/features/index](/features/index)
- [/features/spatial-short-forms](/features/spatial-short-forms)
- [/features/pragmas/index](/features/pragmas/index)

## Continue

- Open examples index: [/examples/index](/examples/index)
- Start path: [/examples/basic](/examples/basic)

## Repro commands

```bash
# from CASTM
npm test

# docs contract snippets
npx vitest run tests/docs-snippets.contract.test.ts tests/docs-loop-features.contract.test.ts

# docs-site build
cd docs-site && npm run docs:build
```
