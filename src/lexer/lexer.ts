/**
 * OpenEdge-DSL Lexer
 *
 * Tokenizes DSL source code into a stream of tokens.
 */

import { Token, TokenType } from '../types/tokens';
import { createError, CompilationError } from '../types/errors';
import {
  isWhitespace,
  isNewline,
  isIdentifierStart,
  isIdentifierPart,
  isDigit,
  isHexDigit,
  isSingleCharOperator,
  canStartMultiCharOperator,
  isTwoCharOperator,
  isThreeCharOperator,
  isCommentStart,
  isDirectiveStart,
  isPragmaStart,
  isStringDelimiter,
  isKeyword
} from './patterns';

/**
 * Lexer state during tokenization
 */
interface LexerState {
  /** Source code being tokenized */
  source: string;
  /** Current position in source */
  cursor: number;
  /** Current line number (1-based) */
  line: number;
  /** Current column number (1-based) */
  column: number;
}

/**
 * Creates initial lexer state
 */
function createLexerState(source: string): LexerState {
  return {
    source,
    cursor: 0,
    line: 1,
    column: 1
  };
}

/**
 * Gets the current character without advancing
 */
function peek(state: LexerState): string {
  return state.source[state.cursor] || '';
}

/**
 * Gets the next character without advancing
 */
function peekNext(state: LexerState): string {
  return state.source[state.cursor + 1] || '';
}

/**
 * Gets a character at a given offset without advancing
 */
function peekAt(state: LexerState, offset: number): string {
  return state.source[state.cursor + offset] || '';
}

/**
 * Advances the cursor and returns the current character
 */
function advance(state: LexerState): string {
  const char = state.source[state.cursor];
  state.cursor++;

  if (isNewline(char)) {
    state.line++;
    state.column = 1;
  } else {
    state.column++;
  }

  return char;
}

/**
 * Checks if we've reached the end of the source
 */
function isAtEnd(state: LexerState): boolean {
  return state.cursor >= state.source.length;
}

/**
 * Creates a token at the current position
 */
function makeToken(
  state: LexerState,
  type: TokenType,
  value: string,
  startLine: number,
  startColumn: number
): Token {
  return {
    type,
    value,
    line: startLine,
    column: startColumn
  };
}

/**
 * Skips whitespace characters
 */
function skipWhitespace(state: LexerState): void {
  while (!isAtEnd(state) && isWhitespace(peek(state))) {
    advance(state);
  }
}

/**
 * Skips a single-line comment (// ...)
 */
function skipSingleLineComment(state: LexerState): void {
  while (!isAtEnd(state) && !isNewline(peek(state))) {
    advance(state);
  }
}

/**
 * Skips a multi-line comment (/* ... *\/)
 */
function skipMultiLineComment(state: LexerState): void {
  // Skip opening /*
  advance(state);
  advance(state);

  while (!isAtEnd(state)) {
    if (peek(state) === '*' && peekNext(state) === '/') {
      advance(state);
      advance(state);
      return;
    }
    advance(state);
  }

  // Unterminated comment - but we'll let it slide
}

/**
 * Reads a string literal
 */
function readString(state: LexerState): Token {
  const startLine = state.line;
  const startColumn = state.column;

  // Skip opening quote
  advance(state);

  let value = '';
  while (!isAtEnd(state) && !isStringDelimiter(peek(state))) {
    // Handle escape sequences
    if (peek(state) === '\\' && !isAtEnd(state)) {
      advance(state);
      const escaped = advance(state);
      switch (escaped) {
        case 'n': value += '\n'; break;
        case 't': value += '\t'; break;
        case '\\': value += '\\'; break;
        case '"': value += '"'; break;
        default: value += escaped;
      }
    } else {
      value += advance(state);
    }
  }

  // Skip closing quote
  if (!isAtEnd(state)) {
    advance(state);
  }

  return makeToken(state, TokenType.STRING, value, startLine, startColumn);
}

/**
 * Reads a number (decimal or hexadecimal)
 */
function readNumber(state: LexerState): Token {
  const startLine = state.line;
  const startColumn = state.column;
  let value = '';

  // Check for hex prefix
  if (peek(state) === '0' && (peekNext(state) === 'x' || peekNext(state) === 'X')) {
    value += advance(state); // '0'
    value += advance(state); // 'x' or 'X'

    while (!isAtEnd(state) && isHexDigit(peek(state))) {
      value += advance(state);
    }
  } else {
    // Decimal number
    while (!isAtEnd(state) && isDigit(peek(state))) {
      value += advance(state);
    }
  }

  return makeToken(state, TokenType.NUMBER, value, startLine, startColumn);
}

/**
 * Reads an identifier or keyword
 */
function readIdentifier(state: LexerState): Token {
  const startLine = state.line;
  const startColumn = state.column;
  let value = '';

  while (!isAtEnd(state) && isIdentifierPart(peek(state))) {
    value += advance(state);
  }

  const type = isKeyword(value) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
  return makeToken(state, type, value, startLine, startColumn);
}

/**
 * Reads a directive (.const, .data, etc.)
 */
