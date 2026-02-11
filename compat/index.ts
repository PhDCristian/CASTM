import { tokenizeSource, type FrontToken } from '@openedge/compiler-front';

export enum TokenType {
  KEYWORD = 'keyword',
  IDENTIFIER = 'identifier',
  NUMBER = 'number',
  STRING = 'string',
  OPERATOR = 'operator',
  DIRECTIVE = 'directive',
  PRAGMA = 'pragma',
  SYMBOL = 'symbol',
  AT_SYMBOL = 'at_symbol'
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export interface Assertion {
  cycle: number;
  row: number;
  col: number;
  register: string;
  value: number;
}

const KEYWORDS = new Set([
  'target',
  'kernel',
  'config',
  'cycle',
  'row',
  'col',
  'all',
  'if',
  'else',
  'for',
  'in',
  'range',
  'while',
  'function',
  'nop',
  'exit'
]);

function toCompatTokenType(token: FrontToken): TokenType {
  if (token.value === '@') return TokenType.AT_SYMBOL;

  switch (token.type) {
    case 'number':
      return TokenType.NUMBER;
    case 'string':
      return TokenType.STRING;
    case 'operator':
      return TokenType.OPERATOR;
    case 'directive':
      return TokenType.DIRECTIVE;
    case 'pragma':
      return TokenType.PRAGMA;
    case 'identifier':
      return KEYWORDS.has(token.value.toLowerCase())
        ? TokenType.KEYWORD
        : TokenType.IDENTIFIER;
    default:
      return TokenType.SYMBOL;
  }
}

export function tokenize(source: string): Token[] {
  return tokenizeSource(source).map((token) => ({
    type: toCompatTokenType(token),
    value: token.value,
    line: token.line,
    column: token.column
  }));
}
