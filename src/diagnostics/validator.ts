/**
 * OpenEdge-DSL Validator
 *
 * Performs static analysis on DSL code to detect errors and warnings.
 */

import { Token, TokenType } from '../types/tokens';
import {
  Diagnostic,
  DiagnosticSeverity,
  createDiagnostic,
  ErrorCodes
} from '../types/errors';
import { SymbolTable } from '../types/symbols';

/**
 * Grid configuration for bounds checking
 */
export interface GridBounds {
  width: number;
  height: number;
}

/**
 * Valid register names
 */
export const VALID_REGISTERS = ['R0', 'R1', 'R2', 'R3', 'ROUT', 'ZERO'];

/**
 * Valid neighbor references
 */
export const VALID_NEIGHBORS = ['SELF', 'RCL', 'RCR', 'RCT', 'RCB', 'PREV'];

/**
 * Valid instruction opcodes (subset - full list in constants.ts)
 */
export const VALID_OPCODES = [
  // Control
  'NOP', 'EXIT',
  // ALU
  'SADD', 'SSUB', 'SMUL', 'FXPMUL',
  // Logic
  'LAND', 'LOR', 'LXOR', 'LNAND', 'LNOR', 'LXNOR',
  // Shift
  'SLT', 'SRT', 'SRA',
  // Memory
  'LWD', 'SWD', 'LWI', 'SWI',
  // Branch
  'BSFA', 'BZFA', 'BEQ', 'BNE', 'BLT', 'BGE', 'JUMP',
  // Debug
  'PRINT', 'CHECK', 'ASSERT', 'CHECKPOINT', 'OUTPUT',
  // Immediate
  'IMM'
];

/**
 * Validates tokens and returns diagnostics
 */
export function validateTokens(
  tokens: Token[],
  gridBounds: GridBounds,
  symbols?: SymbolTable
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];

    // 1. Check Row/Col bounds in row/col syntax
    if (token.type === TokenType.KEYWORD) {
      if (token.value.toLowerCase() === 'row' && nextToken?.type === TokenType.NUMBER) {
        const rowNum = parseInt(nextToken.value, 10);
        if (rowNum >= gridBounds.height) {
          diagnostics.push(createDiagnostic(
            `Row index ${rowNum} exceeds grid height (${gridBounds.height})`,
            nextToken.line,
            nextToken.column,
            nextToken.line,
            nextToken.column + nextToken.value.length,
            DiagnosticSeverity.Error,
            ErrorCodes.INVALID_OPERAND
          ));
        }
      } else if (token.value.toLowerCase() === 'col' && nextToken?.type === TokenType.NUMBER) {
        const colNum = parseInt(nextToken.value, 10);
        if (colNum >= gridBounds.width) {
          diagnostics.push(createDiagnostic(
            `Column index ${colNum} exceeds grid width (${gridBounds.width})`,
            nextToken.line,
            nextToken.column,
            nextToken.line,
            nextToken.column + nextToken.value.length,
            DiagnosticSeverity.Error,
            ErrorCodes.INVALID_OPERAND
          ));
        }
      }
    }

    // 2. Check @row,col: coordinate syntax (C convention)
    if (token.type === TokenType.AT_SYMBOL && nextToken?.type === TokenType.NUMBER) {
      const rowNum = parseInt(nextToken.value, 10);
      if (rowNum >= gridBounds.height) {
        diagnostics.push(createDiagnostic(
          `Row index ${rowNum} exceeds grid height (${gridBounds.height})`,
          nextToken.line,
          nextToken.column,
          nextToken.line,
          nextToken.column + nextToken.value.length,
          DiagnosticSeverity.Error,
          ErrorCodes.INVALID_OPERAND
        ));
      }

      // Check col after comma
      if (tokens[i + 2]?.value === ',' && tokens[i + 3]?.type === TokenType.NUMBER) {
        const colToken = tokens[i + 3];
        const colNum = parseInt(colToken.value, 10);
        if (colNum >= gridBounds.width) {
          diagnostics.push(createDiagnostic(
            `Column index ${colNum} exceeds grid width (${gridBounds.width})`,
            colToken.line,
            colToken.column,
            colToken.line,
            colToken.column + colToken.value.length,
            DiagnosticSeverity.Error,
            ErrorCodes.INVALID_OPERAND
          ));
        }
      }
    }

    // 3. Check register validity
    if (token.type === TokenType.IDENTIFIER) {
      const upperValue = token.value.toUpperCase();

      // Check if it looks like a register but isn't valid
      if (upperValue.match(/^R\d+$/)) {
        if (!VALID_REGISTERS.includes(upperValue)) {
          diagnostics.push(createDiagnostic(
            `Invalid register '${token.value}'. Valid registers: ${VALID_REGISTERS.join(', ')}`,
            token.line,
            token.column,
            token.line,
            token.column + token.value.length,
            DiagnosticSeverity.Error,
            ErrorCodes.INVALID_REGISTER
          ));
        }
      }
    }

    // 4. Check for undefined arrays (if symbols provided)
    if (symbols && token.type === TokenType.IDENTIFIER && tokens[i + 1]?.value === '[') {
      const arrayName = token.value;
      if (arrayName !== 'data' && !symbols.namedArrays.has(arrayName)) {
        diagnostics.push(createDiagnostic(
          `Undefined array '${arrayName}'`,
          token.line,
          token.column,
          token.line,
          token.column + token.value.length,
          DiagnosticSeverity.Error,
          ErrorCodes.UNDEFINED_ARRAY
        ));
      }
    }
  }

  return diagnostics;
}

