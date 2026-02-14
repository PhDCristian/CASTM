# Canonical Style Guide

This page defines the recommended writing style for production OpenEdgeDSL sources.

## Target and assumptions

- All executable examples are canonical and include `target base;`.
- CSV shown is generated from snippet artifacts.
- Use this style as the default for new kernels and refactors.

## Declaration Style

- use `let` for values, register aliases, and arrays.
- keep declaration names domain-oriented (`input`, `limbs`, `acc`, `carry`).

## Spatial Style

- use `at @r,c:` for point placements.
- use `at row N:` / `at col N:` / `at all:` for scope placements.
- use coordinate expressions for loop-driven placement (`@k/4,k%4`).

## Control Style

- place control PE explicitly: `if (...) at @r,c { ... }`.
- prefer clear runtime loops for hardware-controlled iteration.

## Advanced Statement Style

- prefer typed statement forms (`route(...)`, `reduce(...)`, `scan(...)`, etc.).
- keep arguments explicit (`key=value`) for readability and tool diagnostics.

## Kernel Hygiene

- group declarations first, then function helpers, then kernel logic.
- keep cycles focused: one intent per cycle when possible.
- use `latency_hide(...)` only when needed and keep window conservative.

## Tooling

- validate with `openedge check` before emit.
- use `openedge analyze` to inspect diagnostics and phase stats.

## Canonical style sample (OpenEdgeDSL ↔ CSV)

::: code-group
<<< ../snippets/reference/porting-guide/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/reference/porting-guide/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/reference/porting-guide/01-main.csv`.
