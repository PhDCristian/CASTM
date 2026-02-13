---
title: CLI Reference
outline: deep
---

# CLI Reference

The `openedge` CLI exposes three canonical commands.

## Usage

```bash
openedge emit <input.dsl> [-o out.csv] [--format flat-csv|sim-matrix-csv] [--target profile] [--rows N] [--cols N] [--topology torus|mesh]
openedge check <input.dsl> [--target profile] [--rows N] [--cols N] [--topology torus|mesh]
openedge analyze <input.dsl> [--target profile] [--rows N] [--cols N] [--topology torus|mesh]
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

## Grid Overrides

Use runtime grid overrides without changing source:

```bash
openedge emit kernel.dsl --rows 8 --cols 8 --topology mesh
```

## Exit Codes

- `0`: success
- `1`: CLI/runtime failure
- `2`: compilation diagnostics (parse/semantic/lowering errors)
