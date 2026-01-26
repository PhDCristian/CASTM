/**
 * OpenEdge-DSL Lexer Patterns
 *
 * Regular expression patterns and character sets used by the lexer.
 */

/**
 * Whitespace characters
 */
export const WHITESPACE_PATTERN = /\s/;

/**
 * Newline character
 */
export const NEWLINE_PATTERN = /\n/;

/**
 * Identifier start character (letter or underscore)
 */
export const IDENTIFIER_START_PATTERN = /[a-zA-Z_]/;

/**
 * Identifier continuation character (letter, digit, or underscore)
 */
export const IDENTIFIER_PART_PATTERN = /[a-zA-Z0-9_]/;

/**
 * Digit character
 */
export const DIGIT_PATTERN = /[0-9]/;

/**
 * Hexadecimal digit
 */
export const HEX_DIGIT_PATTERN = /[0-9a-fA-F]/;

/**
 * Single character operators and punctuation
 */
export const SINGLE_CHAR_OPERATORS = new Set([
  '{', '}', '(', ')', '[', ']', ';', ':', '|', ',', '@',
  '+', '-', '*', '/', '%'
]);

/**
 * Characters that can start a multi-character operator
 */
export const MULTI_CHAR_OPERATOR_STARTS = new Set(['=', '!', '<', '>']);

/**
 * Two-character operators
 */
export const TWO_CHAR_OPERATORS = new Set(['==', '!=', '<=', '>=']);

/**
 * DSL keywords (case-insensitive matching)
 */
export const DSL_KEYWORDS = new Set([
  'kernel',
  'config',
  'cycle',
  'row',
  'col',
  'for',
  'in',
  'range',
  'while',
  'function',
  'if',
  'else',
  'kernel_module',  // Reusable multi-cycle module definition
  'inline'          // Inline expansion of kernel_module
]);

/**
 * Checks if a word is a DSL keyword
 */
export function isKeyword(word: string): boolean {
  return DSL_KEYWORDS.has(word.toLowerCase());
}

/**
 * Checks if a character is whitespace
 */
export function isWhitespace(char: string): boolean {
  return WHITESPACE_PATTERN.test(char);
}

/**
 * Checks if a character is a newline
 */
export function isNewline(char: string): boolean {
  return char === '\n';
}

/**
 * Checks if a character can start an identifier
 */
export function isIdentifierStart(char: string): boolean {
  return IDENTIFIER_START_PATTERN.test(char);
}

/**
 * Checks if a character can continue an identifier
 */
export function isIdentifierPart(char: string): boolean {
  return IDENTIFIER_PART_PATTERN.test(char);
}

/**
 * Checks if a character is a digit
 */
export function isDigit(char: string): boolean {
  return DIGIT_PATTERN.test(char);
}

/**
 * Checks if a character is a hex digit
 */
export function isHexDigit(char: string): boolean {
  return HEX_DIGIT_PATTERN.test(char);
}

/**
 * Checks if a character is a single-char operator
 */
export function isSingleCharOperator(char: string): boolean {
  return SINGLE_CHAR_OPERATORS.has(char);
}

/**
 * Checks if a character can start a multi-char operator
 */
export function canStartMultiCharOperator(char: string): boolean {
  return MULTI_CHAR_OPERATOR_STARTS.has(char);
}

/**
 * Checks if two characters form a two-char operator
 */
export function isTwoCharOperator(chars: string): boolean {
  return TWO_CHAR_OPERATORS.has(chars);
}

/**
 * Checks if a character starts a comment
 */
export function isCommentStart(char: string, nextChar: string): boolean {
  return char === '/' && (nextChar === '/' || nextChar === '*');
}

/**
 * Checks if a character is a directive start (.)
 */
export function isDirectiveStart(char: string): boolean {
  return char === '.';
}

/**
 * Checks if a character is a pragma start (#)
 */
export function isPragmaStart(char: string): boolean {
  return char === '#';
}

/**
 * Checks if a character is a string delimiter
 */
export function isStringDelimiter(char: string): boolean {
  return char === '"';
}

/**
 * Checks if a character is the underscore placeholder
 */
export function isUnderscore(char: string): boolean {
  return char === '_';
}

/**
 * Checks if a character is the at symbol
 */
export function isAtSymbol(char: string): boolean {
  return char === '@';
}
