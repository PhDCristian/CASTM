export {
  createDesugarMemoryPass,
  desugarAutoCyclePass,
  desugarExpressionsPass,
  desugarGotoPass,
  desugarInlineArithmeticPass,
  createSlotPackPass,
  pruneNoopCyclesPass,
  specializePass,
  desugarMemoryPass
} from './passes-shared/desugar-passes.js';

export {
  createExpandPragmasPass,
  expandPragmasPass
} from './passes-shared/expand-pragmas-pass.js';

export {
  createResolveSymbolsPass,
  createValidateGridPass,
  lowerToLirPass,
  lowerToMirPass
} from './passes-shared/lowering-passes.js';

export type { DataSymbolInfo } from './passes-shared/desugar-utils.js';
