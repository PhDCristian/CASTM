/**
 * OpenEdge-DSL Pattern Generators
 *
 * Generates tokens for high-level patterns like #pragma reduce and #pragma stencil.
 * These patterns expand into multiple cycles with specific PE arrangements.
 */

import { Token, TokenType } from '../types/tokens';

/**
 * Creates a token with minimal position info
 */
function tok(type: TokenType, value: string, line: number): Token {
  return { type, value, line, column: 1 };
}

/**
 * Creates tokens for a visual row instruction
 * Format: row N: instr0 | instr1 | instr2 | instr3;
 */
function createRowTokens(
  row: number,
  instructions: Array<{ opcode: string; operands?: string[] }>,
  line: number
): Token[] {
  const tokens: Token[] = [
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, row.toString(), line),
    tok(TokenType.OPERATOR, ':', line)
  ];

  instructions.forEach((instr, col) => {
    if (col > 0) {
      tokens.push(tok(TokenType.OPERATOR, '|', line));
    }
    tokens.push(tok(TokenType.IDENTIFIER, instr.opcode, line));
    if (instr.operands) {
      instr.operands.forEach((op, i) => {
        if (i === 0 || i > 0) {
          // First operand comes right after opcode, others after comma
          if (i > 0) tokens.push(tok(TokenType.OPERATOR, ',', line));
        }
        tokens.push(tok(TokenType.IDENTIFIER, op, line));
        if (i < instr.operands!.length - 1) {
          tokens.push(tok(TokenType.OPERATOR, ',', line));
        }
      });
    }
  });

  tokens.push(tok(TokenType.SEMICOLON, ';', line));
  return tokens;
}

/**
 * Wraps row tokens in a cycle block
 */
function wrapInCycle(rowTokens: Token[], line: number): Token[] {
  return [
    tok(TokenType.KEYWORD, 'cycle', line),
    tok(TokenType.BRACE_OPEN, '{', line),
    ...rowTokens,
    tok(TokenType.BRACE_CLOSE, '}', line)
  ];
}

// ==========================================
// Reduce Pattern Generator
// ==========================================

/**
 * Maps reduce operation names to CGRA instructions
 */
const REDUCE_OP_TO_INSTR: Record<string, string> = {
  'sum': 'SADD',
  'add': 'SADD',
  'and': 'LAND',
  'or': 'LOR',
  'xor': 'LXOR',
  'max': 'MAX_REDUCE',
  'min': 'MIN_REDUCE'
};

/**
 * Generates tokens for tree reduction pattern
 *
 * Tree reduction for 4-column grid:
 * - Step 1: Pairwise reduction (Col 0 += Col 1, Col 2 += Col 3)
 * - Step 2: Relay Col 2's result through Col 1
 * - Step 3: Final reduction (Col 0 += relayed value)
 *
 * @param operation - Reduction operation (sum, and, or, max, min)
 * @param srcReg - Source register containing values to reduce
 * @param destReg - Destination register for result
 * @param line - Source line number for error reporting
 */
export function generateReduceTokens(
  operation: string,
  srcReg: string,
  destReg: string,
  line: number
): Token[] {
  const tokens: Token[] = [];
  const instr = REDUCE_OP_TO_INSTR[operation.toLowerCase()] || 'SADD';
  const isCompare = operation === 'max' || operation === 'min';

  if (!isCompare) {
    // Simple operations (sum, and, or) - direct tree reduction
    tokens.push(...generateSimpleReduceTokens(instr, srcReg, destReg, line));
  } else {
    // Compare operations (max, min) - BSFA-based pattern
    tokens.push(...generateCompareReduceTokens(operation, srcReg, destReg, line));
  }

  return tokens;
}

/**
 * Generates simple tree reduction (sum, and, or)
 */
