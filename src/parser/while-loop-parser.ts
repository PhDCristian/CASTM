/**
 * OpenEdge-DSL While Loop Parser
 *
 * Handles parsing of while loops:
 * - while (cond) @row,col { ... }
 *
 * Coordinates follow C convention: @row,col like array[row][col]
 *
 * Supports optimizations:
 * - Body + Jump fusion when body PE is adjacent to control PE
 * - #pragma no_fuse to disable fusion
 */

import { Token, TokenType } from '../types/tokens';
import { CycleBlock, PragmaDirective } from '../types/ast';
import { SymbolTable } from '../types/symbols';
import { ParserState, registerLabel, currentCycleNumber, createCycleBlock, addCycle } from './parser-state';
import {
  ParsedCondition,
  LocationSpec,
  getBranchInstruction,
  calculateNeighborRef,
  countCyclesInTokens,
  createToken,
  createLocationPrefix,
  createBranchInstruction,
  createJumpInstruction,
  createCycleHeader,
  createCycleFooter,
  createLabeledCycleHeader,
  COMPARISON_OPERATORS
} from './control-flow-utils';

// ==========================================
// Types
// ==========================================

/**
 * Context for while loop parsing operations
 */
export interface WhileLoopParseContext {
  /** Token array */
  tokens: Token[];
  /** Current position in token array */
  current: number;
  /** Parser state (AST, symbols, etc.) */
  state: ParserState;
}

/**
 * Result of parsing a while loop
 */
export interface WhileLoopParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Updated current position */
  current: number;
  /** Tokens to inject (for body/jump) */
  tokensToInject?: Token[];
  /** Direct cycle to add (for standard non-fused) */
  conditionCycle?: CycleBlock;
  /** Body tokens to re-inject */
  bodyTokensToInject?: Token[];
  /** Jump tokens to append after body */
  jumpTokensToAppend?: Token[];
  /** Labels to register */
  labels?: { name: string; cycleNumber: number }[];
  /** Error message if failed */
  error?: string;
  /** Line number for error */
  line?: number;
}

/**
 * While body fusion analysis result
 */
interface WhileBodyFusionAnalysis {
  canFuse: boolean;
  bodyCol: number;
  bodyRow: number;
  neighborRef: string;
}

// ==========================================
// Main Parser Function
// ==========================================

/**
 * Parses a while loop from the token stream.
 * Assumes the 'while' keyword has already been matched.
 *
 * @param ctx - Parse context
 * @param activePragma - Active pragma directive (if any)
 * @returns Parse result with tokens to inject or error
 */
export function parseWhileLoop(
  ctx: WhileLoopParseContext,
  activePragma: PragmaDirective | null
): WhileLoopParseResult {
  const { tokens, state } = ctx;
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
    const whileLine = peek().line;

    // Check for #pragma no_fuse
    const disableFusion = activePragma?.name === 'no_fuse';

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

    // Collect body tokens
    expect(TokenType.BRACE_OPEN);
    const whileBodyTokens: Token[] = [];
    let braceCount = 1;
    while (braceCount > 0 && peek().type !== TokenType.EOF) {
      const t = advance();
      if (t.type === TokenType.BRACE_OPEN) braceCount++;
      if (t.type === TokenType.BRACE_CLOSE) braceCount--;
      if (braceCount > 0) whileBodyTokens.push(t);
    }

    // Analyze body for fusion optimization
    const bodyAnalysis = analyzeWhileBodyForFusion(whileBodyTokens, locCol, locRow);

    // Disable fusion if pragma specified
    if (disableFusion) {
      bodyAnalysis.canFuse = false;
    }

    // Generate branch instruction
    const { opcode: branchOp, swapOperands } = getBranchInstruction(operator);
    const [finalOp1, finalOp2] = swapOperands ? [op2, op1] : [op1, op2];

    const cycleCounter = currentCycleNumber(state);
    const uniqueId = cycleCounter;
    const startLabel = `_while_start_${uniqueId}`;
    const endLabel = `_while_end_${uniqueId}`;

    if (bodyAnalysis.canFuse) {
      // Optimized: 2 cycles per iteration
      return generateFusedWhileLoop(
        whileBodyTokens, finalOp1, finalOp2, branchOp,
        bodyAnalysis, locCol, locRow, startLabel, endLabel,
        state, whileLine, current
      );
    } else {
      // Standard: 3 cycles per iteration
      return generateStandardWhileLoop(
        whileBodyTokens, finalOp1, finalOp2, branchOp,
        bodyAnalysis, locCol, locRow, startLabel, endLabel,
        state, whileLine, current
      );
    }

  } catch (err: any) {
    return {
      success: false,
      current: ctx.current,
      error: err.message,
      line: err.line
    };
  }
}

