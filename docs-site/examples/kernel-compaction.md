# Kernel Compaction Patterns

This page shows how to replace repetitive spatial boilerplate with canonical compact statements while keeping deterministic output.

## What this demonstrates

- replacing repeated spatial placements with compact `std::*` blocks,
- equivalent explicit forms using `for` and coordinate expressions,
- readability improvements without semantic drift.

## When to use

Use this page when your kernel is functionally correct but too verbose and you want to reduce source size safely.

## Target and assumptions

- All snippets use `target base;`.
- CSV is generated automatically from the exact snippet shown.
- Default interpretation is `4x4` torus.

## CASTM ↔ CSV

## Case A — Compact extraction via `std::extract_bytes`

::: code-group
<<< ../snippets/examples/kernel-compaction/01-std-extract.castm{castm} [CASTM]
<<< ../snippets/examples/kernel-compaction/01-std-extract.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/kernel-compaction/01-std-extract.csv`.

## Case B — Equivalent explicit form with `for` inside `cycle`

::: code-group
<<< ../snippets/examples/kernel-compaction/02-explicit-for.castm{castm} [CASTM]
<<< ../snippets/examples/kernel-compaction/02-explicit-for.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/kernel-compaction/02-explicit-for.csv`.

## Case C — One-line full-grid load pattern

::: code-group
<<< ../snippets/examples/kernel-compaction/03-load-all.castm{castm} [CASTM]
<<< ../snippets/examples/kernel-compaction/03-load-all.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/kernel-compaction/03-load-all.csv`.

## Case D — Compact preload with row ranges

::: code-group
<<< ../snippets/examples/kernel-compaction/04-qhat-compact.castm{castm} [CASTM]
<<< ../snippets/examples/kernel-compaction/04-qhat-compact.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/kernel-compaction/04-qhat-compact.csv`.

## Why this CSV looks like this

- compact statements expand to deterministic placement cycles,
- explicit and compact forms preserve the same observable semantics,
- cycle growth comes from declared operations, not documentation shorthand.

## Practical rules

- Prefer `std::*` blocks for known reusable patterns (`extract_bytes`, `accumulate`, `normalize`, etc.).
- Use explicit `for` + coordinate expressions when geometry must be customized.
- Keep snippets short, but preserve explicit spatial intent.

## SBOX K7 v10 snapshot

Current optimized kernels in `UMA-CGRA-Simulator`:

- `examples/dsl_port/sbox_k7_v10_compact.castm`
- `examples/dsl_port/sbox_k7_v10_nocompact.castm`

Measured cycle budget (2026-02-13):

- `safe`: **205**
- `balanced`: **205**
- `aggressive`: **205**

Reproduce:

```bash
npx tsx scripts/sbox/stats.ts --file ./examples/dsl_port/sbox_k7_v10_compact.castm --scheduler safe
npx tsx scripts/sbox/stats.ts --file ./examples/dsl_port/sbox_k7_v10_nocompact.castm --scheduler safe
```

## Related features

- [/features/pragmas/extract-bytes](/features/pragmas/extract-bytes)
- [/features/coordinate-expressions](/features/coordinate-expressions)
- [/features/loops](/features/loops)

## Continue

- Next: [/examples/parallel](/examples/parallel)
- All examples: [/examples](/examples/index)
