# Streaming + Route Transfer

## What this demonstrates

- `std::stream_load/store(...)` for IO lanes,
- in-grid data movement (`std::rotate`, `std::shift`),
- explicit point-to-point transfer with `std::route(...)`.

## OpenEdgeDSL / CSV

::: code-group
<<< ./artifacts/fft.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/fft.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

Use this pattern when data comes from stream endpoints and then needs deterministic in-grid transport before storing back.

Full generated CSV: `docs-site/examples/artifacts/fft.csv`.
