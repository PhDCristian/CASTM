# Examples Overview

This section is organized as executable, practical examples.

## Recommended reading order

1. [/examples/basic](/examples/basic)
2. [/examples/loops](/examples/loops)
3. [/examples/loop-strategies](/examples/loop-strategies)
4. [/examples/for-control-flow](/examples/for-control-flow)
5. [/examples/scheduler-modes](/examples/scheduler-modes)
6. [/examples/scheduler-practical](/examples/scheduler-practical)
7. [/examples/kernel-compaction](/examples/kernel-compaction)

## What each page demonstrates

| Page | Main goal | Practical outcome |
|---|---|---|
| `basic` | first canonical kernel | load/add/store in 2 cycles |
| `loops` | static + runtime loop syntax | correct expansion and runtime control PE |
| `loop-strategies` | `unroll(k)` + `collapse(n)` | deterministic static scheduling strategy |
| `for-control-flow` | `for` with `if/else` and `while` | explicit control-flow placement in kernel |
| `scheduler-modes` | API options | deterministic scheduler configuration |
| `scheduler-practical` | measured scheduler behavior | real cycle deltas and branch remap behavior |
| `kernel-compaction` | replacing boilerplate | shorter source with same semantics |
| `parallel` | `pipeline(...)` | ordered function composition |
| `scan` | lane collectives | scan/reduce/allreduce composition |
| `stencil` | neighborhood + predicates | stencil + guard + triangle on one kernel |
| `barrett` | multi-limb arithmetic blocks | carry/normalize/conditional-sub composition |
| `fft` | streaming + route | stream load/store + route transfer |

## Repro commands

```bash
# from OpenEdgeDSL
npm test

# docs contract snippets
npx vitest run tests/docs-snippets.contract.test.ts tests/docs-loop-features.contract.test.ts

# docs-site build
cd docs-site && npm run docs:build
```
