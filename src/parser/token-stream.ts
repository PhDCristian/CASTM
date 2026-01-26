/**
 * OpenEdge-DSL Token Stream
 *
 * Provides a cursor-based abstraction over the token array for parsing.
 */

import { Token, TokenType } from '../types/tokens';
import { createError, CompilationError } from '../types/errors';

/**
 * Token stream for parsing operations
 */
export class TokenStream {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Returns the current position in the stream
   */
  get position(): number {
    return this.current;
  }

  /**
   * Sets the current position in the stream
   */
  set position(pos: number) {
    this.current = pos;
  }

  /**
   * Returns the current token without advancing
   */
  peek(): Token {
    return this.tokens[this.current] || this.createEofToken();
  }

  /**
   * Returns the token at offset from current position
   */
  peekAhead(offset: number = 1): Token {
    return this.tokens[this.current + offset] || this.createEofToken();
  }

  /**
   * Advances and returns the current token
   */
  advance(): Token {
    if (!this.isAtEnd()) {
      return this.tokens[this.current++];
    }
    return this.peek();
  }

  /**
   * Checks if we've reached the end of the stream
   */
  isAtEnd(): boolean {
    return this.current >= this.tokens.length ||
           this.tokens[this.current].type === TokenType.EOF;
  }

  /**
   * Checks if the current token matches the given type and optional value
   */
  check(type: TokenType, value?: string): boolean {
    const token = this.peek();
    if (token.type !== type) return false;
    if (value !== undefined && token.value.toLowerCase() !== value.toLowerCase()) {
      return false;
    }
    return true;
  }

  /**
   * If current token matches, advance and return it; otherwise return null
   */
  match(type: TokenType, value?: string): Token | null {
    if (this.check(type, value)) {
      return this.advance();
    }
    return null;
  }

  /**
   * Expects the current token to match; throws if not
   */
  expect(type: TokenType, value?: string): Token {
    const token = this.match(type, value);
    if (!token) {
      const expected = value ? `${TokenType[type]}('${value}')` : TokenType[type];
      const actual = this.peek();
      const actualDesc = `${TokenType[actual.type]}('${actual.value}')`;
      throw createError(
        `Expected ${expected}, but found ${actualDesc}`,
        actual.line,
        actual.column
      );
    }
    return token;
  }

  /**
   * Skips tokens until a matching type is found
   */
  skipUntil(type: TokenType, value?: string): void {
    while (!this.isAtEnd() && !this.check(type, value)) {
      this.advance();
    }
  }

  /**
   * Collects tokens until a condition is met
   */
  collectUntil(predicate: (token: Token) => boolean): Token[] {
    const collected: Token[] = [];
    while (!this.isAtEnd() && !predicate(this.peek())) {
      collected.push(this.advance());
    }
    return collected;
  }

  /**
   * Collects tokens matching balanced braces
   */
  collectBraced(): Token[] {
    const collected: Token[] = [];
    let braceCount = 1;

    // Expect opening brace was already consumed
    while (braceCount > 0 && !this.isAtEnd()) {
      const token = this.advance();
      if (token.type === TokenType.BRACE_OPEN) braceCount++;
      if (token.type === TokenType.BRACE_CLOSE) braceCount--;
      if (braceCount > 0) {
        collected.push(token);
      }
    }

    return collected;
  }

  /**
   * Collects tokens matching balanced parentheses
   */
  collectParenthesized(): Token[] {
    const collected: Token[] = [];
    let parenCount = 1;

    while (parenCount > 0 && !this.isAtEnd()) {
      const token = this.advance();
      if (token.value === '(') parenCount++;
      if (token.value === ')') parenCount--;
      if (parenCount > 0) {
        collected.push(token);
      }
    }

    return collected;
  }

  /**
   * Inserts tokens at the current position
   */
  insertTokens(tokens: Token[]): void {
    this.tokens.splice(this.current, 0, ...tokens);
  }

  /**
   * Creates a snapshot of the current position
   */
  snapshot(): number {
    return this.current;
  }

  /**
   * Restores a previously saved position
   */
  restore(position: number): void {
    this.current = position;
  }

  /**
   * Returns a slice of tokens from start to current position
   */
  slice(start: number): Token[] {
    return this.tokens.slice(start, this.current);
  }

  /**
   * Returns all remaining tokens
   */
  remaining(): Token[] {
    return this.tokens.slice(this.current);
  }

  /**
   * Gets the line number of the current token
   */
  get line(): number {
    return this.peek().line;
  }

  /**
   * Gets the column number of the current token
   */
  get column(): number {
    return this.peek().column;
  }

  private createEofToken(): Token {
    const lastToken = this.tokens[this.tokens.length - 1];
    return {
      type: TokenType.EOF,
      value: '',
      line: lastToken?.line ?? 1,
      column: lastToken?.column ?? 1
    };
  }
}

/**
 * Creates a token stream from an array of tokens
 */
export function createTokenStream(tokens: Token[]): TokenStream {
  return new TokenStream(tokens);
}
