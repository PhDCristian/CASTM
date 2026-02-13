---
title: Library Usage
outline: deep
---

# Library Usage

Use `@openedge/compiler-api` for typed compilation phases.

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
  emitArtifacts: ['structured', 'ast', 'hir', 'mir', 'lir', 'csv']
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
const analyzed = analyze(parsed.artifacts.structuredAst!);
const emitted = emit(analyzed.artifacts.lir!, { format: 'flat-csv' });
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