function generateSimpleReduceTokens(
  instr: string,
  srcReg: string,
  destReg: string,
  line: number
): Token[] {
  const tokens: Token[] = [];

  // Cycle 1: Pairwise reduction
  // Col 0: R2 = srcReg + Col1.srcReg (via RCR)
  // Col 2: R2 = srcReg + Col3.srcReg (via RCR)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    // Col 0
    tok(TokenType.IDENTIFIER, instr, line),
    tok(TokenType.IDENTIFIER, 'R2', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, srcReg, line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'RCR', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 1: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 2
    tok(TokenType.IDENTIFIER, instr, line),
    tok(TokenType.IDENTIFIER, 'R2', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, srcReg, line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'RCR', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 3: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 2: Relay Col 2's result through Col 1
  // Col 1: R3 = Col2.R2 (via RCR)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    // Col 0: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 1: relay
    tok(TokenType.IDENTIFIER, 'SADD', line),
    tok(TokenType.IDENTIFIER, 'R3', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'RCR', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'ZERO', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 2: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 3: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 3: Final reduction
  // Col 0: destReg = R2 + Col1.R3 (via RCR)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    // Col 0: final add
    tok(TokenType.IDENTIFIER, instr, line),
    tok(TokenType.IDENTIFIER, destReg, line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'R2', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'RCR', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 1: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 2: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 3: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  return tokens;
}

/**
 * Generates compare-based reduction (max, min) using BSFA
 */
function generateCompareReduceTokens(
  operation: string,
  srcReg: string,
  destReg: string,
  line: number
): Token[] {
  const tokens: Token[] = [];

  // For max: select larger (SSUB A-B, if S=0 then A>=B)
  // For min: select smaller (SSUB A-B, if S=1 then A<B)
  const bselectFirst = operation === 'max' ? srcReg : 'RCR';
  const bselectSecond = operation === 'max' ? 'RCR' : srcReg;

  // Step 1a: Compare (sets flags)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    // All columns: SSUB R2, srcReg, RCR
    ...[0, 1, 2, 3].flatMap((c, i) => [
      ...(i > 0 ? [tok(TokenType.OPERATOR, '|', line)] : []),
      tok(TokenType.IDENTIFIER, 'SSUB', line),
      tok(TokenType.IDENTIFIER, 'R2', line),
      tok(TokenType.OPERATOR, ',', line),
      tok(TokenType.IDENTIFIER, srcReg, line),
      tok(TokenType.OPERATOR, ',', line),
      tok(TokenType.IDENTIFIER, 'RCR', line)
    ]),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Step 1b: Select based on flags (Col 0 and Col 2)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    // Col 0: BSFA
    tok(TokenType.IDENTIFIER, 'BSFA', line),
    tok(TokenType.IDENTIFIER, 'R2', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, bselectFirst, line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, bselectSecond, line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'SELF', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 1: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 2: BSFA
    tok(TokenType.IDENTIFIER, 'BSFA', line),
    tok(TokenType.IDENTIFIER, 'R2', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, bselectFirst, line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, bselectSecond, line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'SELF', line),
    tok(TokenType.OPERATOR, '|', line),
    // Col 3: NOP
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 2: Relay Col 2's result
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'SADD', line),
    tok(TokenType.IDENTIFIER, 'R3', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'RCR', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'ZERO', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 3: Compare Col 0's R2 with relayed value
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    tok(TokenType.IDENTIFIER, 'SSUB', line),
    tok(TokenType.IDENTIFIER, 'R3', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'R2', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'RCR', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 4: Final select
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    tok(TokenType.IDENTIFIER, 'BSFA', line),
    tok(TokenType.IDENTIFIER, destReg, line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'R2', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'RCR', line),
    tok(TokenType.OPERATOR, ',', line),
    tok(TokenType.IDENTIFIER, 'SELF', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.OPERATOR, '|', line),
    tok(TokenType.IDENTIFIER, 'NOP', line),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  return tokens;
}

// ==========================================
// Stencil Pattern Generator
// ==========================================

/**
 * Stencil patterns
 */
export type StencilPattern = 'cross' | 'horizontal' | 'vertical';

/**
 * Generates tokens for stencil computation pattern
 *
 * Stencil patterns apply operations across neighbor values:
 * - cross: center + top + bottom + left + right (5-point)
 * - horizontal: center + left + right (3-point)
 * - vertical: center + top + bottom (3-point)
 *
 * @param pattern - Stencil pattern type
 * @param operation - Operation (sum, avg)
 * @param srcReg - Source register
 * @param destReg - Destination register
 * @param line - Source line number
 */
export function generateStencilTokens(
  pattern: string,
  operation: string,
  srcReg: string,
  destReg: string,
  line: number
): Token[] {
  const tokens: Token[] = [];

  // Map operation to instruction
  const instr = operation === 'sum' || operation === 'add' ? 'SADD' : 'SADD';

  switch (pattern.toLowerCase()) {
    case 'cross':
      tokens.push(...generateCrossStencil(instr, srcReg, destReg, line));
      break;
    case 'horizontal':
      tokens.push(...generateHorizontalStencil(instr, srcReg, destReg, line));
      break;
    case 'vertical':
      tokens.push(...generateVerticalStencil(instr, srcReg, destReg, line));
      break;
    default:
      throw { message: `Unknown stencil pattern: ${pattern}`, line };
  }

  return tokens;
}

/**
 * Generates cross (5-point) stencil: center + top + bottom + left + right
 */
function generateCrossStencil(
  instr: string,
  srcReg: string,
  destReg: string,
  line: number
): Token[] {
  const tokens: Token[] = [];

  // Create instruction for all columns
  const makeAllColsInstr = (dest: string, srcA: string, srcB: string) => {
    const colTokens: Token[] = [];
    for (let c = 0; c < 4; c++) {
      if (c > 0) colTokens.push(tok(TokenType.OPERATOR, '|', line));
      colTokens.push(
        tok(TokenType.IDENTIFIER, instr, line),
        tok(TokenType.IDENTIFIER, dest, line),
        tok(TokenType.OPERATOR, ',', line),
        tok(TokenType.IDENTIFIER, srcA, line),
        tok(TokenType.OPERATOR, ',', line),
        tok(TokenType.IDENTIFIER, srcB, line)
      );
    }
    return colTokens;
  };

  // Cycle 1: R2 = srcReg + RCT (add top)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    ...makeAllColsInstr('R2', srcReg, 'RCT'),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 2: R2 = R2 + RCB (add bottom)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    ...makeAllColsInstr('R2', 'R2', 'RCB'),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 3: R2 = R2 + RCL (add left)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    ...makeAllColsInstr('R2', 'R2', 'RCL'),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 4: destReg = R2 + RCR (add right)
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    ...makeAllColsInstr(destReg, 'R2', 'RCR'),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  return tokens;
}

/**
 * Generates horizontal (3-point) stencil: center + left + right
 */
function generateHorizontalStencil(
  instr: string,
  srcReg: string,
  destReg: string,
  line: number
): Token[] {
  const tokens: Token[] = [];

  const makeAllColsInstr = (dest: string, srcA: string, srcB: string) => {
    const colTokens: Token[] = [];
    for (let c = 0; c < 4; c++) {
      if (c > 0) colTokens.push(tok(TokenType.OPERATOR, '|', line));
      colTokens.push(
        tok(TokenType.IDENTIFIER, instr, line),
        tok(TokenType.IDENTIFIER, dest, line),
        tok(TokenType.OPERATOR, ',', line),
        tok(TokenType.IDENTIFIER, srcA, line),
        tok(TokenType.OPERATOR, ',', line),
        tok(TokenType.IDENTIFIER, srcB, line)
      );
    }
    return colTokens;
  };

  // Cycle 1: R2 = srcReg + RCL
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    ...makeAllColsInstr('R2', srcReg, 'RCL'),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 2: destReg = R2 + RCR
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    ...makeAllColsInstr(destReg, 'R2', 'RCR'),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  return tokens;
}

/**
 * Generates vertical (3-point) stencil: center + top + bottom
 */
function generateVerticalStencil(
  instr: string,
  srcReg: string,
  destReg: string,
  line: number
): Token[] {
  const tokens: Token[] = [];

  const makeAllColsInstr = (dest: string, srcA: string, srcB: string) => {
    const colTokens: Token[] = [];
    for (let c = 0; c < 4; c++) {
      if (c > 0) colTokens.push(tok(TokenType.OPERATOR, '|', line));
      colTokens.push(
        tok(TokenType.IDENTIFIER, instr, line),
        tok(TokenType.IDENTIFIER, dest, line),
        tok(TokenType.OPERATOR, ',', line),
        tok(TokenType.IDENTIFIER, srcA, line),
        tok(TokenType.OPERATOR, ',', line),
        tok(TokenType.IDENTIFIER, srcB, line)
      );
    }
    return colTokens;
  };

  // Cycle 1: R2 = srcReg + RCT
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    ...makeAllColsInstr('R2', srcReg, 'RCT'),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  // Cycle 2: destReg = R2 + RCB
  tokens.push(...wrapInCycle([
    tok(TokenType.KEYWORD, 'row', line),
    tok(TokenType.NUMBER, '0', line),
    tok(TokenType.OPERATOR, ':', line),
    ...makeAllColsInstr(destReg, 'R2', 'RCB'),
    tok(TokenType.SEMICOLON, ';', line)
  ], line));

  return tokens;
}
