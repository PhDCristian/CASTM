# Streaming + Route Transfer

## What this demonstrates

- `std::stream_load/store(...)` for IO lanes,
- in-grid data movement (`std::rotate`, `std::shift`),
- explicit point-to-point transfer with `std::route(...)`.

## Target and assumptions

- `target "uma-cgra-base";` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## OpenEdgeDSL / CSV

::: code-group
<<< ../snippets/examples/fft/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/fft/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

Use this pattern when data comes from stream endpoints and then needs deterministic in-grid transport before storing back.

Full generated CSV: `docs-site/snippets/examples/fft/01-main.csv`.