// ==========================================
// Body Analysis
// ==========================================

/**
 * Analyzes while loop body for fusion optimization
 */
function analyzeWhileBodyForFusion(
  bodyTokens: Token[],
  controlCol: number,
  controlRow: number
): WhileBodyFusionAnalysis {
  const result: WhileBodyFusionAnalysis = {
    canFuse: false,
    bodyCol: -1,
    bodyRow: -1,
    neighborRef: ''
  };

  let cycleCount = 0;
  let firstBodyPeCol = -1;
  let firstBodyPeRow = -1;
  let instructionCount = 0;
  let hasVisualSyntax = false;

  for (let i = 0; i < bodyTokens.length; i++) {
    const t = bodyTokens[i];

    if (t.type === TokenType.KEYWORD && t.value.toLowerCase() === 'cycle') {
      cycleCount++;
    }

    // Detect @row,col: pattern (C convention)
    if (t.type === TokenType.AT_SYMBOL && i + 4 < bodyTokens.length) {
      const rowToken = bodyTokens[i + 1];
      const commaToken = bodyTokens[i + 2];
      const colToken = bodyTokens[i + 3];
      const colonToken = bodyTokens[i + 4];

      if (rowToken?.type === TokenType.NUMBER &&
          commaToken?.value === ',' &&
          colToken?.type === TokenType.NUMBER &&
          colonToken?.value === ':') {
        if (firstBodyPeCol < 0) {
          firstBodyPeRow = parseInt(rowToken.value);
          firstBodyPeCol = parseInt(colToken.value);
        }
        instructionCount++;
      }
    }

    // Visual syntax not fusionable
    if (t.type === TokenType.KEYWORD && t.value.toLowerCase() === 'row') {
      hasVisualSyntax = true;
    }
  }

  // Calculate neighbor reference
  let neighborRef = '';
  if (firstBodyPeCol >= 0 && firstBodyPeRow >= 0 && !hasVisualSyntax) {
    if (!(firstBodyPeCol === controlCol && firstBodyPeRow === controlRow)) {
      neighborRef = calculateNeighborRef(controlCol, controlRow, firstBodyPeCol, firstBodyPeRow);
    }
  }

  result.bodyCol = firstBodyPeCol;
  result.bodyRow = firstBodyPeRow;
  result.neighborRef = neighborRef;

  // Check fusion conditions
  if (hasVisualSyntax) return result;
  if (cycleCount !== 1) return result;
  if (instructionCount !== 1) return result;
  if (firstBodyPeCol < 0 || firstBodyPeRow < 0) return result;
  if (firstBodyPeCol === controlCol && firstBodyPeRow === controlRow) return result;
  if (!neighborRef) return result;

  result.canFuse = true;
  return result;
}

// ==========================================
// Loop Generation
// ==========================================

/**
 * Generates fused while loop (2 cycles per iteration)
 */
