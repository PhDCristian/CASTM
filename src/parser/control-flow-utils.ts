/**
 * OpenEdge-DSL Control Flow Utilities
 *
 * Helper functions and types for parsing control flow constructs:
 * - For loops (with range())
 * - While loops
 * - If-else statements
 *
 * These utilities are used by the main parser to handle control flow
 * token generation and analysis.
 */

import { Token, TokenType } from '../types/tokens';
import { evaluateSimpleExpression } from '../utils/expression';

// ==========================================
// Types for Control Flow Analysis
// ==========================================

/**
 * Result of analyzing a loop body for fusion optimization
 */
export interface BodyFusionAnalysis {
  /** Whether the body can be fused with other operations */
  canFuse: boolean;
  /** Column of the body PE */
  bodyCol: number;
  /** Row of the body PE */
  bodyRow: number;
  /** Neighbor reference for inter-PE communication (RCL, RCR, RCT, RCB) */
  neighborRef: string;
  /** Modified body tokens (if any substitution needed) */
  bodyTokens: Token[];
}

/**
 * Range arguments for for loops
 */
export interface RangeArgs {
  start: number;
  end: number;
  step: number;
}

/**
 * Parsed condition for while/if statements
 */
export interface ParsedCondition {
  op1: string;
  operator: string;
  op2: string;
}

/**
 * Location specifier (@row,col) - follows C convention like array[row][col]
 */
export interface LocationSpec {
  col: number;
  row: number;
}

// ==========================================
// Constants
// ==========================================

/**
 * Reserved names that cannot be used as loop variables
 */
export const RESERVED_LOOP_VARIABLES = [
  'range', 'in', 'for', 'cycle', 'row', 'col',
  'kernel', 'config', 'function', 'if', 'else', 'while'
] as const;

/**
 * Supported comparison operators in conditions
 */
export const COMPARISON_OPERATORS = ['==', '!=', '<', '>', '<=', '>='] as const;

/**
 * Maximum iterations allowed in a for loop
 */
export const MAX_LOOP_ITERATIONS = 10000;

// ==========================================
// Branch Instruction Mapping
// ==========================================

/**
 * Maps condition operators to branch instructions (inverted logic)
 * For while loops: continue while condition is TRUE, exit when FALSE
 * So we branch to END when condition becomes FALSE (inverted)
 */
export function getBranchInstruction(
  operator: string,
  forLoopStep?: number
): { opcode: string; swapOperands: boolean } {
  // For 'for' loops with step direction
  if (forLoopStep !== undefined) {
    return {
      opcode: forLoopStep > 0 ? 'BGE' : 'BLT',
      swapOperands: false
    };
  }

  // For while/if conditions (inverted logic)
  switch (operator) {
    case '==': return { opcode: 'BNE', swapOperands: false };
    case '!=': return { opcode: 'BEQ', swapOperands: false };
    case '<': return { opcode: 'BGE', swapOperands: false };
    case '>=': return { opcode: 'BLT', swapOperands: false };
    case '>': return { opcode: 'BGE', swapOperands: true };  // a > b exit → b >= a
    case '<=': return { opcode: 'BLT', swapOperands: true };  // a <= b exit → b < a
    default:
      throw new Error(`Unsupported comparison operator: ${operator}`);
  }
}

// ==========================================
// Range Utilities
// ==========================================

/**
 * Parses range arguments and returns normalized start, end, step values
 *
 * @param args - Array of range arguments [end] or [start, end] or [start, end, step]
 * @param line - Line number for error reporting
 * @returns Normalized range arguments
 */
export function parseRangeArgs(args: number[], line: number): RangeArgs {
  if (args.length === 0) {
    throw { message: 'range() requires at least 1 argument', line };
  }

  if (args.length === 1) {
    // range(end) - iterate from 0 to end-1
    return { start: 0, end: args[0], step: 1 };
  }

  if (args.length === 2) {
    // range(start, end) - iterate from start to end-1
    return { start: args[0], end: args[1], step: 1 };
  }

  if (args.length === 3) {
    // range(start, end, step)
    if (args[2] === 0) {
      throw { message: 'range() step cannot be zero', line };
    }
    return { start: args[0], end: args[1], step: args[2] };
  }

  throw { message: 'range() accepts 1, 2, or 3 arguments', line };
}

/**
 * Calculates the number of iterations for a range
 */
export function calculateIterations(range: RangeArgs): number {
  const { start, end, step } = range;
  return step > 0
    ? Math.max(0, Math.ceil((end - start) / step))
    : Math.max(0, Math.ceil((start - end) / (-step)));
}

/**
 * Validates that iteration count is within limits
 */
export function validateIterationCount(iterations: number, line: number): void {
  if (iterations > MAX_LOOP_ITERATIONS) {
    throw {
      message: `For loop would generate ${iterations} iterations (max ${MAX_LOOP_ITERATIONS})`,
      line
    };
  }
}

// ==========================================
// Neighbor Reference Calculation
// ==========================================

/**
 * Calculates the neighbor reference (RCL, RCR, RCT, RCB) based on
 * relative position between control PE and body PE.
 *
 * @param controlCol - Column of the control PE
 * @param controlRow - Row of the control PE
 * @param bodyCol - Column of the body PE
 * @param bodyRow - Row of the body PE
 * @returns Neighbor reference string, or empty if not adjacent
 */
