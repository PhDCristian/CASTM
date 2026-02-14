---
title: CLI Reference
outline: deep
---

# CLI Reference

The `openedge` CLI exposes three canonical commands.

## Target and assumptions

- CLI examples assume canonical source with `target base;`.
- `sim-matrix-csv` is the default documentation view format for DSL↔CSV equivalence.

## OpenEdgeDSL ↔ CSV quick sample

::: code-group
<<< ../snippets/guide/cli-reference/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/guide/cli-reference/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/guide/cli-reference/01-main.csv`.

## Usage

```bash
openedge emit <input.dsl> [-o out.csv] [--format flat-csv|sim-matrix-csv]
openedge check <input.dsl>
openedge analyze <input.dsl>
```

## Commands

## `emit`

Compiles source and emits CSV.

- default format: `flat-csv`
- optional simulator-ready format: `sim-matrix-csv`

Examples:

```bash
openedge emit kernel.dsl -o kernel.csv
openedge emit kernel.dsl --format sim-matrix-csv -o kernel-matrix.csv
```

## `check`

Runs parse + semantic + lowering validation and prints `ok` on success.

```bash
openedge check kernel.dsl
```

## `analyze`

Returns JSON with stats and diagnostics.

```bash
openedge analyze kernel.dsl
```

## Source-owned configuration

Target/grid/scheduler settings are configured in the source (`target` + `build { ... }`), not via CLI flags.

- [Configuration in Source](/language/configuration)
- [Target Profiles](/language/target-profiles)

## Exit Codes

- `0`: success
- `1`: CLI/runtime failure
- `2`: compilation diagnostics (parse/semantic/lowering errors)
