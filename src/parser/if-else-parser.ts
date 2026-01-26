/**
 * OpenEdge-DSL If-Else Parser
 *
 * Handles parsing of if-else statements:
 * - if (cond) @row,col { then-block }
 * - if (cond) @row,col { then-block } else { else-block }
 *
 * Generates branch and jump instructions for control flow.
 * Coordinates follow C convention: @row,col like array[row][col]
 */

import { Token, TokenType } from '../types/tokens';
import { CycleBlock, Instruction } from '../types/ast';
import { SymbolTable } from '../types/symbols';
import { ParserState, registerLabel, currentCycleNumber, nextCycleNumber, createCycleBlock, addCycle } from './parser-state';
import {
  ParsedCondition,
  LocationSpec,
  getBranchInstruction,
  COMPARISON_OPERATORS
} from './control-flow-utils';

// ==========================================
// Types
// ==========================================

/**
 * Context for if-else parsing operations
 */
export interface IfElseParseContext {
  /** Token array */
  tokens: Token[];
  /** Current position in token array */
  current: number;
  /** Parser state (AST, symbols, etc.) */
  state: ParserState;
  /** Callback to parse a nested block */
  parseBlockCallback: (until: TokenType) => void;
}

/**
 * Result of parsing an if-else statement
 */
export interface IfElseParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Updated current position */
  current: number;
  /** Branch cycle to add */
  branchCycle?: CycleBlock;
  /** Jump cycle to add (after then block) */
  jumpCycle?: CycleBlock;
  /** Labels to register */
  labels?: { name: string; cycleNumber: number }[];
  /** Whether else block was parsed */
  hasElse?: boolean;
  /** Error message if failed */
  error?: string;
  /** Line number for error */
  line?: number;
}

// ==========================================
// Main Parser Function
// ==========================================

/**
 * Parses an if-else statement from the token stream.
 * Assumes the 'if' keyword has already been matched.
 *
 * @param ctx - Parse context including parseBlockCallback
 * @returns Parse result with cycles and labels
 */
