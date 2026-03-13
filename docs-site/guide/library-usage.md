---
title: Library Usage
outline: deep
---

# Library Usage

Use `@castm/compiler-api` for typed compilation phases.

## Target and assumptions

- Source snippets are canonical and include `target base;`.
- Artifact examples assume deterministic lowering in the default base profile.

## CASTM ↔ CSV quick sample

::: code-group
<<< ../snippets/guide/library-usage/01-main.castm{castm} [CASTM]
<<< ../snippets/guide/library-usage/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/guide/library-usage/01-main.csv`.

## Install

```bash
pnpm add @castm/compiler-api
```

## Compile API

```ts
import { compile } from '@castm/compiler-api';

const source = `
target base;
build {
  optimize O2;
  scheduler balanced;
  scheduler_window auto;
  memory_reorder same_address_fence;
  prune_noop_cycles on;
}
kernel "lib_example" {
  bundle { at @0,0: NOP; }
}
`;

const result = compile(source, {
  emitArtifacts: ['structured', 'ast', 'hir', 'mir', 'lir', 'csv'],
  strictUnsupported: true
});

if (!result.success) {
  console.error(result.diagnostics);
} else {
  console.log(result.artifacts.csv);
}
```

## Phase APIs

```ts
import { parse, analyze, emit } from '@castm/compiler-api';

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

- `emitArtifacts?: Array<'structured' | 'ast' | 'hir' | 'mir' | 'lir' | 'csv'>`
- `strictUnsupported?: boolean`

Behavior configuration is source-owned (`target`, `build`, runtime statements), not compile-option driven.

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
