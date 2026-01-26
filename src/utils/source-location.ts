/**
 * OpenEdge-DSL Source Location Utilities
 *
 * Helpers for tracking and converting source positions.
 */

import { SourceRange } from '../types/errors';
import { Token } from '../types/tokens';

/**
 * Represents a position in source code
 */
export interface SourcePosition {
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Absolute offset from start of source (0-based) */
  offset: number;
}

/**
 * Tracks source position while iterating through code
 */
export class SourceTracker {
  private line: number = 1;
  private column: number = 1;
  private offset: number = 0;

  /**
   * Gets the current position
   */
  getPosition(): SourcePosition {
    return {
      line: this.line,
      column: this.column,
      offset: this.offset
    };
  }

  /**
   * Advances the position by one character
   * @param char The character being advanced past
   */
  advance(char: string): void {
    this.offset++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
  }

  /**
   * Advances the position by multiple characters
   * @param str The string being advanced past
   */
  advanceString(str: string): void {
    for (const char of str) {
      this.advance(char);
    }
  }

  /**
   * Resets the tracker to the beginning
   */
  reset(): void {
    this.line = 1;
    this.column = 1;
    this.offset = 0;
  }
}

/**
 * Creates a source range from a token
 */
export function tokenToRange(token: Token): SourceRange {
  const endColumn = token.column + token.value.length;
  return {
    startLine: token.line,
    startColumn: token.column,
    endLine: token.line,
    endColumn
  };
}

/**
 * Creates a source range spanning multiple tokens
 */
export function tokensToRange(startToken: Token, endToken: Token): SourceRange {
  return {
    startLine: startToken.line,
    startColumn: startToken.column,
    endLine: endToken.line,
    endColumn: endToken.column + endToken.value.length
  };
}

/**
 * Expands a range to include another range
 */
export function expandRange(range: SourceRange, other: SourceRange): SourceRange {
  return {
    startLine: Math.min(range.startLine, other.startLine),
    startColumn: range.startLine < other.startLine
      ? range.startColumn
      : (range.startLine > other.startLine ? other.startColumn : Math.min(range.startColumn, other.startColumn)),
    endLine: Math.max(range.endLine, other.endLine),
    endColumn: range.endLine > other.endLine
      ? range.endColumn
      : (range.endLine < other.endLine ? other.endColumn : Math.max(range.endColumn, other.endColumn))
  };
}

/**
 * Checks if a position is within a range
 */
export function isPositionInRange(line: number, column: number, range: SourceRange): boolean {
  if (line < range.startLine || line > range.endLine) {
    return false;
  }
  if (line === range.startLine && column < range.startColumn) {
    return false;
  }
  if (line === range.endLine && column >= range.endColumn) {
    return false;
  }
  return true;
}

/**
 * Converts an offset to line and column using a source string
 */
export function offsetToPosition(source: string, offset: number): SourcePosition {
  let line = 1;
  let column = 1;
  let currentOffset = 0;

  for (let i = 0; i < source.length && i < offset; i++) {
    if (source[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    currentOffset++;
  }

  return { line, column, offset: currentOffset };
}

/**
 * Converts line and column to an offset using a source string
 */
export function positionToOffset(source: string, line: number, column: number): number {
  let currentLine = 1;
  let currentColumn = 1;

  for (let i = 0; i < source.length; i++) {
    if (currentLine === line && currentColumn === column) {
      return i;
    }

    if (source[i] === '\n') {
      currentLine++;
      currentColumn = 1;
    } else {
      currentColumn++;
    }
  }

  return source.length;
}

/**
 * Gets a snippet of source code around a position
 */
export function getSourceSnippet(
  source: string,
  line: number,
  contextLines: number = 2
): string {
  const lines = source.split('\n');
  const startLine = Math.max(1, line - contextLines);
  const endLine = Math.min(lines.length, line + contextLines);

  const snippetLines: string[] = [];
  for (let i = startLine; i <= endLine; i++) {
    const lineNum = i.toString().padStart(4, ' ');
    const marker = i === line ? '>' : ' ';
    snippetLines.push(`${marker}${lineNum} | ${lines[i - 1]}`);
  }

  return snippetLines.join('\n');
}