export function calculateNeighborRef(
  controlCol: number,
  controlRow: number,
  bodyCol: number,
  bodyRow: number
): string {
  // Same position - no neighbor reference possible
  if (controlCol === bodyCol && controlRow === bodyRow) {
    return '';
  }

  // Horizontal neighbors (same row)
  if (bodyRow === controlRow) {
    const colDiff = bodyCol - controlCol;
    if (colDiff === 1 || colDiff === -3) {
      // Body is to the right of control
      return 'RCR';
    }
    if (colDiff === -1 || colDiff === 3) {
      // Body is to the left of control
      return 'RCL';
    }
  }

  // Vertical neighbors (same column)
  if (bodyCol === controlCol) {
    if (bodyRow === controlRow - 1) {
      return 'RCT'; // Body is above control
    }
    if (bodyRow === controlRow + 1) {
      return 'RCB'; // Body is below control
    }
  }

  return ''; // Not adjacent
}

// ==========================================
// Token Generation Helpers
// ==========================================

/**
 * Creates a token with the given properties
 */
export function createToken(
  type: TokenType,
  value: string,
  line: number,
  column: number = 1
): Token {
  return { type, value, line, column };
}

/**
 * Creates a sequence of tokens for a cycle header with label
 * Returns: [labelId, ':', 'cycle', '{']
 */
export function createLabeledCycleHeader(
  label: string,
  line: number,
  column: number = 1
): Token[] {
  return [
    createToken(TokenType.IDENTIFIER, label, line, column),
    createToken(TokenType.OPERATOR, ':', line, column),
    createToken(TokenType.KEYWORD, 'cycle', line, column),
    createToken(TokenType.BRACE_OPEN, '{', line, column),
  ];
}

/**
 * Creates a sequence of tokens for a cycle header without label
 * Returns: ['cycle', '{']
 */
export function createCycleHeader(line: number, column: number = 1): Token[] {
  return [
    createToken(TokenType.KEYWORD, 'cycle', line, column),
    createToken(TokenType.BRACE_OPEN, '{', line, column),
  ];
}

/**
 * Creates a cycle footer token
 * Returns: ['}']
 */
export function createCycleFooter(line: number, column: number = 1): Token[] {
  return [createToken(TokenType.BRACE_CLOSE, '}', line, column)];
}

/**
 * Creates a PE location prefix: @row,col: (C convention)
 */
export function createLocationPrefix(
  col: number,
  row: number,
  line: number,
  column: number = 1
): Token[] {
  return [
    createToken(TokenType.AT_SYMBOL, '@', line, column),
    createToken(TokenType.NUMBER, row.toString(), line, column),
    createToken(TokenType.OPERATOR, ',', line, column),
    createToken(TokenType.NUMBER, col.toString(), line, column),
    createToken(TokenType.OPERATOR, ':', line, column),
  ];
}

/**
 * Creates a branch instruction with operands
 * Returns: [opcode, op1, ',', op2, ',', target, ';']
 */
export function createBranchInstruction(
  opcode: string,
  op1: string,
  op2: string,
  target: string,
  line: number,
  column: number = 1
): Token[] {
  const tokens: Token[] = [
    createToken(TokenType.IDENTIFIER, opcode, line, column),
  ];

  // op1
  if (/^[a-zA-Z]/.test(op1)) {
    tokens.push(createToken(TokenType.IDENTIFIER, op1, line, column));
  } else {
    tokens.push(createToken(TokenType.NUMBER, op1, line, column));
  }
  tokens.push(createToken(TokenType.OPERATOR, ',', line, column));

  // op2
  if (/^[a-zA-Z]/.test(op2)) {
    tokens.push(createToken(TokenType.IDENTIFIER, op2, line, column));
  } else {
    tokens.push(createToken(TokenType.NUMBER, op2, line, column));
  }
  tokens.push(createToken(TokenType.OPERATOR, ',', line, column));

  // target
  tokens.push(createToken(TokenType.IDENTIFIER, target, line, column));
  tokens.push(createToken(TokenType.SEMICOLON, ';', line, column));

  return tokens;
}

/**
 * Creates a JUMP instruction: JUMP label, ZERO
 */
export function createJumpInstruction(
  label: string,
  line: number,
  column: number = 1
): Token[] {
  return [
    createToken(TokenType.IDENTIFIER, 'JUMP', line, column),
    createToken(TokenType.IDENTIFIER, label, line, column),
    createToken(TokenType.OPERATOR, ',', line, column),
    createToken(TokenType.IDENTIFIER, 'ZERO', line, column),
    createToken(TokenType.SEMICOLON, ';', line, column),
  ];
}

/**
 * Creates an increment/decrement instruction: SADD/SSUB var, var, step
 */
export function createIncrementInstruction(
  varName: string,
  step: number,
  line: number,
  column: number = 1
): Token[] {
  const opcode = step > 0 ? 'SADD' : 'SSUB';
  const absStep = Math.abs(step);
  return [
    createToken(TokenType.IDENTIFIER, opcode, line, column),
    createToken(TokenType.IDENTIFIER, varName, line, column),
    createToken(TokenType.OPERATOR, ',', line, column),
    createToken(TokenType.IDENTIFIER, varName, line, column),
    createToken(TokenType.OPERATOR, ',', line, column),
    createToken(TokenType.NUMBER, absStep.toString(), line, column),
    createToken(TokenType.SEMICOLON, ';', line, column),
  ];
}

