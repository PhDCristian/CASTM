/**
 * Stream Generator for OpenEdge-DSL
 *
 * Implements #pragma stream_load and #pragma stream_store:
 * Abstracts LWD/SWD streaming memory access with auto-increment pointers.
 *
 * The CGRA hardware supports per-column memory pointers that auto-increment
 * by 4 bytes after each LWD/SWD access. This pragma generates the cycle(s)
 * of LWD/SWD instructions across all columns in a row.
 *
 * Syntax:
 *   #pragma stream_load(dest=R0)                // 1 cycle, row 0, all 4 cols
 *   #pragma stream_load(dest=R0, row=2)         // 1 cycle, row 2
 *   #pragma stream_load(dest=R0, count=4)       // 4 consecutive cycles
 *   #pragma stream_store(src=R1)                // 1 cycle of SWD
 *   #pragma stream_store(src=R1, row=1, count=2) // 2 cycles on row 1
 *
 * Requires: .io_load / .io_store directives to set initial pointer addresses.
 */

import { Token, TokenType } from '../types/tokens';
import { createToken, createCycleHeader, createCycleFooter } from './control-flow-utils';
import { TokenStream } from './token-stream';

/**
 * Helper to consume an identifier-like token (IDENTIFIER or KEYWORD).
 * Needed because 'row', 'col' etc. are keywords in the lexer.
 */
function expectIdentifierOrKeyword(stream: TokenStream): string {
  const tok = stream.peek();
  if (tok.type === TokenType.IDENTIFIER || tok.type === TokenType.KEYWORD) {
    return stream.advance().value;
  }
  throw new Error(`Expected identifier, but found ${tok.type}('${tok.value}')`);
}

interface StreamLoadParams {
  destReg: string;   // Destination register (R0-R3)
  row: number;       // Target row (default 0)
  count: number;     // Number of load cycles (default 1)
  line: number;
}

interface StreamStoreParams {
  srcReg: string;    // Source register to store
  row: number;       // Target row (default 0)
  count: number;     // Number of store cycles (default 1)
  line: number;
}

/**
 * Helper: creates tokens for a row of identical instructions.
 * Generates: row N: OPCODE REG | OPCODE REG | OPCODE REG | OPCODE REG;
 */
function generateRowInstruction(
  row: number,
  opcode: string,
  reg: string,
  line: number
): Token[] {
  const tokens: Token[] = [];
  for (let col = 0; col < 4; col++) {
    // @row,col: OPCODE REG;
    tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
    tokens.push(createToken(TokenType.NUMBER, row.toString(), line));
    tokens.push(createToken(TokenType.OPERATOR, ',', line));
    tokens.push(createToken(TokenType.NUMBER, col.toString(), line));
    tokens.push(createToken(TokenType.OPERATOR, ':', line));
    tokens.push(createToken(TokenType.IDENTIFIER, opcode, line));
    tokens.push(createToken(TokenType.IDENTIFIER, reg, line));
    tokens.push(createToken(TokenType.SEMICOLON, ';', line));
  }
  return tokens;
}

/**
 * Generates tokens for #pragma stream_load.
 *
 * For each count, generates one cycle with LWD across all 4 columns:
 *   cycle {
 *     @row,0: LWD destReg;
 *     @row,1: LWD destReg;
 *     @row,2: LWD destReg;
 *     @row,3: LWD destReg;
 *   }
 *
 * Each LWD reads from memPointers[col] and auto-increments by 4 bytes.
 */
export function generateStreamLoadTokens(params: StreamLoadParams): Token[] {
  const { destReg, row, count, line } = params;
  const tokens: Token[] = [];

  for (let i = 0; i < count; i++) {
    tokens.push(...createCycleHeader(line));
    tokens.push(...generateRowInstruction(row, 'LWD', destReg, line));
    tokens.push(...createCycleFooter(line));
  }

  return tokens;
}

/**
 * Generates tokens for #pragma stream_store.
 *
 * For each count, generates one cycle with SWD across all 4 columns:
 *   cycle {
 *     @row,0: SWD srcReg;
 *     @row,1: SWD srcReg;
 *     @row,2: SWD srcReg;
 *     @row,3: SWD srcReg;
 *   }
 *
 * Each SWD writes to storePointers[col] and auto-increments by 4 bytes.
 */
export function generateStreamStoreTokens(params: StreamStoreParams): Token[] {
  const { srcReg, row, count, line } = params;
  const tokens: Token[] = [];

  for (let i = 0; i < count; i++) {
    tokens.push(...createCycleHeader(line));
    tokens.push(...generateRowInstruction(row, 'SWD', srcReg, line));
    tokens.push(...createCycleFooter(line));
  }

  return tokens;
}

/**
 * Parses #pragma stream_load arguments.
 * Syntax: #pragma stream_load(dest=R0[, row=N][, count=N])
 */
export function parseStreamLoadArgs(stream: TokenStream): {
  destReg: string;
  row: number;
  count: number;
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  // Parse dest=REG (required)
  const destKey = expectIdentifierOrKeyword(stream).toLowerCase();
  if (destKey !== 'dest') {
    throw new Error(`Expected 'dest' but got '${destKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const destReg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();

  // Optional: row=N, count=N
  let row = 0;
  let count = 1;

  while (stream.check(TokenType.OPERATOR) && stream.peek().value === ',') {
    stream.advance(); // consume ','
    const key = expectIdentifierOrKeyword(stream).toLowerCase();
    stream.expect(TokenType.OPERATOR, '=');

    if (key === 'row') {
      row = parseInt(stream.expect(TokenType.NUMBER).value, 10);
    } else if (key === 'count') {
      count = parseInt(stream.expect(TokenType.NUMBER).value, 10);
    } else {
      throw new Error(`Unknown stream_load parameter: '${key}'. Expected 'row' or 'count'`);
    }
  }

  stream.expect(TokenType.OPERATOR, ')');

  return { destReg, row, count };
}

/**
 * Parses #pragma stream_store arguments.
 * Syntax: #pragma stream_store(src=R0[, row=N][, count=N])
 */
export function parseStreamStoreArgs(stream: TokenStream): {
  srcReg: string;
  row: number;
  count: number;
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  // Parse src=REG (required)
  const srcKey = expectIdentifierOrKeyword(stream).toLowerCase();
  if (srcKey !== 'src') {
    throw new Error(`Expected 'src' but got '${srcKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const srcReg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();

  // Optional: row=N, count=N
  let row = 0;
  let count = 1;

  while (stream.check(TokenType.OPERATOR) && stream.peek().value === ',') {
    stream.advance(); // consume ','
    const key = expectIdentifierOrKeyword(stream).toLowerCase();
    stream.expect(TokenType.OPERATOR, '=');

    if (key === 'row') {
      row = parseInt(stream.expect(TokenType.NUMBER).value, 10);
    } else if (key === 'count') {
      count = parseInt(stream.expect(TokenType.NUMBER).value, 10);
    } else {
      throw new Error(`Unknown stream_store parameter: '${key}'. Expected 'row' or 'count'`);
    }
  }

  stream.expect(TokenType.OPERATOR, ')');

  return { srcReg, row, count };
}