/**
 * Validates that required structures are present
 */
export function validateStructure(tokens: Token[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  let hasKernel = false;
  let hasConfig = false;

  for (const token of tokens) {
    if (token.type === TokenType.KEYWORD) {
      if (token.value.toLowerCase() === 'kernel') hasKernel = true;
      if (token.value.toLowerCase() === 'config') hasConfig = true;
    }
  }

  if (!hasKernel) {
    diagnostics.push(createDiagnostic(
      'Missing kernel declaration',
      1, 1, 1, 1,
      DiagnosticSeverity.Error,
      ErrorCodes.MISSING_KERNEL
    ));
  }

  if (hasKernel && !hasConfig) {
    diagnostics.push(createDiagnostic(
      'Missing config statement in kernel',
      1, 1, 1, 1,
      DiagnosticSeverity.Warning,
      ErrorCodes.MISSING_CONFIG
    ));
  }

  return diagnostics;
}

/**
 * Checks if a string is a valid opcode
 */
export function isValidOpcode(name: string): boolean {
  return VALID_OPCODES.includes(name.toUpperCase());
}

/**
 * Checks if a string is a valid register
 */
export function isValidRegister(name: string): boolean {
  return VALID_REGISTERS.includes(name.toUpperCase());
}

/**
 * Checks if a string is a valid neighbor reference
 */
export function isValidNeighbor(name: string): boolean {
  return VALID_NEIGHBORS.includes(name.toUpperCase());
}

/**
 * Suggests similar identifiers for typos
 */
export function suggestSimilar(
  name: string,
  validNames: string[]
): string | null {
  const upperName = name.toUpperCase();

  // Find closest match using simple character comparison
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const valid of validNames) {
    const score = calculateSimilarity(upperName, valid);
    if (score > bestScore && score > 0.5) {
      bestScore = score;
      bestMatch = valid;
    }
  }

  return bestMatch;
}

/**
 * Simple similarity calculation (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  let matches = 0;
  const maxLen = Math.max(a.length, b.length);

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }

  return matches / maxLen;
}

/**
 * Expected operand counts per instruction.
 * Format: [min, max] operands (excluding the opcode itself).
 */
export const INSTRUCTION_OPERANDS: Record<string, [number, number]> = {
  // Control
  NOP:        [0, 0],
  EXIT:       [0, 0],
  // ALU
  SADD:       [3, 3],
  SSUB:       [3, 3],
  SMUL:       [3, 3],
  FXPMUL:     [3, 3],
  // Logic
  LAND:       [3, 3],
  LOR:        [3, 3],
  LXOR:       [3, 3],
  LNAND:      [3, 3],
  LNOR:       [3, 3],
  LXNOR:      [3, 3],
  // Shift
  SLT:        [3, 3],
  SRT:        [3, 3],
  SRA:        [3, 3],
  // Memory
  LWD:        [1, 1],
  SWD:        [1, 1],
  LWI:        [2, 2],
  SWI:        [2, 2],
  // Select
  BSFA:       [4, 4],
  BZFA:       [4, 4],
  // Branch
  BEQ:        [3, 3],
  BNE:        [3, 3],
  BLT:        [3, 3],
  BGE:        [3, 3],
  JUMP:       [3, 3],
  // Debug
  PRINT:      [1, 1],
  CHECK:      [1, 2],
  ASSERT:     [1, 2],
  CHECKPOINT: [0, 1],
  OUTPUT:     [1, 1],
  // Immediate (wraps a value)
  IMM:        [1, 1],
};

