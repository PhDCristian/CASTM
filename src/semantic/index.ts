/**
 * OpenEdge-DSL Semantic Analysis Module
 *
 * Provides symbol resolution and operand substitution.
 */

// Symbol resolution
export {
  type ResolveResult,
  resolveOperand,
  resolveArrayReference,
  resolveArrayProperty,
  buildDataIndexMap,
  getTotalDataLength,
  isRegisterName,
  isNeighborReference,
  isImmediate
} from './symbol-resolver';

// Operand substitution
export {
  substituteLoopVariable,
  resolveArrayPropertyValue,
  substituteArrayProperties,
  resolveRangeExpression,
  calculateIterations,
  iterateRange
} from './operand-substitution';
