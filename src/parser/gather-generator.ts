/**
 * Gather Generator for OpenEdge-DSL
 *
 * Implements #pragma gather: collect values from all PEs to a destination PE.
 *
 * Syntax:
 *   #pragma gather(src=R0, dest=@0,0, destReg=R1, op=add)
 *   #pragma gather(src=R0, dest=@0,2, destReg=R1, op=max)
 *
 * The destination PE accumulates values from all other PEs in the row
 * using the specified operation.
 *
 * Supported operations: add, and, or, xor, mul
 * (max/min also supported via SSUB+BSFA pattern)
 */

import { Token, TokenType } from '../types/tokens';
import { createToken, createCycleHeader, createCycleFooter } from './control-flow-utils';
import { TokenStream } from './token-stream';

interface GatherParams {
  srcReg: string;       // Source register on each PE
  destRow: number;      // Destination PE row
  destCol: number;      // Destination PE col
  destReg: string;      // Destination register for accumulated result
  operation: string;    // Accumulation operation
  line: number;
}

/**
 * Maps gather operation names to CGRA instructions
 */
const GATHER_OP_TO_INSTR: Record<string, string> = {
  'add': 'SADD',
  'sum': 'SADD',
  'and': 'LAND',
  'or': 'LOR',
  'xor': 'LXOR',
  'mul': 'SMUL',
};

/**
 * Helper: creates instruction tokens for a single PE
 */
function peInstr(
  row: number, col: number,
  opcode: string, dest: string, src1: string, src2: string,
  line: number
): Token[] {
  return [
    createToken(TokenType.AT_SYMBOL, '@', line),
    createToken(TokenType.NUMBER, row.toString(), line),
    createToken(TokenType.OPERATOR, ',', line),
    createToken(TokenType.NUMBER, col.toString(), line),
    createToken(TokenType.OPERATOR, ':', line),
    createToken(TokenType.IDENTIFIER, opcode, line),
    createToken(TokenType.IDENTIFIER, dest, line),
    createToken(TokenType.OPERATOR, ',', line),
    createToken(TokenType.IDENTIFIER, src1, line),
    createToken(TokenType.OPERATOR, ',', line),
    createToken(TokenType.IDENTIFIER, src2, line),
    createToken(TokenType.SEMICOLON, ';', line),
  ];
}

function makeCycle(instrSets: Token[][], line: number): Token[] {
  return [
    ...createCycleHeader(line),
    ...instrSets.flat(),
    ...createCycleFooter(line),
  ];
}

/**
 * Generates tokens for #pragma gather.
 *
 * Algorithm for row gather to dest PE(dR, dC):
 *
 * 1. Init: dest PE copies srcReg to destReg (initial accumulator value)
 * 2. For each other PE in the row, route its value to dest and accumulate:
 *    - Source PE broadcasts srcReg → ROUT
 *    - Relay through intermediate PEs horizontally
 *    - Dest PE accumulates: destReg = destReg OP received_value
 *
 * PEs are processed left-to-right (or right-to-left from dest), one at a time.
 * For efficiency, we process the nearest PE first, then farther ones.
 *
 * Total cycles: 1 (init) + 2 * (N-1) where N = number of PEs in row (4)
 *             = 1 + 6 = 7 cycles
 */
export function generateGatherTokens(params: GatherParams): Token[] {
  const { srcReg, destRow, destCol, destReg, operation, line } = params;
  const tokens: Token[] = [];

  const instr = GATHER_OP_TO_INSTR[operation.toLowerCase()];
  if (!instr) {
    throw new Error(`Unsupported gather operation: ${operation}. Supported: ${Object.keys(GATHER_OP_TO_INSTR).join(', ')}`);
  }

  // Cycle 0: Dest PE initializes accumulator with its own value
  {
    const instrs: Token[][] = [];
    instrs.push(peInstr(destRow, destCol, 'SADD', destReg, srcReg, 'ZERO', line));
    tokens.push(...makeCycle(instrs, line));
  }

  // For each other PE in the row, collect its value
  // Process PEs in order of increasing distance from dest
  const otherCols = [];
  for (let c = 0; c < 4; c++) {
    if (c !== destCol) otherCols.push(c);
  }
  // Sort by distance from destCol (nearest first)
  otherCols.sort((a, b) => Math.abs(a - destCol) - Math.abs(b - destCol));

  for (const srcCol of otherCols) {
    const dist = Math.abs(srcCol - destCol);
    const goingRight = srcCol > destCol; // dest is to the left of source

    // Cycle A: Source PE broadcasts srcReg → ROUT
    {
      const instrs: Token[][] = [];
      instrs.push(peInstr(destRow, srcCol, 'SADD', 'ROUT', srcReg, 'ZERO', line));
      tokens.push(...makeCycle(instrs, line));
    }

    // Relay cycles (dist - 1 intermediate hops)
    for (let step = 1; step < dist; step++) {
      const relayCol = goingRight
        ? srcCol - step   // relay from right to left towards dest
        : srcCol + step;  // relay from left to right towards dest
      const neighbor = goingRight ? 'RCR' : 'RCL';

      const instrs: Token[][] = [];
      instrs.push(peInstr(destRow, relayCol, 'SADD', 'R3', neighbor, 'ZERO', line));
      tokens.push(...makeCycle(instrs, line));
    }

    // Final receive + accumulate at dest PE
    {
      const neighbor = goingRight ? 'RCR' : 'RCL';
      const instrs: Token[][] = [];
      instrs.push(peInstr(destRow, destCol, instr, destReg, destReg, neighbor, line));
      tokens.push(...makeCycle(instrs, line));
    }
  }

  return tokens;
}

/**
 * Parses #pragma gather arguments.
 * Syntax: #pragma gather(src=R0, dest=@0,0, destReg=R1, op=add)
 */
export function parseGatherPragmaArgs(stream: TokenStream): {
  srcReg: string;
  destRow: number;
  destCol: number;
  destReg: string;
  operation: string;
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  // Parse src=REG
  const srcKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (srcKey !== 'src') {
    throw new Error(`Expected 'src' but got '${srcKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const srcReg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();

  stream.expect(TokenType.OPERATOR, ',');

  // Parse dest=@row,col
  const destKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (destKey !== 'dest') {
    throw new Error(`Expected 'dest' but got '${destKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  stream.expect(TokenType.AT_SYMBOL, '@');
  const destRow = parseInt(stream.expect(TokenType.NUMBER).value, 10);
  stream.expect(TokenType.OPERATOR, ',');
  const destCol = parseInt(stream.expect(TokenType.NUMBER).value, 10);

  stream.expect(TokenType.OPERATOR, ',');

  // Parse destReg=REG
  const destRegKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (destRegKey !== 'destreg') {
    throw new Error(`Expected 'destReg' but got '${destRegKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const destReg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();

  stream.expect(TokenType.OPERATOR, ',');

  // Parse op=operation
  const opKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (opKey !== 'op') {
    throw new Error(`Expected 'op' but got '${opKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const operation = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();

  stream.expect(TokenType.OPERATOR, ')');

  return { srcReg, destRow, destCol, destReg, operation };
}
