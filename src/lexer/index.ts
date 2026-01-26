/**
 * OpenEdge-DSL Lexer Module
 *
 * Central export point for the lexical analysis module.
 */

// Main lexer functions
export { tokenize, tokenStream } from './lexer';

// Pattern utilities
export {
  isWhitespace,
  isNewline,
  isIdentifierStart,
  isIdentifierPart,
  isDigit,
  isHexDigit,
  isSingleCharOperator,
  canStartMultiCharOperator,
  isTwoCharOperator,
  isCommentStart,
  isDirectiveStart,
  isPragmaStart,
  isStringDelimiter,
  isKeyword,
  DSL_KEYWORDS,
  SINGLE_CHAR_OPERATORS,
  TWO_CHAR_OPERATORS
} from './patterns';