function readDirective(state: LexerState): Token {
  const startLine = state.line;
  const startColumn = state.column;
  let value = advance(state); // '.'

  while (!isAtEnd(state) && isIdentifierPart(peek(state))) {
    value += advance(state);
  }

  return makeToken(state, TokenType.DIRECTIVE, value, startLine, startColumn);
}

/**
 * Reads a pragma directive (#pragma ...)
 */
function readPragma(state: LexerState): Token {
  const startLine = state.line;
  const startColumn = state.column;
  let value = advance(state); // '#'

  // Read 'pragma' keyword
  while (!isAtEnd(state) && isIdentifierPart(peek(state))) {
    value += advance(state);
  }

  // Validate it's #pragma
  if (value.toLowerCase() !== '#pragma') {
    throw createError(
      `Unknown preprocessor directive '${value}'. Did you mean #pragma?`,
      startLine,
      startColumn
    );
  }

  // Skip whitespace after #pragma
  while (!isAtEnd(state) && isWhitespace(peek(state)) && !isNewline(peek(state))) {
    advance(state);
  }

  // Read pragma name (unroll, parallel, etc.)
  let pragmaName = '';
  while (!isAtEnd(state) && isIdentifierPart(peek(state))) {
    pragmaName += advance(state);
  }

  return makeToken(state, TokenType.PRAGMA, pragmaName, startLine, startColumn);
}

/**
 * Reads an operator (single or multi-character)
 */
function readOperator(state: LexerState): Token {
  const startLine = state.line;
  const startColumn = state.column;
  const char = peek(state);

  // Check for potential three-char operators (e.g., >>>)
  if (canStartMultiCharOperator(char)) {
    const threeChar = char + peekNext(state) + peekAt(state, 2);
    if (isThreeCharOperator(threeChar)) {
      advance(state);
      advance(state);
      advance(state);
      return makeToken(state, TokenType.OPERATOR, threeChar, startLine, startColumn);
    }

    // Check for potential two-char operators
    const twoChar = char + peekNext(state);
    if (isTwoCharOperator(twoChar)) {
      advance(state);
      advance(state);
      return makeToken(state, TokenType.OPERATOR, twoChar, startLine, startColumn);
    }
  }

  // Single character operator
  const value = advance(state);
  let type = TokenType.OPERATOR;

  // Special token types for specific characters
  switch (value) {
    case '{': type = TokenType.BRACE_OPEN; break;
    case '}': type = TokenType.BRACE_CLOSE; break;
    case ';': type = TokenType.SEMICOLON; break;
    case '@': type = TokenType.AT_SYMBOL; break;
    case '_': type = TokenType.UNDERSCORE; break;
  }

  return makeToken(state, type, value, startLine, startColumn);
}

/**
 * Reads the next token from the source
 */
function nextToken(state: LexerState): Token | null {
  skipWhitespace(state);

  if (isAtEnd(state)) {
    return makeToken(state, TokenType.EOF, '', state.line, state.column);
  }

  const char = peek(state);
  const nextChar = peekNext(state);

  // Comments
  if (isCommentStart(char, nextChar)) {
    if (nextChar === '/') {
      skipSingleLineComment(state);
    } else {
      skipMultiLineComment(state);
    }
    return null; // Continue to next token
  }

  // String literals
  if (isStringDelimiter(char)) {
    return readString(state);
  }

  // Directives
  if (isDirectiveStart(char)) {
    return readDirective(state);
  }

  // Pragmas
  if (isPragmaStart(char)) {
    return readPragma(state);
  }

  // Numbers
  if (isDigit(char)) {
    return readNumber(state);
  }

  // Underscore (visual NOP) - check BEFORE identifiers
  // A standalone _ is a NOP placeholder, but _foo is an identifier
  if (char === '_' && !isIdentifierPart(nextChar)) {
    advance(state);
    return makeToken(state, TokenType.UNDERSCORE, '_', state.line, state.column - 1);
  }

  // Identifiers and keywords
  if (isIdentifierStart(char)) {
    return readIdentifier(state);
  }

  // Operators and punctuation
  if (isSingleCharOperator(char) || canStartMultiCharOperator(char)) {
    return readOperator(state);
  }

  // Unknown character
  throw createError(
    `Unexpected character '${char}'`,
    state.line,
    state.column
  );
}

/**
 * Tokenizes the entire source code into an array of tokens
 *
 * @param source The DSL source code to tokenize
 * @returns Array of tokens ending with EOF
 * @throws CompilationError on lexical errors
 */
export function tokenize(source: string): Token[] {
  const state = createLexerState(source);
  const tokens: Token[] = [];

  while (true) {
    const token = nextToken(state);

    if (token === null) {
      // Comment was skipped, continue
      continue;
    }

    tokens.push(token);

    if (token.type === TokenType.EOF) {
      break;
    }
  }

  return tokens;
}

/**
 * Creates a token stream that can be iterated
 */
export function* tokenStream(source: string): Generator<Token, void, unknown> {
  const state = createLexerState(source);

  while (true) {
    const token = nextToken(state);

    if (token === null) {
      continue;
    }

    yield token;

    if (token.type === TokenType.EOF) {
      return;
    }
  }
}
