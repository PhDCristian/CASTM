# Streaming + Route Transfer

## What this demonstrates

- `std::stream_load/store(...)` for IO lanes,
- in-grid data movement (`std::rotate`, `std::shift`),
- explicit point-to-point transfer with `std::route(...)`.

## When to use

Use this pattern when data enters/exits via stream endpoints and needs deterministic in-grid transport.

## Target and assumptions

- `target base;` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/fft/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/fft/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Why this CSV looks like this

The first cycles place stream ingress/egress operations and then route transfer cycles according to the declared source and sink points.

Full generated CSV: `docs-site/snippets/examples/fft/01-main.csv`.

## Related features

- [/features/pragmas/stream](/features/pragmas/stream)
- [/features/pragmas/route](/features/pragmas/route)
- [/features/pragmas/route-variants](/features/pragmas/route-variants)

## Continue

- Back to index: [/examples](/examples/index)
- Start path: [/examples/basic](/examples/basic)