function generateFusedWhileLoop(
  bodyTokens: Token[],
  op1: string,
  op2: string,
  branchOp: string,
  bodyAnalysis: WhileBodyFusionAnalysis,
  locCol: number,
  locRow: number,
  startLabel: string,
  endLabel: string,
  state: ParserState,
  line: number,
  current: number
): WhileLoopParseResult {
  const cycleCounter = currentCycleNumber(state);
  const col = 1;

  // Replace condition operands with neighbor reference
  let conditionOp1 = op1;
  let conditionOp2 = op2;
  if (op1.match(/^R\d+$/)) {
    conditionOp1 = bodyAnalysis.neighborRef;
  }
  if (op2.match(/^R\d+$/)) {
    conditionOp2 = bodyAnalysis.neighborRef;
  }

  const syntheticTokens: Token[] = [];

  // --- Condition Check Cycle ---
  syntheticTokens.push(...createLabeledCycleHeader(startLabel, line, col));
  syntheticTokens.push(...createLocationPrefix(locCol, locRow, line, col));
  syntheticTokens.push(...createBranchInstruction(branchOp, conditionOp1, conditionOp2, endLabel, line, col));
  syntheticTokens.push(...createCycleFooter(line, col));

  // --- FUSED Cycle: Body + Jump ---
  syntheticTokens.push(...createCycleHeader(line, col));

  // Extract body instruction
  for (let i = 0; i < bodyTokens.length; i++) {
    const t = bodyTokens[i];
    if (t.type === TokenType.AT_SYMBOL) {
      while (i < bodyTokens.length) {
        syntheticTokens.push({ ...bodyTokens[i] });
        if (bodyTokens[i].type === TokenType.SEMICOLON) break;
        i++;
      }
      break;
    }
  }

  // Jump at control PE
  syntheticTokens.push(...createLocationPrefix(locCol, locRow, line, col));
  syntheticTokens.push(...createJumpInstruction(startLabel, line, col));

  syntheticTokens.push(...createCycleFooter(line, col));

  return {
    success: true,
    current,
    tokensToInject: syntheticTokens,
    labels: [
      { name: startLabel, cycleNumber: cycleCounter },
      { name: endLabel, cycleNumber: cycleCounter + 2 }
    ]
  };
}

/**
 * Generates standard while loop (3 cycles per iteration)
 */
function generateStandardWhileLoop(
  bodyTokens: Token[],
  op1: string,
  op2: string,
  branchOp: string,
  bodyAnalysis: WhileBodyFusionAnalysis,
  locCol: number,
  locRow: number,
  startLabel: string,
  endLabel: string,
  state: ParserState,
  line: number,
  current: number
): WhileLoopParseResult {
  const cycleCounter = currentCycleNumber(state);
  const col = 1;

  // Use neighbor ref for condition if available
  let standardConditionOp1 = op1;
  let standardConditionOp2 = op2;
  if (bodyAnalysis.neighborRef) {
    if (op1.match(/^R\d+$/)) {
      standardConditionOp1 = bodyAnalysis.neighborRef;
    }
    if (op2.match(/^R\d+$/)) {
      standardConditionOp2 = bodyAnalysis.neighborRef;
    }
  }

  // Create condition cycle directly
  const conditionCycle = createCycleBlock(cycleCounter, startLabel);
  conditionCycle.instructions.set(`${locRow},${locCol}`, {
    opcode: branchOp,
    operands: [standardConditionOp1, standardConditionOp2, endLabel],
    originalLine: line
  });

  // Generate jump tokens
  const jumpTokens: Token[] = [];
  jumpTokens.push(...createCycleHeader(line, col));
  jumpTokens.push(...createLocationPrefix(locCol, locRow, line, col));
  jumpTokens.push(...createJumpInstruction(startLabel, line, col));
  jumpTokens.push(...createCycleFooter(line, col));

  const bodyCycleCount = countCyclesInTokens(bodyTokens);

  return {
    success: true,
    current,
    conditionCycle,
    bodyTokensToInject: bodyTokens,
    jumpTokensToAppend: jumpTokens,
    labels: [
      { name: startLabel, cycleNumber: cycleCounter },
      { name: endLabel, cycleNumber: cycleCounter + bodyCycleCount + 2 }
    ]
  };
}