// ==========================================
// Body Token Analysis
// ==========================================

/**
 * Counts the number of cycle blocks in a token array
 */
export function countCyclesInTokens(tokens: Token[]): number {
  let count = 0;
  for (const t of tokens) {
    if (t.type === TokenType.KEYWORD && t.value.toLowerCase() === 'cycle') {
      count++;
    }
  }
  return count;
}

/**
 * Checks if tokens contain visual syntax (row N:)
 */
export function hasVisualSyntax(tokens: Token[]): boolean {
  for (const t of tokens) {
    if (t.type === TokenType.KEYWORD && t.value.toLowerCase() === 'row') {
      return true;
    }
  }
  return false;
}

/**
 * Finds all @row,col: locations in tokens (C convention)
 * Returns array of { col, row, index } for each found location
 */
export function findPELocations(
  tokens: Token[]
): Array<{ col: number; row: number; index: number }> {
  const locations: Array<{ col: number; row: number; index: number }> = [];

  for (let i = 0; i < tokens.length - 4; i++) {
    const t = tokens[i];
    if (t.type === TokenType.AT_SYMBOL) {
      const rowToken = tokens[i + 1];
      const commaToken = tokens[i + 2];
      const colToken = tokens[i + 3];
      const colonToken = tokens[i + 4];

      if (rowToken?.type === TokenType.NUMBER &&
        commaToken?.value === ',' &&
        colToken?.type === TokenType.NUMBER &&
        colonToken?.value === ':') {
        locations.push({
          row: parseInt(rowToken.value),
          col: parseInt(colToken.value),
          index: i
        });
      }
    }
  }

  return locations;
}

/**
 * Checks if a variable name is used in a token array
 */
export function isVariableUsed(tokens: Token[], varName: string): boolean {
  for (const t of tokens) {
    if (t.type === TokenType.IDENTIFIER && t.value === varName) {
      return true;
    }
  }
  return false;
}

/**
 * Replaces all occurrences of a variable in tokens with a new value
 */
export function replaceVariable(
  tokens: Token[],
  varName: string,
  replacement: string
): Token[] {
  return tokens.map(t => {
    if (t.type === TokenType.IDENTIFIER && t.value === varName) {
      return { ...t, value: replacement };
    }
    return { ...t };
  });
}

// ==========================================
// Dynamic Coordinate Utilities
// ==========================================

/**
 * Checks if a token at the given index is in a coordinate context (@row,col:)
 * Follows C convention where first index is row, second is column.
 *
 * Coordinate context is detected when:
 * - Position row: token is immediately after @
 * - Position col: token is after @expr,
 *
 * @param tokens - Array of tokens
 * @param index - Index of the token to check
 * @returns true if the token is in a coordinate position
 */
export function isCoordinateContext(tokens: Token[], index: number): boolean {
  if (index < 0 || index >= tokens.length) return false;

  // Look backwards to find the @ symbol
  // Valid patterns:
  //   @<HERE>,col:    (row position - directly after @)
  //   @row,<HERE>:    (col position - after @...something...,)

  // Check if this is a row position: directly after @
  if (index > 0 && tokens[index - 1]?.type === TokenType.AT_SYMBOL) {
    return true;
  }

  // Check if this is a col position: after a comma that follows @
  // Walk backwards to find the pattern @...,...<HERE>
  let foundComma = false;

  for (let i = index - 1; i >= 0 && i >= index - 10; i--) {
    const t = tokens[i];

    if (!foundComma && t.value === ',') {
      foundComma = true;
      continue;
    }

    if (foundComma && t.type === TokenType.AT_SYMBOL) {
      // Found @...,...<HERE> pattern - this is col position
      return true;
    }

    // If we hit another instruction (semicolon, keyword), stop looking
    if (t.type === TokenType.SEMICOLON || t.type === TokenType.KEYWORD) {
      break;
    }
  }

  return false;
}

/**
 * Checks if a token is part of a coordinate expression (between @ and : or ,)
 * Used for expression tokens like operators in @i+1,j*2:
 */
export function isInCoordinateExpression(tokens: Token[], index: number): boolean {
  if (index < 0 || index >= tokens.length) return false;

  // Look backwards to find @
  let foundAt = false;
  for (let i = index - 1; i >= 0 && i >= index - 20; i--) {
    const t = tokens[i];
    if (t.type === TokenType.AT_SYMBOL) {
      foundAt = true;
      break;
    }
    // If we hit a terminator before @, we're not in coordinate expr
    if (t.type === TokenType.SEMICOLON || t.type === TokenType.KEYWORD ||
      t.type === TokenType.BRACE_OPEN || t.type === TokenType.BRACE_CLOSE) {
      break;
    }
  }

  if (!foundAt) return false;

  // Look forwards to find : (should hit : before ; or })
  for (let i = index; i < tokens.length && i <= index + 20; i++) {
    const t = tokens[i];
    if (t.value === ':') {
      return true;
    }
    if (t.type === TokenType.SEMICOLON || t.type === TokenType.KEYWORD ||
      t.type === TokenType.BRACE_OPEN || t.type === TokenType.BRACE_CLOSE) {
      break;
    }
  }

  return false;
}

