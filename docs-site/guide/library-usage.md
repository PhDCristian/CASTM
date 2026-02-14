---
title: Library Usage
outline: deep
---

# Library Usage

Use `@openedge/compiler-api` for typed compilation phases.

## Target and assumptions

- Source snippets are canonical and include `target "uma-cgra-base";`.
- Artifact examples assume deterministic lowering in the default base profile.

## OpenEdgeDSL ↔ CSV quick sample

::: code-group
<<< ../snippets/guide/library-usage/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/guide/library-usage/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/guide/library-usage/01-main.csv`.

## Install

```bash
pnpm add @openedge/compiler-api
```

## Compile API

```ts
import { compile } from '@openedge/compiler-api';

const source = `
target "uma-cgra-base";
kernel "lib_example" {
  cycle { at @0,0: NOP; }
}
`;

const result = compile(source, {
  grid: { rows: 4, cols: 4, topology: 'torus' },
  emitArtifacts: ['structured', 'ast', 'hir', 'mir', 'lir', 'csv'],
  schedulerMode: 'safe',
  schedulerWindow: 1,
  memoryReorderPolicy: 'strict'
});

if (!result.success) {
  console.error(result.diagnostics);
} else {
  console.log(result.artifacts.csv);
}
```

## Phase APIs

```ts
import { parse, analyze, emit } from '@openedge/compiler-api';

const parsed = parse(source);
if (!parsed.success || !parsed.ast) throw new Error('Parse failed');

const analyzed = analyze({
  ast: parsed.ast,
  structuredAst: parsed.structuredAst
});
if (!analyzed.success || !analyzed.lir) throw new Error('Analysis failed');

const emitted = emit(analyzed.lir, { format: 'flat-csv' });
```

## Artifacts

`CompileResult.artifacts` may contain:

- `structuredAst`
- `ast` (flat AST)
- `hir`
- `mir`
- `lir`
- `csv`
- runtime metadata (`memoryRegions`, `ioConfig`, `assertions`, `symbols`)

## Compile Options

- `targetProfile?: string`
- `grid?: { rows?: number; cols?: number; topology?: "torus" | "mesh" }`
- `emitArtifacts?: Array<'structured' | 'ast' | 'hir' | 'mir' | 'lir' | 'csv'>`
- `strictUnsupported?: boolean`
- `schedulerMode?: "safe" | "balanced" | "aggressive"`
- `schedulerWindow?: number`
- `memoryReorderPolicy?: "strict" | "same-address-fence"`

## Compile Stats

`CompileResult.stats` includes:

- `cycles`
- `instructions`
- `activeSlots`
- `totalSlots`
- `utilization`
- `estimatedCriticalCycles`
- `schedulerMode`
- `loweredPasses`
