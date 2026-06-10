import {
  AstProgram,
  Diagnostic,
  MemoryRegionInfo
} from '@castm/compiler-ir';
import { collectDirectiveArtifacts } from './directives.js';
import {
  collectArrayAndLabelSymbols,
  createEmptySymbolCollections
} from './symbols.js';
import { RuntimeArtifactCollection } from './types.js';

export function createEmptyRuntimeArtifacts(): RuntimeArtifactCollection {
  return {
    ioConfig: { loadAddrs: [], storeAddrs: [] },
    bundleLimit: undefined,
    bundleLimitSpan: undefined,
    assertions: [],
    symbols: { constants: {}, aliases: {}, arrays: [], labels: {} }
  };
}

export function collectRuntimeArtifacts(
  ast: AstProgram,
  dataRegions: MemoryRegionInfo[],
  diagnostics: Diagnostic[]
): RuntimeArtifactCollection {
  const baseSymbols = collectArrayAndLabelSymbols(ast, dataRegions);
  const symbols = {
    ...createEmptySymbolCollections(),
    ...baseSymbols
  };
  const directiveArtifacts = collectDirectiveArtifacts(ast, diagnostics, symbols);

  return {
    ioConfig: directiveArtifacts.ioConfig,
    bundleLimit: directiveArtifacts.bundleLimit,
    bundleLimitSpan: directiveArtifacts.bundleLimitSpan,
    assertions: directiveArtifacts.assertions,
    symbols: {
      constants: symbols.constants,
      aliases: symbols.aliases,
      arrays: symbols.arrays,
      labels: symbols.labels
    }
  };
}
