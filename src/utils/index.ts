/**
 * OpenEdge-DSL Utility Functions
 *
 * Central export point for all utility modules.
 */

// String utilities
export {
  extractNumericValue,
  isNumericString,
  isImmWrapper,
  extractImmValue,
  wrapInImm,
  isRegister,
  isNeighborRef,
  isArrayReference,
  parseArrayReference,
  escapeRegex,
  splitRespectingQuotes,
  normalizeWhitespace,
  isIdentifierStart,
  isIdentifierPart
} from './string-utils';

// Source location utilities
export {
  type SourcePosition,
  SourceTracker,
  tokenToRange,
  tokensToRange,
  expandRange,
  isPositionInRange,
  offsetToPosition,
  positionToOffset,
  getSourceSnippet
} from './source-location';

// Expression evaluation
export {
  type ArithmeticOperator,
  isArithmeticOperator,
  evaluateSimpleExpression,
  tokenizeExpression,
  evaluateExpressionString,
  substituteVariable,
  isCompileTimeExpression
} from './expression';
