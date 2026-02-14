# Compilation Pipeline

OpenEdgeDSL uses a staged compiler pipeline with explicit contracts and artifacts.

## Target and assumptions

- Snippets in this page use `target "uma-cgra-base";`.
- Pipeline behavior is deterministic for a fixed source and compile options.
- CSV snippets are generated through `docs:artifacts:generate`.

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

## Phase walkthrough (OpenEdgeDSL ↔ CSV)

::: code-group
<<< ../snippets/language/compilation/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/language/compilation/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/compilation/01-main.csv`.

## Compile Options

| Option | Type | Purpose |
|---|---|---|
| `targetProfile` | `string` | select target profile from `lang-spec` |
| `grid` | `{ rows?, cols?, topology? }` | override effective grid at compile time |
| `emitArtifacts` | `Array<'structured'|'ast'|'hir'|'mir'|'lir'|'csv'>` | request phase artifacts |
| `strictUnsupported` | `boolean` | enforce strict validation for unsupported forms |
| `schedulerMode` | `"safe" \| "balanced" \| "aggressive"` | deterministic scheduling profile selection |
| `schedulerWindow` | `number` | slot-pack lookahead window override (`>=0`) |
| `memoryReorderPolicy` | `"strict" \| "same-address-fence"` | memory scheduling fence policy |

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

## Scheduling Notes

- slot packing is placement-level (not only whole-cycle merge) and deterministic.
- numeric branch targets are remapped when intermediate noop cycles are removed.
- in non-strict memory policy, `ROUT` producers may move earlier when no incoming-read dependency is crossed.
- control-flow ops (`BEQ/BNE/.../EXIT`) remain barriers.

## Reproduce with artifacts

```bash
openedge analyze kernel.dsl
openedge emit kernel.dsl --format sim-matrix-csv -o kernel.csv
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
