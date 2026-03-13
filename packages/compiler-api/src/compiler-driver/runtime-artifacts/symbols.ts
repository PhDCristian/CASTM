import {
  AstProgram,
  MemoryRegionInfo,
  SymbolArrayInfo
} from '@castm/compiler-ir';

export interface SymbolCollections {
  constants: Record<string, string>;
  aliases: Record<string, string>;
  arrays: SymbolArrayInfo[];
  labels: Record<string, number>;
}

export function createEmptySymbolCollections(): SymbolCollections {
  return {
    constants: {},
    aliases: {},
    arrays: [],
    labels: {}
  };
}

export function collectArrayAndLabelSymbols(ast: AstProgram, dataRegions: MemoryRegionInfo[]): SymbolCollections {
  const symbols = createEmptySymbolCollections();

  for (const region of dataRegions) {
    if (!region.name) continue;
    symbols.arrays.push({
      name: region.name,
      start: region.start,
      length: region.values.length,
      ...(region.rows !== undefined ? { rows: region.rows } : {}),
      ...(region.cols !== undefined ? { cols: region.cols } : {})
    });
  }

  for (const cycle of ast.kernel?.cycles ?? []) {
    if (!cycle.label) continue;
    symbols.labels[cycle.label] = cycle.index;
  }

  return symbols;
}
