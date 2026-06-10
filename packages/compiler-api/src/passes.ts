export {
  createDesugarMemoryPass,
  desugarAutoBundlePass,
  desugarExpressionsPass,
  desugarGotoPass,
  desugarInlineArithmeticPass,
  createSlotPackPass,
  pruneNoopBundlesPass,
  specializePass,
  desugarMemoryPass
} from './passes-shared/desugar-passes.js';

export {
  createExpandAdvancedStatementsPass,
  expandAdvancedStatementsPass
} from './passes-shared/expand-advanced-statements-pass.js';

export {
  createResolveSymbolsPass,
  createValidateGridPass,
  lowerToLirPass,
  lowerToMirPass
} from './passes-shared/lowering-passes.js';

export type { DataSymbolInfo } from './passes-shared/desugar-utils.js';