export function parseIfElse(ctx: IfElseParseContext): IfElseParseResult {
  const { tokens, state, parseBlockCallback } = ctx;
  let current = ctx.current;

  // Helper functions
  const peek = () => tokens[current];
  const advance = () => tokens[current++];
  const match = (type: TokenType, value?: string) => {
    if (peek().type !== type) return false;
    if (value !== undefined && peek().value !== value) return false;
    current++;
    return true;
  };
  const expect = (type: TokenType, value?: string) => {
    if (peek().type !== type || (value !== undefined && peek().value !== value)) {
      throw { message: `Expected ${value || type}, got '${peek().value}'`, line: peek().line };
    }
    return advance();
  };

  try {
    // Parse Condition: ( op1 operator op2 )
    expect(TokenType.OPERATOR, '(');

    // Operand 1
    const op1Tokens: string[] = [];
    while (!COMPARISON_OPERATORS.includes(peek().value as any) && peek().value !== ')') {
      op1Tokens.push(advance().value);
    }
    const op1 = op1Tokens.join('');

    // Operator
    const operator = expect(TokenType.OPERATOR).value;

    // Operand 2
    const op2Tokens: string[] = [];
    let parenBalance = 0;
    while (peek().type !== TokenType.EOF) {
      if (peek().value === '(') parenBalance++;
      if (peek().value === ')') {
        if (parenBalance === 0) break;
        parenBalance--;
      }
      op2Tokens.push(advance().value);
    }
    const op2 = op2Tokens.join('');

    expect(TokenType.OPERATOR, ')');

    // Parse Location: @row,col (C convention)
    expect(TokenType.AT_SYMBOL);
    const locRow = parseInt(expect(TokenType.NUMBER).value);
    expect(TokenType.OPERATOR, ',');
    const locCol = parseInt(expect(TokenType.NUMBER).value);

    // Labels
    const cycleCounter = currentCycleNumber(state);
    const uniqueId = cycleCounter;
    const elseLabel = `_else_label_${uniqueId}`;
    const endLabel = `_end_label_${uniqueId}`;

    // Generate Branch Instruction (Inverted Logic)
    const { opcode: branchOp, swapOperands } = getBranchInstruction(operator);
    const [ifOp1, ifOp2] = swapOperands ? [op2, op1] : [op1, op2];

    // Create Branch Cycle
    const branchCycle = createCycleBlock(nextCycleNumber(state));
    branchCycle.instructions.set(`${locRow},${locCol}`, {
      opcode: branchOp,
      operands: [ifOp1, ifOp2, elseLabel],
      originalLine: peek().line
    });

    // Parse Then Block
    expect(TokenType.BRACE_OPEN);

    // Update ctx.current before callback so it can access the right position
    ctx.current = current;
    parseBlockCallback(TokenType.BRACE_CLOSE);
    current = ctx.current; // Get updated position after callback

    expect(TokenType.BRACE_CLOSE);

    // Jump over Else
    const jumpCycle = createCycleBlock(nextCycleNumber(state));
    jumpCycle.instructions.set(`${locRow},${locCol}`, {
      opcode: 'JUMP',
      operands: [endLabel, 'ZERO'],
      originalLine: peek().line
    });

    // Register else label at current position
    const elseLabelCycle = currentCycleNumber(state);

    // Parse Else Block (Optional)
    let hasElse = false;
    if (match(TokenType.KEYWORD, 'else')) {
      hasElse = true;
      expect(TokenType.BRACE_OPEN);

      ctx.current = current;
      parseBlockCallback(TokenType.BRACE_CLOSE);
      current = ctx.current;

      expect(TokenType.BRACE_CLOSE);
    }

    // End label at current position
    const endLabelCycle = currentCycleNumber(state);

    return {
      success: true,
      current,
      branchCycle,
      jumpCycle,
      hasElse,
      labels: [
        { name: elseLabel, cycleNumber: elseLabelCycle },
        { name: endLabel, cycleNumber: endLabelCycle }
      ]
    };

  } catch (err: any) {
    return {
      success: false,
      current: ctx.current,
      error: err.message,
      line: err.line
    };
  }
}

/**
 * Parses a condition expression: ( op1 operator op2 )
 * Used for both if-else and while loops.
 *
 * @param tokens - Token array
 * @param startIdx - Start index (after opening paren)
 * @returns Parsed condition with operands and operator
 */
export function parseCondition(
  tokens: Token[],
  startIdx: number
): { condition: ParsedCondition; endIdx: number } {
  let idx = startIdx;

  const peek = () => tokens[idx];
  const advance = () => tokens[idx++];

  // Operand 1
  const op1Tokens: string[] = [];
  while (!COMPARISON_OPERATORS.includes(peek().value as any) && peek().value !== ')') {
    op1Tokens.push(advance().value);
  }
  const op1 = op1Tokens.join('');

  // Operator
  const operator = advance().value;

  // Operand 2
  const op2Tokens: string[] = [];
  let parenBalance = 0;
  while (peek().type !== TokenType.EOF) {
    if (peek().value === '(') parenBalance++;
    if (peek().value === ')') {
      if (parenBalance === 0) break;
      parenBalance--;
    }
    op2Tokens.push(advance().value);
  }
  const op2 = op2Tokens.join('');

  return {
    condition: { op1, operator, op2 },
    endIdx: idx
  };
}

/**
 * Parses a location specifier: @row,col (C convention)
 *
 * @param tokens - Token array
 * @param startIdx - Start index (at @ symbol)
 * @returns Location and end index
 */
export function parseLocation(
  tokens: Token[],
  startIdx: number
): { location: LocationSpec; endIdx: number } {
  let idx = startIdx;

  // Skip @
  if (tokens[idx].type === TokenType.AT_SYMBOL) {
    idx++;
  }

  const row = parseInt(tokens[idx++].value);
  idx++; // Skip comma
  const col = parseInt(tokens[idx++].value);

  return {
    location: { col, row },
    endIdx: idx
  };
}
