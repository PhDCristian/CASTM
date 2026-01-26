/**
 * OpenEdge-DSL Token Types
 *
 * Defines the lexical tokens produced by the lexer.
 */

/**
 * Token type enumeration for the DSL lexer
 */
export enum TokenType {
  /** DSL keywords: kernel, config, cycle, row, col, for, in, range, while, function, if, else */
  KEYWORD = 'KEYWORD',
  /** Directives: .const, .alias, .data, .io_load, .io_store, .limit, .assert */
  DIRECTIVE = 'DIRECTIVE',
  /** Pragma directives: #pragma unroll, #pragma parallel, etc. */
  PRAGMA = 'PRAGMA',
  /** Identifiers: variable names, register names, labels */
  IDENTIFIER = 'IDENTIFIER',
  /** Numeric literals: decimal (100) or hexadecimal (0xF) */
  NUMBER = 'NUMBER',
  /** String literals: "kernel name" */
  STRING = 'STRING',
  /** Operators: + - * / : | , = == != < > <= >= ( ) [ ] */
  OPERATOR = 'OPERATOR',
  /** Opening brace { */
  BRACE_OPEN = 'BRACE_OPEN',
  /** Closing brace } */
  BRACE_CLOSE = 'BRACE_CLOSE',
  /** Semicolon ; */
  SEMICOLON = 'SEMICOLON',
  /** Underscore _ (visual NOP placeholder) */
  UNDERSCORE = 'UNDERSCORE',
  /** At symbol @ (coordinate prefix) */
  AT_SYMBOL = 'AT_SYMBOL',
  /** Comment (single-line // or multi-line /* *\/) */
  COMMENT = 'COMMENT',
  /** End of file marker */
  EOF = 'EOF'
}

/**
 * Represents a single lexical token with position information
 */
export interface Token {
  /** The type of this token */
  type: TokenType;
  /** The textual value of the token */
  value: string;
  /** Line number (1-based) where the token starts */
  line: number;
  /** Column number (1-based) where the token starts */
  column: number;
}

/**
 * DSL reserved keywords
 */
export const DSL_KEYWORDS = [
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
  'else'
] as const;

/**
 * DSL directive names (without the leading dot)
 */
export const DSL_DIRECTIVES = [
  'const',
  'alias',
  'data',
  'io_load',
  'io_store',
  'limit',
  'assert'
] as const;

/**
 * DSL pragma names (without the leading #pragma)
 */
export const DSL_PRAGMAS = [
  'unroll',
  'no_unroll',
  'inline',
  'no_fuse',
  'parallel',
  'reduce',
  'stencil'
] as const;

export type DslKeyword = typeof DSL_KEYWORDS[number];
export type DslDirective = typeof DSL_DIRECTIVES[number];
export type DslPragma = typeof DSL_PRAGMAS[number];
