---
title: Library Usage
outline: deep
---

# Library Usage

OpenEdge DSL can be used as a TypeScript/JavaScript library for programmatic compilation.

## Installation

```bash
npm install @openedge/compiler-api
```

## Basic Usage

```typescript
import { compile } from '@openedge/compiler-api';

const source = `
target "uma-cgra-base";
let values = { 1, 2, 3 };
kernel "Test" {
    cycle {
        at @0,0: R0 = values[0];
    }
}
`;

const result = compile(source);

if (result.success) {
  console.log(result.artifacts.csv);
  console.log('Cycles:', result.stats.cycles);
  console.log('Grid:', result.artifacts.mir?.grid);
  console.log('Memory:', result.artifacts.memoryRegions);
} else {
  console.error('Errors:', result.diagnostics);
}
```

## API Reference

### Exports

| Export | Description |
|--------|-------------|
| `parse(source, options?)` | Parse source to AST with diagnostics |
| `analyze(ast, options?)` | Semantic analysis and lowering pipeline |
| `compile(source, options?)` | Compile source and emit selected artifacts |
| `emit(program, options?)` | Emit output formats (`flat-csv`, `sim-matrix-csv`) |

### `compile(source: string): CompileResult`

Compiles a complete DSL source string and returns a result object:

```typescript
interface CompileResult {
  success: boolean;
  artifacts: {
    csv?: string;
    ast?: AstProgram;
    hir?: HirProgram;
    mir?: MirProgram;
    lir?: LirProgram;
    memoryRegions?: MemoryRegionInfo[];
  };
  diagnostics: Diagnostic[];
  stats: {
    cycles: number;
    instructions: number;
  };
}
```

### Package Exports Map

```json
{
  "@openedge/compiler-api": "parse/analyze/compile/emit",
  "@openedge/compiler-ir": "shared IR and diagnostics types",
  "@openedge/compiler-front": "tokenizer/parser",
  "@openedge/compiler-backend-csv": "CSV emitters",
  "@openedge/lang-spec": "instruction and target metadata"
}
```
