export type { DataSymbolInfo } from './desugar-utils/types.js';
export {
  isArrayAddress,
  isMemoryReference,
  isRawAddress,
  toAddressOperand
} from './desugar-utils/memory.js';
export {
  splitAssignment,
  splitTopLevelBinary
} from './desugar-utils/expressions.js';
export {
  requireIdentifier,
  transformInstructions
} from './desugar-utils/transform.js';
