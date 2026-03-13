# `std::stash(...)`

## When to use

Use explicit save/restore of register state to memory regions with scoped targets.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::stash(action=save|restore, reg=Rr, addr=<expr>, target=all|row(i)|col(j)|point(r,c));
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `action` | yes | `save` or `restore`. |
| `reg` | yes | Register to persist or restore. |
| `addr` | yes | Memory address expression. |
| `target` | no | Spatial scope (`all` default). |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/stash/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stash/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stash/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/stash/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stash/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stash/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/stash/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stash/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stash/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/stash/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stash/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stash/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/stash/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to deterministic SWI/LWI placements according to selected target subset.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::stream_load/store(...)` for IO streams
- memory sugar inside `bundle {}` for explicit loads/stores