/**
 * Detects if a loop body contains dynamic coordinates that use the loop variable
 *
 * @param tokens - Loop body tokens
 * @param varName - Loop variable name
 * @returns true if dynamic coordinates using varName are found
 */
export function hasDynamicCoordinates(tokens: Token[], varName: string): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === TokenType.IDENTIFIER && t.value === varName) {
      if (isCoordinateContext(tokens, i) || isInCoordinateExpression(tokens, i)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extracts all tokens that form a coordinate expression
 * Starting from position after @, extracts until , (for row) or : (for col)
 * Follows C convention: @row,col:
 *
 * @param tokens - Array of tokens
 * @param startIndex - Index right after @ symbol
 * @param isRow - true if extracting row (stop at ,), false for col (stop at :)
 * @returns Array of expression tokens
 */
export function extractCoordinateExpressionTokens(
  tokens: Token[],
  startIndex: number,
  isRow: boolean
): { exprTokens: Token[]; endIndex: number } {
  const exprTokens: Token[] = [];
  let i = startIndex;
  const stopChar = isRow ? ',' : ':';

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.value === stopChar) {
      break;
    }
    // Safety: stop at unexpected tokens (including BRACE_OPEN for if-else syntax: @row,col {)
    if (t.type === TokenType.SEMICOLON || t.type === TokenType.BRACE_CLOSE || t.type === TokenType.BRACE_OPEN) {
      break;
    }
    exprTokens.push(t);
    i++;
  }

  return { exprTokens, endIndex: i };
}

/**
 * Extracts cycle structure from loop body tokens for parallel collapse
 * Returns an array of cycle templates, each containing instruction tokens
 */
export interface CycleTemplate {
  /** Tokens inside the cycle (between { and }) */
  instructionTokens: Token[];
  /** Original start index in body tokens */
  startIndex: number;
  /** Original end index in body tokens */
  endIndex: number;
}

export function extractCycleStructure(tokens: Token[]): CycleTemplate[] {
  const cycles: CycleTemplate[] = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];

    // Look for 'cycle' keyword
    if (t.type === TokenType.KEYWORD && t.value.toLowerCase() === 'cycle') {
      const startIndex = i;
      i++; // skip 'cycle'

      // Expect '{'
      if (i < tokens.length && tokens[i].type === TokenType.BRACE_OPEN) {
        i++; // skip '{'
        const instructionTokens: Token[] = [];
        let braceDepth = 1;

        // Collect tokens until matching '}'
        while (i < tokens.length && braceDepth > 0) {
          if (tokens[i].type === TokenType.BRACE_OPEN) {
            braceDepth++;
          } else if (tokens[i].type === TokenType.BRACE_CLOSE) {
            braceDepth--;
            if (braceDepth === 0) break;
          }
          instructionTokens.push(tokens[i]);
          i++;
        }

        cycles.push({
          instructionTokens,
          startIndex,
          endIndex: i
        });

        i++; // skip final '}'
        continue;
      }
    }

    i++;
  }

  return cycles;
}

/**
 * Evaluates a coordinate expression by substituting a variable with a value
 * and computing the final numeric result.
 *
 * @param exprTokens - Tokens forming the expression (e.g., ['k', '%', '4'])
 * @param varName - Variable name to substitute
 * @param value - Value to substitute for the variable
 * @returns The evaluated numeric result
 */
export function evaluateCoordinateExpression(
  exprTokens: Token[],
  varName: string,
  value: number
): number {
  // Substitute variable with value and build string array for evaluator
  const tokenStrings: string[] = exprTokens.map(t => {
    if (t.type === TokenType.IDENTIFIER && t.value === varName) {
      return value.toString();
    }
    return t.value;
  });

  return evaluateSimpleExpression(tokenStrings);
}

/**
 * Result of processing body tokens with coordinate evaluation
 */
export interface ProcessedBodyResult {
  /** Processed tokens ready for parsing */
  tokens: Token[];
}

/**
 * Checks if a token is an arithmetic operator
 */
function isOperator(t: Token): boolean {
  return t.type === TokenType.OPERATOR &&
    ['+', '-', '*', '/', '%'].includes(t.value);
}

/**
 * Reserved identifiers that are NOT loop variables
 * (registers, neighbor refs, etc.)
 */
const RESERVED_IDENTIFIERS = new Set([
  'IMM', 'ZERO', 'R0', 'R1', 'R2', 'R3', 'ROUT', 'RCL', 'RCR', 'RCT', 'RCB', 'SELF'
]);

/**
 * Checks if an expression contains other variables (not the current varName and not reserved)
 */
function hasOtherVariables(tokens: Token[], varName: string): boolean {
  return tokens.some(
    t => t.type === TokenType.IDENTIFIER &&
      t.value !== varName &&
      !RESERVED_IDENTIFIERS.has(t.value.toUpperCase())
  );
}

