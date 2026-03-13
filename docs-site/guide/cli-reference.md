---
title: CLI Reference
outline: deep
---

# CLI Reference

The `castm` CLI exposes three canonical commands.

## Target and assumptions

- CLI examples assume canonical source with `target base;`.
- `sim-matrix-csv` is the default documentation view format for DSL↔CSV equivalence.

## CASTM ↔ CSV quick sample

::: code-group
<<< ../snippets/guide/cli-reference/01-main.castm{castm} [CASTM]
<<< ../snippets/guide/cli-reference/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/guide/cli-reference/01-main.csv`.

## Usage

```bash
castm emit <input.castm> [-o out.csv] [--format flat-csv|sim-matrix-csv]
castm check <input.castm>
castm analyze <input.castm>
```

## Commands

## `emit`

Compiles source and emits CSV.

- default format: `flat-csv`
- optional simulator-ready format: `sim-matrix-csv`

Examples:

```bash
castm emit kernel.castm -o kernel.csv
castm emit kernel.castm --format sim-matrix-csv -o kernel-matrix.csv
```

## `check`

Runs parse + semantic + lowering validation and prints `ok` on success.

```bash
castm check kernel.castm
```

## `analyze`

Returns JSON with stats and diagnostics.

```bash
castm analyze kernel.castm
```

## Source-owned configuration

Target/grid/scheduler settings are configured in the source (`target` + `build { ... }`), not via CLI flags.

- [Configuration in Source](/language/configuration)
- [Target Profiles](/language/target-profiles)

## Exit Codes

- `0`: success
- `1`: CLI/runtime failure
- `2`: compilation diagnostics (parse/semantic/lowering errors)