/**
 * Validates instruction operand counts in parsed cycle blocks.
 * Detects wrong operand count at compile time.
 */
export function validateInstructionOperands(
  instructions: Map<string, { opcode: string; operands: string[]; originalLine: number }>
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [, instr] of instructions) {
    const upper = instr.opcode.toUpperCase();
    const expected = INSTRUCTION_OPERANDS[upper];
    if (!expected) continue;

    const [min, max] = expected;
    const count = instr.operands.length;

    if (count < min || count > max) {
      const expectedStr = min === max
        ? `${min}`
        : `${min}-${max}`;
      diagnostics.push(createDiagnostic(
        `${instr.opcode} expects ${expectedStr} operand(s), but got ${count}`,
        instr.originalLine || 1,
        1,
        instr.originalLine || 1,
        1,
        DiagnosticSeverity.Error,
        ErrorCodes.INVALID_OPERAND_COUNT
      ));
    }
  }

  return diagnostics;
}

/**
 * Represents a PE location within a cycle
 */
interface PELocation {
  col: number;
  row: number;
  line: number;
  column: number;
}

/**
 * Validates that no PE receives multiple instructions in the same cycle.
 * A CGRA can only execute one instruction per PE per cycle.
 *
 * @param tokens - Token array to analyze
 * @returns Array of diagnostics for duplicate PE instructions
 */
export function validateDuplicatePEInstructions(tokens: Token[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Track current cycle and PE locations within it
  let inCycle = false;
  let cycleBraceDepth = 0;
  const peLocationsInCycle: PELocation[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Detect cycle start (cycle keyword followed by {)
    if (token.type === TokenType.KEYWORD && token.value.toLowerCase() === 'cycle') {
      inCycle = true;
      cycleBraceDepth = 0; // Reset for this cycle
      peLocationsInCycle.length = 0; // Clear previous cycle
      continue;
    }

    // Track brace depth for cycle boundaries
    if (inCycle) {
      if (token.type === TokenType.BRACE_OPEN) {
        cycleBraceDepth++;
      } else if (token.type === TokenType.BRACE_CLOSE) {
        cycleBraceDepth--;
        if (cycleBraceDepth <= 0) {
          inCycle = false;
          cycleBraceDepth = 0;
        }
      }
    }

    // Detect @row,col: pattern within a cycle (C convention)
    if (inCycle && token.type === TokenType.AT_SYMBOL && i + 4 < tokens.length) {
      const rowToken = tokens[i + 1];
      const commaToken = tokens[i + 2];
      const colToken = tokens[i + 3];
      const colonToken = tokens[i + 4];

      if (rowToken?.type === TokenType.NUMBER &&
          commaToken?.value === ',' &&
          colToken?.type === TokenType.NUMBER &&
          colonToken?.value === ':') {
        const row = parseInt(rowToken.value, 10);
        const col = parseInt(colToken.value, 10);

        // Check if this PE already has an instruction in this cycle
        const existing = peLocationsInCycle.find(loc => loc.col === col && loc.row === row);

        if (existing) {
          diagnostics.push(createDiagnostic(
            `Duplicate instruction at PE @${row},${col} in same cycle. ` +
            `Only one instruction per PE per cycle is allowed. ` +
            `First instruction at line ${existing.line}.`,
            token.line,
            token.column,
            colToken.line,
            colToken.column + colToken.value.length,
            DiagnosticSeverity.Warning,
            ErrorCodes.DUPLICATE_PE_INSTRUCTION
          ));
        } else {
          peLocationsInCycle.push({
            col,
            row,
            line: token.line,
            column: token.column
          });
        }
      }
    }
  }

  return diagnostics;
}