/**
 * Substitutes varName with iterValue and returns a SINGLE token containing the
 * expression as a string. Used for coordinates when partial substitution is needed.
 * Example: tokens=['i', '*', '2', '+', 'j'] with varName='i', iterValue=0
 *          returns a single IDENTIFIER token with value='0*2+j'
 */
function substituteAndConcatenate(
  tokens: Token[],
  varName: string,
  iterValue: number
): Token {
  const exprString = tokens.map(t => {
    if (t.type === TokenType.IDENTIFIER && t.value === varName) {
      return iterValue.toString();
    }
    return t.value;
  }).join('');

  // Return as IDENTIFIER so it can be re-processed in subsequent passes
  return createToken(TokenType.IDENTIFIER, exprString, tokens[0].line, tokens[0].column);
}

/**
 * Checks if a token value looks like an expression (contains operators).
 * Used to detect tokens that were concatenated in previous passes.
 */
function isExpressionString(value: string): boolean {
  return /[+\-*/%]/.test(value);
}

/**
 * Tokenizes an expression string into separate tokens.
 * Example: '0*2+j' → [NUMBER('0'), OP('*'), NUMBER('2'), OP('+'), IDENTIFIER('j')]
 */
function tokenizeExpressionString(exprStr: string, line: number, column: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < exprStr.length) {
    const char = exprStr[i];

    // Operators
    if (['+', '-', '*', '/', '%'].includes(char)) {
      tokens.push(createToken(TokenType.OPERATOR, char, line, column + i));
      i++;
      continue;
    }

    // Numbers
    if (/\d/.test(char)) {
      let num = '';
      while (i < exprStr.length && /\d/.test(exprStr[i])) {
        num += exprStr[i];
        i++;
      }
      tokens.push(createToken(TokenType.NUMBER, num, line, column));
      continue;
    }

    // Identifiers
    if (/[a-zA-Z_]/.test(char)) {
      let id = '';
      while (i < exprStr.length && /[a-zA-Z0-9_]/.test(exprStr[i])) {
        id += exprStr[i];
        i++;
      }
      tokens.push(createToken(TokenType.IDENTIFIER, id, line, column));
      continue;
    }

    i++; // Skip unknown characters
  }

  return tokens;
}

/**
 * Expands a list of tokens, re-tokenizing any expression strings from previous passes.
 * Example: [IDENTIFIER('0*2+j')] → [NUMBER('0'), OP('*'), NUMBER('2'), OP('+'), IDENTIFIER('j')]
 */
function expandExpressionTokens(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (const t of tokens) {
    if (t.type === TokenType.IDENTIFIER && isExpressionString(t.value)) {
      result.push(...tokenizeExpressionString(t.value, t.line, t.column));
    } else {
      result.push(t);
    }
  }
  return result;
}

/**
 * Extracts an operand expression starting at given index.
 * Collects tokens that form an expression (e.g., "k/4", "i+1*2")
 * Stops at: semicolon, comma (outside parens), closing paren/brace
 *
 * @param tokens - Token array
 * @param startIndex - Index to start from (should be at the first identifier)
 * @returns Expression tokens and end index
 */
function extractOperandExpression(
  tokens: Token[],
  startIndex: number
): { exprTokens: Token[]; endIndex: number } {
  const exprTokens: Token[] = [];
  let i = startIndex;
  let parenDepth = 0;

  while (i < tokens.length) {
    const t = tokens[i];

    // Track parentheses depth
    if (t.value === '(') {
      parenDepth++;
      exprTokens.push(t);
      i++;
      continue;
    }
    if (t.value === ')') {
      if (parenDepth > 0) {
        parenDepth--;
        exprTokens.push(t);
        i++;
        continue;
      } else {
        // End of operand
        break;
      }
    }

    // Stop conditions (only when not inside parens)
    if (parenDepth === 0) {
      if (t.type === TokenType.SEMICOLON ||
        t.type === TokenType.BRACE_CLOSE ||
        t.type === TokenType.BRACE_OPEN) {
        break;
      }
      // Comma ends operand expression
      if (t.value === ',') {
        break;
      }
    }

    // Valid expression tokens: identifiers, numbers, operators
    if (t.type === TokenType.IDENTIFIER ||
      t.type === TokenType.NUMBER ||
      isOperator(t)) {
      exprTokens.push(t);
      i++;
    } else {
      // Unknown token, stop
      break;
    }
  }

  return { exprTokens, endIndex: i };
}

/**
 * Processes loop body tokens, evaluating coordinate expressions with variable substitution.
 * Follows C convention: @row,col:
 * This handles patterns like @k/4,k%4: by:
 * 1. Detecting @ symbols
 * 2. Extracting row expression (until ,)
 * 3. Extracting col expression (until :)
 * 4. Substituting variable and evaluating each expression
 * 5. Emitting @NUMBER,NUMBER: format
 *
 * For non-coordinate variables in operand positions, evaluates expressions like k/4
 * and emits IMM(result).
 *
 * @param bodyTokens - Loop body tokens
 * @param varName - Loop variable name
 * @param iterValue - Current iteration value
 * @returns Processed tokens array
 */
