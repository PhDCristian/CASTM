export {
  createDesugarMemoryPass,
  desugarMemoryPass
} from './desugar/memory-pass.js';
export { desugarExpressionsPass } from './desugar/expressions-pass.js';
export { desugarInlineArithmeticPass } from './desugar/inline-arithmetic-pass.js';
export { desugarGotoPass } from './desugar/goto-pass.js';
export { specializePass } from './desugar/specialize-pass.js';
export { desugarAutoCyclePass } from './desugar/auto-cycle-pass.js';
export { pruneNoopCyclesPass } from './desugar/prune-noop-cycles-pass.js';
export { createSlotPackPass } from './desugar/slot-pack-pass.js';
