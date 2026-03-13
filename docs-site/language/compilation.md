# Compilation Pipeline

CASTM uses a staged compiler pipeline with explicit contracts and artifacts.

## Target and assumptions

- Snippets in this page use canonical source-owned config (`target` + optional `build`).
- Pipeline behavior is deterministic for a fixed source.
- CSV snippets are generated through `docs:artifacts:generate`.
- Canonical target alias is `target base;` (no need to use internal profile IDs in source).

## Pipeline Stages

| Stage | Input | Output | Purpose |
|---|---|---|---|
| Parse | source text | structured AST | canonical syntax parsing and shape validation |
| Analyze | structured AST | flat AST | semantic checks, expansion, deterministic lowering prep |
| Lower | flat AST | HIR / MIR / LIR | target-oriented intermediate lowering |
| Emit | LIR or MIR | CSV | backend output (`flat-csv` or `sim-matrix-csv`) |

## Public API

- `parse(source, options)`
- `analyze(ast, options)`
- `compile(source, options)`
- `emit(program, backendOptions)`

## Phase walkthrough (CASTM ↔ CSV)

::: code-group
<<< ../snippets/language/compilation/01-main.castm{castm} [CASTM]
<<< ../snippets/language/compilation/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/compilation/01-main.csv`.

## Compiler Options (tooling only)

| Option | Type | Purpose |
|---|---|---|
| `emitArtifacts` | `Array<'structured'|'ast'|'hir'|'mir'|'lir'|'csv'>` | request phase artifacts |
| `strictUnsupported` | `boolean` | enforce strict validation for unsupported forms |

Build/runtime behavior (target, grid, scheduler, memory policy, noop pruning, io pointers, cycle limits, assertions) is configured in source via `target`, `build { ... }`, and runtime statements.

## Compile Result Artifacts

`compile(...)` may include:

- `structuredAst`
- `ast` (flat AST)
- `hir`
- `mir`
- `lir`
- `csv`
- runtime metadata: `memoryRegions`, `ioConfig`, `assertions`, `symbols`

`compile(...).stats` includes:

- `cycles`, `instructions`
- `activeSlots`, `totalSlots`, `utilization`
- `estimatedCriticalCycles`
- `schedulerMode`
- `loweredPasses`

## Scheduling Notes (source-driven)

- slot packing is placement-level (not only whole-cycle merge) and deterministic.
- numeric branch targets are remapped when intermediate noop cycles are removed.
- in non-strict memory policy, `ROUT` producers may move earlier when no incoming-read dependency is crossed.
- control-flow ops (`BEQ/BNE/.../EXIT`) remain barriers.

Scheduler policy comes from source:

```castm
target base;
build {
  optimize O2;
  scheduler balanced;
  scheduler_window auto;
  memory_reorder same_address_fence;
  prune_noop_cycles on;
}
kernel "build_config_example" {
  bundle { at @0,0: SADD R1, R0, 1; }
}
```

See full configuration recipes (O0/O1/O2/O3 and explicit overrides):
- [Configuration in Source](/language/configuration)

## Reproduce with artifacts

```bash
castm analyze kernel.castm
castm emit kernel.castm --format sim-matrix-csv -o kernel.csv
```

## Diagnostics Contract

Each diagnostic includes:

- `code`
- `severity`
- `span`
- `message`
- optional `hint`, `hintCode`

See [Error Codes](/reference/error-codes).

## DSL to CSV View

Use the dedicated equivalence page for side-by-side examples:

- [DSL to CSV Equivalence](/language/dsl-csv-equivalence)