export function processBodyTokensWithCoordinateEval(
  bodyTokens: Token[],
  varName: string,
  iterValue: number
): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < bodyTokens.length) {
    const t = bodyTokens[i];

    // Check if we're at @ symbol - start of coordinate
    if (t.type === TokenType.AT_SYMBOL) {
      result.push({ ...t }); // Push @
      i++;

      if (i >= bodyTokens.length) break;

      // Extract and evaluate row expression (until ,) - C convention: @row,col:
      const { exprTokens: rowTokens, endIndex: rowEnd } =
        extractCoordinateExpressionTokens(bodyTokens, i, true);

      if (rowTokens.length > 0) {
        // Expand any expression tokens from previous passes (e.g., '0*2+j' → tokens)
        const expandedRowTokens = expandExpressionTokens(rowTokens);

        // Check if expression contains the variable
        const hasVar = expandedRowTokens.some(
          rt => rt.type === TokenType.IDENTIFIER && rt.value === varName
        );
        // Check if there are OTHER variables that haven't been substituted yet
        const hasOtherVars = hasOtherVariables(expandedRowTokens, varName);

        if (hasOtherVars) {
          // Expression has other variables - substitute and keep as single token for later passes
          result.push(substituteAndConcatenate(expandedRowTokens, varName, iterValue));
        } else if (hasVar || expandedRowTokens.length > 1) {
          // Evaluate the expression (all variables resolved)
          const rowValue = evaluateCoordinateExpression(expandedRowTokens, varName, iterValue);
          result.push(createToken(TokenType.NUMBER, rowValue.toString(), expandedRowTokens[0].line, expandedRowTokens[0].column));
        } else {
          // Simple token, just copy
          result.push(...expandedRowTokens.map(rt => ({ ...rt })));
        }
      }
      i = rowEnd;

      // Push comma if present
      if (i < bodyTokens.length && bodyTokens[i].value === ',') {
        result.push({ ...bodyTokens[i] });
        i++;
      }

      // Extract and evaluate col expression (until :) - C convention: @row,col:
      if (i < bodyTokens.length) {
        const { exprTokens: colTokens, endIndex: colEnd } =
          extractCoordinateExpressionTokens(bodyTokens, i, false);

        if (colTokens.length > 0) {
          // Expand any expression tokens from previous passes (e.g., '0*2+j' → tokens)
          const expandedColTokens = expandExpressionTokens(colTokens);

          const hasVar = expandedColTokens.some(
            ct => ct.type === TokenType.IDENTIFIER && ct.value === varName
          );
          // Check if there are OTHER variables that haven't been substituted yet
          const hasOtherVars = hasOtherVariables(expandedColTokens, varName);

          if (hasOtherVars) {
            // Expression has other variables - substitute and keep as single token for later passes
            result.push(substituteAndConcatenate(expandedColTokens, varName, iterValue));
          } else if (hasVar || expandedColTokens.length > 1) {
            // Evaluate the expression (all variables resolved)
            const colValue = evaluateCoordinateExpression(expandedColTokens, varName, iterValue);
            result.push(createToken(TokenType.NUMBER, colValue.toString(), expandedColTokens[0].line, expandedColTokens[0].column));
          } else {
            // Simple token, just copy
            result.push(...expandedColTokens.map(ct => ({ ...ct })));
          }
        }
        i = colEnd;

        // Push colon if present
        if (i < bodyTokens.length && bodyTokens[i].value === ':') {
          result.push({ ...bodyTokens[i] });
          i++;
        }
      }

      continue;
    }

    // Handle array index expressions: IDENTIFIER[ expr ][ expr ]
    // This allows M[i+1][j-1] to work correctly by substituting variables in indices
    if (t.type === TokenType.IDENTIFIER && bodyTokens[i + 1]?.value === '[') {
      result.push({ ...t }); // Push array name
      i++;

      // Process first index bracket [expr]
      if (i < bodyTokens.length && bodyTokens[i].value === '[') {
        result.push({ ...bodyTokens[i] }); // Push [
        i++;

        // Extract and evaluate first index expression (until ])
        const index1Tokens: Token[] = [];
        while (i < bodyTokens.length && bodyTokens[i].value !== ']') {
          index1Tokens.push(bodyTokens[i]);
          i++;
        }

        if (index1Tokens.length > 0) {
          // Expand any expression tokens from previous passes
          const expandedIndex1 = expandExpressionTokens(index1Tokens);

          // Check if expression contains the variable
          const hasVar = expandedIndex1.some(
            it => it.type === TokenType.IDENTIFIER && it.value === varName
          );
          const hasOtherVars = hasOtherVariables(expandedIndex1, varName);

          if (hasOtherVars) {
            // Expression has other variables - substitute and keep for later passes
            result.push(substituteAndConcatenate(expandedIndex1, varName, iterValue));
          } else if (hasVar || expandedIndex1.length > 1) {
            // Evaluate the expression (all variables resolved or simple arithmetic)
            try {
              const indexValue = evaluateCoordinateExpression(expandedIndex1, varName, iterValue);
              result.push(createToken(TokenType.NUMBER, indexValue.toString(), expandedIndex1[0].line, expandedIndex1[0].column));
            } catch {
              // If evaluation fails, pass through substituted tokens
              result.push(...expandedIndex1.map(it => {
                if (it.type === TokenType.IDENTIFIER && it.value === varName) {
                  return createToken(TokenType.NUMBER, iterValue.toString(), it.line, it.column);
                }
                return { ...it };
              }));
            }
          } else {
            // Simple token, just copy
            result.push(...expandedIndex1.map(it => ({ ...it })));
          }
        }

        // Push closing ] if present
        if (i < bodyTokens.length && bodyTokens[i].value === ']') {
          result.push({ ...bodyTokens[i] });
          i++;
        }

        // Check for second index bracket [expr] (2D array)
        if (i < bodyTokens.length && bodyTokens[i].value === '[') {
          result.push({ ...bodyTokens[i] }); // Push [
          i++;

          // Extract and evaluate second index expression (until ])
          const index2Tokens: Token[] = [];
          while (i < bodyTokens.length && bodyTokens[i].value !== ']') {
            index2Tokens.push(bodyTokens[i]);
            i++;
          }

          if (index2Tokens.length > 0) {
            // Expand any expression tokens from previous passes
            const expandedIndex2 = expandExpressionTokens(index2Tokens);

            // Check if expression contains the variable
            const hasVar = expandedIndex2.some(
              it => it.type === TokenType.IDENTIFIER && it.value === varName
            );
            const hasOtherVars = hasOtherVariables(expandedIndex2, varName);

            if (hasOtherVars) {
              // Expression has other variables - substitute and keep for later passes
              result.push(substituteAndConcatenate(expandedIndex2, varName, iterValue));
            } else if (hasVar || expandedIndex2.length > 1) {
              // Evaluate the expression (all variables resolved or simple arithmetic)
              try {
                const indexValue = evaluateCoordinateExpression(expandedIndex2, varName, iterValue);
                result.push(createToken(TokenType.NUMBER, indexValue.toString(), expandedIndex2[0].line, expandedIndex2[0].column));
              } catch {
                // If evaluation fails, pass through substituted tokens
                result.push(...expandedIndex2.map(it => {
                  if (it.type === TokenType.IDENTIFIER && it.value === varName) {
                    return createToken(TokenType.NUMBER, iterValue.toString(), it.line, it.column);
                  }
                  return { ...it };
                }));
              }
            } else {
              // Simple token, just copy
              result.push(...expandedIndex2.map(it => ({ ...it })));
            }
          }

          // Push closing ] if present
          if (i < bodyTokens.length && bodyTokens[i].value === ']') {
            result.push({ ...bodyTokens[i] });
            i++;
          }
        }
      }

      continue;
    }

    // Handle expression tokens from previous passes (e.g., '0*8+j*4+k')
    // These need to be expanded and processed if they contain the current variable
    if (t.type === TokenType.IDENTIFIER && isExpressionString(t.value)) {
      const expandedTokens = tokenizeExpressionString(t.value, t.line, t.column);
      const hasVar = expandedTokens.some(
        et => et.type === TokenType.IDENTIFIER && et.value === varName
      );

      if (hasVar) {
        const hasOtherVars = hasOtherVariables(expandedTokens, varName);

        if (hasOtherVars) {
          // Still has other variables - substitute and concatenate back
          result.push(substituteAndConcatenate(expandedTokens, varName, iterValue));
        } else {
          // All variables resolved - evaluate
          const exprValue = evaluateCoordinateExpression(expandedTokens, varName, iterValue);

          // Check if this expression is inside a function call (after comma)
          const prevToken = i > 0 ? bodyTokens[i - 1] : null;
          let isInFunctionArg = false;
          if (prevToken?.value === ',') {
            // Walk backwards to find if we're inside a function call
            for (let j = i - 2; j >= 0; j--) {
              const tok = bodyTokens[j];
              if (tok.value === '(' && j > 0) {
                const beforeParen = bodyTokens[j - 1];
                if (beforeParen?.type === TokenType.IDENTIFIER &&
                  !RESERVED_IDENTIFIERS.has(beforeParen.value.toUpperCase())) {
                  isInFunctionArg = true;
                }
                break;
              }
              if (tok.value === ')' || tok.type === TokenType.SEMICOLON) {
                break;
              }
            }
          }

          if (isInFunctionArg) {
            // Inside function argument - just output the number
            result.push(createToken(TokenType.NUMBER, exprValue.toString(), t.line, t.column));
          } else {
            // Normal context - wrap in IMM(value)
            result.push(createToken(TokenType.IDENTIFIER, 'IMM', t.line, t.column));
            result.push(createToken(TokenType.OPERATOR, '(', t.line, t.column));
            result.push(createToken(TokenType.NUMBER, exprValue.toString(), t.line, t.column));
            result.push(createToken(TokenType.OPERATOR, ')', t.line, t.column));
          }
        }
        i++;
        continue;
      }
      // Expression doesn't contain current variable - copy as-is
      result.push({ ...t });
      i++;
      continue;
    }

    // Non-coordinate variable - check if it's part of an expression
    if (t.type === TokenType.IDENTIFIER && t.value === varName) {
      const prevToken = i > 0 ? bodyTokens[i - 1] : null;
      const prevPrevToken = i > 1 ? bodyTokens[i - 2] : null;
      const nextToken = bodyTokens[i + 1];

      // Check if we're inside an IMM() call: IMM ( k )
      // In this case, just substitute the number, don't wrap with IMM again
      const isInsideIMM = prevToken?.value === '(' &&
        prevPrevToken?.type === TokenType.IDENTIFIER &&
        prevPrevToken?.value.toUpperCase() === 'IMM';

      if (isInsideIMM) {
        // Variable is inside IMM() - just substitute the number
        result.push(createToken(TokenType.NUMBER, iterValue.toString(), t.line, t.column));
        i++;
        continue;
      }

      // Check if we're inside an expression (part of arithmetic)
      const isPrecededByOp = prevToken && isOperator(prevToken);
      const isFollowedByOp = nextToken && isOperator(nextToken);

      // Check if expression contains other unsubstituted variables
      // If so, substitute and concatenate into a single token for later passes
      if (isFollowedByOp) {
        const { exprTokens, endIndex } = extractOperandExpression(bodyTokens, i);
        const hasOtherVars = hasOtherVariables(exprTokens, varName);

        if (hasOtherVars) {
          // Expression has other variables - substitute and concatenate into single token
          result.push(substituteAndConcatenate(exprTokens, varName, iterValue));
          i = endIndex;
          continue;
        }

        // No other variables - evaluate the full expression
        const exprValue = evaluateCoordinateExpression(exprTokens, varName, iterValue);

        // Check if this expression is inside a function call argument
        // Look backwards from the start of the expression to find function call pattern
        const exprStart = i;
        const tokenBefore = exprStart > 0 ? bodyTokens[exprStart - 1] : null;
        let isExprInFunctionArg = false;

        if (tokenBefore?.value === '(' || tokenBefore?.value === ',') {
          // Walk backwards to find if we're inside a function call
          for (let j = exprStart - 1; j >= 0; j--) {
            const tok = bodyTokens[j];
            if (tok.value === '(' && j > 0) {
              const beforeParen = bodyTokens[j - 1];
              if (beforeParen?.type === TokenType.IDENTIFIER &&
                !RESERVED_IDENTIFIERS.has(beforeParen.value.toUpperCase())) {
                isExprInFunctionArg = true;
              }
              break;
            }
            if (tok.value === ')' || tok.type === TokenType.SEMICOLON) {
              break;
            }
          }
        }

        if (isExprInFunctionArg) {
          // Inside function argument - just output the evaluated number
          result.push(createToken(TokenType.NUMBER, exprValue.toString(), t.line, t.column));
        } else {
          // Normal context - wrap in IMM(value)
          result.push(createToken(TokenType.IDENTIFIER, 'IMM', t.line, t.column));
          result.push(createToken(TokenType.OPERATOR, '(', t.line, t.column));
          result.push(createToken(TokenType.NUMBER, exprValue.toString(), t.line, t.column));
          result.push(createToken(TokenType.OPERATOR, ')', t.line, t.column));
        }

        i = endIndex;
        continue;
      }

      if (isPrecededByOp) {
        // Variable is inside an expression (i*4+j) - just substitute the number
        result.push(createToken(TokenType.NUMBER, iterValue.toString(), t.line, t.column));
        i++;
        continue;
      }

      // Check if we're inside a function call: FunctionName ( i ) or FunctionName(a, i)
      // In this case, just substitute the number, don't wrap with IMM
      // Function calls need plain values that will be textually substituted into the function body
      const isFirstFunctionArg = prevToken?.value === '(' &&
        prevPrevToken?.type === TokenType.IDENTIFIER &&
        !RESERVED_IDENTIFIERS.has(prevPrevToken?.value.toUpperCase());

      // Check if this is a subsequent function argument (after comma)
      // Pattern: FunctionName(arg1, i, ...) - we need to check if there's a IDENTIFIER( pattern before the comma
      let isSubsequentFunctionArg = false;
      if (prevToken?.value === ',') {
        // Walk backwards to find if we're inside a function call
        for (let j = i - 2; j >= 0; j--) {
          const tok = bodyTokens[j];
          if (tok.value === '(' && j > 0) {
            const beforeParen = bodyTokens[j - 1];
            if (beforeParen?.type === TokenType.IDENTIFIER &&
              !RESERVED_IDENTIFIERS.has(beforeParen.value.toUpperCase())) {
              isSubsequentFunctionArg = true;
            }
            break;
          }
          // Stop if we hit a closing paren (wrong context) or semicolon
          if (tok.value === ')' || tok.type === TokenType.SEMICOLON) {
            break;
          }
        }
      }

      if (isFirstFunctionArg || isSubsequentFunctionArg) {
        // Variable is a function argument - just substitute the number
        result.push(createToken(TokenType.NUMBER, iterValue.toString(), t.line, t.column));
        i++;
        continue;
      }

      // Simple variable, not in an expression - use IMM(value)
      result.push(createToken(TokenType.IDENTIFIER, 'IMM', t.line, t.column));
      result.push(createToken(TokenType.OPERATOR, '(', t.line, t.column));
      result.push(createToken(TokenType.NUMBER, iterValue.toString(), t.line, t.column));
      result.push(createToken(TokenType.OPERATOR, ')', t.line, t.column));
      i++;
      continue;
    }

    // Copy other tokens as-is
    result.push({ ...t });
    i++;
  }

  return result;
}
