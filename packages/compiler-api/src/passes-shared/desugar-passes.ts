export {
  createDesugarMemoryPass,
  desugarMemoryPass
} from './desugar/memory-pass.js';
export { desugarExpressionsPass } from './desugar/expressions-pass.js';
export { desugarInlineArithmeticPass } from './desugar/inline-arithmetic-pass.js';
export { desugarGotoPass } from './desugar/goto-pass.js';
export { specializePass } from './desugar/specialize-pass.js';
export { desugarAutoBundlePass } from './desugar/auto-bundle-pass.js';
export { pruneNoopBundlesPass } from './desugar/prune-noop-bundles-pass.js';
export { createSlotPackPass } from './desugar/slot-pack-pass.js';
