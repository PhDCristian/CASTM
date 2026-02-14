# Kernel Compaction Patterns

This page shows how to replace repetitive spatial boilerplate with canonical compact statements while keeping deterministic output.

## Target and assumptions

- All snippets use `target "uma-cgra-base";`.
- CSV is generated automatically from the exact snippet shown.
- Default interpretation is `4x4` torus.

## Case A — Compact extraction via `std::extract_bytes`

::: code-group
<<< ../snippets/examples/kernel-compaction/01-std-extract.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/kernel-compaction/01-std-extract.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/kernel-compaction/01-std-extract.csv`.

## Case B — Equivalent explicit form with `for` inside `cycle`

::: code-group
<<< ../snippets/examples/kernel-compaction/02-explicit-for.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/kernel-compaction/02-explicit-for.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/kernel-compaction/02-explicit-for.csv`.

## Case C — One-line full-grid load pattern

::: code-group
<<< ../snippets/examples/kernel-compaction/03-load-all.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/kernel-compaction/03-load-all.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/kernel-compaction/03-load-all.csv`.

## Case D — Compact preload with row ranges

::: code-group
<<< ../snippets/examples/kernel-compaction/04-qhat-compact.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/kernel-compaction/04-qhat-compact.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/kernel-compaction/04-qhat-compact.csv`.

## Practical rules

- Prefer `std::*` blocks for known reusable patterns (`extract_bytes`, `accumulate`, `normalize`, etc.).
- Use explicit `for` + coordinate expressions when geometry must be customized.
- Keep snippets short, but preserve explicit spatial intent.

## SBOX K7 v10 snapshot

Current optimized kernels in `UMA-CGRA-Simulator`:

- `examples/dsl_port/sbox_k7_v10_compact.edsl`
- `examples/dsl_port/sbox_k7_v10_nocompact.edsl`

Measured cycle budget (2026-02-13):

- `safe`: **205**
- `balanced`: **205**
- `aggressive`: **205**

Reproduce:

```bash
npx tsx scripts/sbox/stats.ts --file ./examples/dsl_port/sbox_k7_v10_compact.edsl --scheduler safe
npx tsx scripts/sbox/stats.ts --file ./examples/dsl_port/sbox_k7_v10_nocompact.edsl --scheduler safe
```
