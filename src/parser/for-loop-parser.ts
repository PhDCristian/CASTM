/**
 * OpenEdge-DSL For Loop Parser
 *
 * Handles parsing of for loops with range():
 * - for <var> in range(<end>) { ... }
 * - for <var> in range(<start>, <end>) { ... }
 * - for <var> in range(<start>, <end>, <step>) { ... }
 *
 * Supports pragmas:
 * - #pragma unroll - Full loop unrolling (default)
 * - #pragma unroll(N) - Partial unrolling
 * - #pragma no_unroll - Runtime loop with branch/jump
 * - #pragma parallel - Distribute iterations across columns
 */

import { Token, TokenType } from '../types/tokens';
import { PragmaDirective } from '../types/ast';
import { SymbolTable, getArrayPropertyValue, isArrayProperty } from '../types/symbols';
import { ParserState, registerLabel, currentCycleNumber } from './parser-state';
import {
  RangeArgs,
  parseRangeArgs,
  calculateIterations,
  validateIterationCount,
  calculateNeighborRef,
  countCyclesInTokens,
  replaceVariable,
  RESERVED_LOOP_VARIABLES,
  createToken,
  createLocationPrefix,
  createBranchInstruction,
  createJumpInstruction,
  createIncrementInstruction,
  createCycleHeader,
  createCycleFooter,
  createLabeledCycleHeader,
  hasDynamicCoordinates,
  extractCycleStructure,
  processBodyTokensWithCoordinateEval
} from './control-flow-utils';

// ==========================================
// Types
// ==========================================

/**
 * Context for parsing operations
 */
export interface ForLoopParseContext {
  /** Token array */
  tokens: Token[];
  /** Current position in token array */
  current: number;
  /** Parser state (AST, symbols, etc.) */
  state: ParserState;
}

/**
 * Result of parsing a for loop
 */
export interface ForLoopParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Updated current position */
  current: number;
  /** Tokens to inject (for unrolling/runtime loops) */
  tokensToInject?: Token[];
  /** Error message if failed */
  error?: string;
  /** Line number for error */
  line?: number;
}

/**
 * Body fusion analysis result for aggressive optimization
 */
interface BodyFusionAnalysis {
  canFuse: boolean;
  bodyCol: number;
  bodyRow: number;
  bodyTokens: Token[];
  neighborRef: string;
}

// ==========================================
// Main Parser Function
// ==========================================

/**
 * Parses a for loop from the token stream.
 * Assumes the 'for' keyword has already been matched.
 *
 * @param ctx - Parse context
 * @param activePragma - Active pragma directive (if any)
 * @returns Parse result with tokens to inject or error
 */
export function parseForLoop(
  ctx: ForLoopParseContext,
  activePragma: PragmaDirective | null
): ForLoopParseResult {
  const { tokens, state } = ctx;
  let current = ctx.current;

  // Helper functions bound to current context
  const peek = () => tokens[current];
  const advance = () => tokens[current++];
  const expect = (type: TokenType, value?: string) => {
    if (peek().type !== type || (value !== undefined && peek().value !== value)) {
      throw { message: `Expected ${value || type}, got '${peek().value}'`, line: peek().line };
    }
    return advance();
  };

  try {
    // Get iteration variable name
    const varToken = peek();
    if (varToken.type !== TokenType.IDENTIFIER && varToken.type !== TokenType.UNDERSCORE) {
      throw { message: `Expected identifier for loop variable, got '${varToken.value}'`, line: varToken.line };
    }
    const varName = advance().value;

    // Validate variable name is not a reserved keyword
    if (RESERVED_LOOP_VARIABLES.includes(varName.toLowerCase() as any)) {
      throw { message: `Cannot use reserved keyword '${varName}' as iteration variable`, line: varToken.line };
    }

    // Expect 'in' keyword
    expect(TokenType.KEYWORD, 'in');

    // Expect 'range' keyword
    expect(TokenType.KEYWORD, 'range');

    // Parse range arguments
    expect(TokenType.OPERATOR, '(');
    const rangeArgs = parseRangeArgsFromTokens(
      () => tokens[current],           // peek
      () => tokens[current + 1],       // peekAhead
      () => tokens[current++],         // advance
      (type, value) => {               // expect
        if (tokens[current].type !== type || (value !== undefined && tokens[current].value !== value)) {
          throw { message: `Expected ${value || type}, got '${tokens[current].value}'`, line: tokens[current].line };
        }
        return tokens[current++];
      },
      (type, value) => {               // match
        if (tokens[current].type !== type) return false;
        if (value !== undefined && tokens[current].value !== value) return false;
        current++;
        return true;
      },
      state.symbols
    );
    // Note: current is already updated by the callbacks, no need to set it

    expect(TokenType.OPERATOR, ')');

    // Parse optional location specifier: @row,col (C convention)
    let controlRow = 0;
    let controlCol = 0;
    if (peek().type === TokenType.AT_SYMBOL) {
      advance(); // @
      controlRow = parseInt(expect(TokenType.NUMBER).value);
      expect(TokenType.OPERATOR, ',');
      controlCol = parseInt(expect(TokenType.NUMBER).value);
    }

    // Validate and normalize range
    const range = parseRangeArgs([rangeArgs.start, rangeArgs.end, rangeArgs.step], varToken.line);
    const iterations = calculateIterations(range);
    validateIterationCount(iterations, varToken.line);

    // Collect loop body tokens
    expect(TokenType.BRACE_OPEN);
    const loopBodyTokens: Token[] = [];
    let braceCount = 1;
    while (braceCount > 0 && peek().type !== TokenType.EOF) {
      const t = advance();
      if (t.type === TokenType.BRACE_OPEN) braceCount++;
      if (t.type === TokenType.BRACE_CLOSE) braceCount--;
      if (braceCount > 0) loopBodyTokens.push(t);
    }

    // Determine which optimization to use based on pragma
    let tokensToInject: Token[] = [];

    if (activePragma?.name === 'no_unroll') {
      // Runtime loop with branch/jump
      tokensToInject = generateRuntimeLoop(
        loopBodyTokens, varName, range,
        controlRow, controlCol, state, varToken.line
      );
    } else if (activePragma?.name === 'parallel') {
      // Parallel distribution across columns
      tokensToInject = generateParallelLoop(
        loopBodyTokens, varName, range, state.symbols, varToken.line, activePragma
      );
    } else {
      // Default: unroll loop (full or partial)
      const unrollFactor = activePragma?.args?.[0];
      tokensToInject = generateUnrolledLoop(
        loopBodyTokens, varName, range, unrollFactor, varToken.line
      );
    }

    return {
      success: true,
      current,
      tokensToInject
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

// ==========================================
// Range Argument Parsing
// ==========================================

interface RangeParseResult {
  start: number;
  end: number;
  step: number;
}

function parseRangeArgsFromTokens(
  peek: () => Token,
  peekAhead: () => Token | undefined,
  advance: () => Token,
  expect: (type: TokenType, value?: string) => Token,
  match: (type: TokenType, value?: string) => boolean,
  symbols: SymbolTable
): RangeParseResult {
  const args: number[] = [];

  if (peek().type !== TokenType.OPERATOR || peek().value !== ')') {
    do {
      // Handle negative numbers
      let sign = 1;
      if (peek().value === '-') {
        advance();
        sign = -1;
      }

      // Handle namedArray.property()
      const nextToken = peekAhead();
      const nextTokenIsProperty = nextToken?.type === TokenType.DIRECTIVE &&
                                  nextToken?.value.startsWith('.');
      if (peek().type === TokenType.IDENTIFIER && nextTokenIsProperty) {
        const arrayName = peek().value;

        if (!symbols.namedArrays.has(arrayName)) {
          throw { message: `Undefined array '${arrayName}'`, line: peek().line };
        }

        advance(); // array name
        const propertyDirective = advance();
        const property = propertyDirective.value.substring(1).toLowerCase();

        // Optional parentheses
        if (peek().value === '(') {
          advance();
          expect(TokenType.OPERATOR, ')');
        }

        const arrayInfo = symbols.namedArrays.get(arrayName)!;
        if (!isArrayProperty(property)) {
          throw { message: `Unknown array property '${property}'`, line: propertyDirective.line };
        }
        const value = getArrayPropertyValue(arrayInfo, property);
        args.push(sign * value);
      } else if (peek().type === TokenType.IDENTIFIER && symbols.constants.has(peek().value)) {
        // Resolve constant from symbol table
        const constToken = advance();
        const constValue = symbols.constants.get(constToken.value)!;
        const parsed = parseInt(constValue, 10);
        if (isNaN(parsed)) {
          throw { message: `Constant '${constToken.value}' has non-numeric value '${constValue}'`, line: constToken.line };
        }
        args.push(sign * parsed);
      } else if (peek().type === TokenType.NUMBER) {
        const numToken = advance();
        args.push(sign * parseInt(numToken.value));
      } else {
        throw { message: `Expected number or constant in range(), got '${peek().value}'`, line: peek().line };
      }
    } while (match(TokenType.OPERATOR, ','));
  }

  // Normalize to start, end, step
  let start = 0, end = 0, step = 1;
  if (args.length === 1) {
    end = args[0];
  } else if (args.length === 2) {
    start = args[0];
    end = args[1];
  } else if (args.length === 3) {
    start = args[0];
    end = args[1];
    step = args[2];
    if (step === 0) {
      throw { message: 'range() step cannot be zero', line: peek().line };
    }
  } else if (args.length === 0) {
    throw { message: 'range() requires at least 1 argument', line: peek().line };
  } else {
    throw { message: 'range() accepts 1, 2, or 3 arguments', line: peek().line };
  }

  return { start, end, step };
}

// ==========================================
// Loop Generation Functions
// ==========================================

/**
 * Checks if tokens contain a nested for loop
 */
function containsNestedLoop(tokens: Token[]): boolean {
  for (const t of tokens) {
    if (t.type === TokenType.KEYWORD && t.value === 'for') {
      return true;
    }
  }
  return false;
}

/**
 * Counts the number of for loops at the top level of tokens
 */
function countForLoops(tokens: Token[]): number {
  let count = 0;
  for (const t of tokens) {
    if (t.type === TokenType.KEYWORD && t.value === 'for') {
      count++;
    }
  }
  return count;
}

/**
 * Counts cycles in the innermost loop body.
 * Navigates through nested loops to find the innermost body and counts cycles there.
 *
 * For example, given:
 *   for i in range(4) {
 *     for j in range(4) {
 *       cycle { ... }
 *       cycle { ... }
 *     }
 *   }
 *
 * Returns 2 (the cycles in the innermost body)
 */
function countCyclesInInnermostBody(tokens: Token[]): number {
  let i = 0;

  // Find the first 'for' keyword to navigate into nested loops
  while (i < tokens.length) {
    const t = tokens[i];

    if (t.type === TokenType.KEYWORD && t.value === 'for') {
      // Skip to the body of this for loop
      // Pattern: for VAR in range(...) { BODY }

      // Skip 'for'
      i++;

      // Skip until we find '{'
      while (i < tokens.length && tokens[i].type !== TokenType.BRACE_OPEN) {
        i++;
      }

      if (i >= tokens.length) return 0;

      // Skip '{'
      i++;

      // Collect body tokens until matching '}'
      const bodyTokens: Token[] = [];
      let braceDepth = 1;
      while (i < tokens.length && braceDepth > 0) {
        if (tokens[i].type === TokenType.BRACE_OPEN) braceDepth++;
        if (tokens[i].type === TokenType.BRACE_CLOSE) {
          braceDepth--;
          if (braceDepth === 0) break;
        }
        bodyTokens.push(tokens[i]);
        i++;
      }

      // Check if this body has more nested loops
      if (containsNestedLoop(bodyTokens)) {
        // Recurse into the nested body
        return countCyclesInInnermostBody(bodyTokens);
      } else {
        // This is the innermost body - count cycles
        return countCyclesInTokens(bodyTokens);
      }
    }

    i++;
  }

  // No for loops found - count cycles directly
  return countCyclesInTokens(tokens);
}

/**
 * Expands nested for loops in body tokens.
 * This allows #pragma parallel to work with nested loops like:
 *
 *   #pragma parallel
 *   for i in range(4) {
 *     for j in range(4) {
 *       cycle { @i,j: ... }
 *     }
 *   }
 *
 * The inner loop is expanded first, then the outer loop applies parallel collapse.
 *
 * @param bodyTokens - Body tokens that may contain nested loops
 * @param outerVarName - Outer loop variable name
 * @param outerIterValue - Current outer loop iteration value
 * @returns Expanded tokens with inner loops unrolled
 */
function expandNestedLoops(
  bodyTokens: Token[],
  outerVarName: string,
  outerIterValue: number,
  symbols: SymbolTable,
  remainingDepth: number = Infinity
): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < bodyTokens.length) {
    const t = bodyTokens[i];

    // Check for nested for loop (only expand if we have depth remaining)
    if (t.type === TokenType.KEYWORD && t.value === 'for' && remainingDepth > 1) {
      // Parse the inner loop: for VAR in range(...) { ... }
      const forIndex = i;
      i++; // skip 'for'

      // Get variable name
      if (i >= bodyTokens.length) break;
      const innerVarToken = bodyTokens[i];
      if (innerVarToken.type !== TokenType.IDENTIFIER) {
        // Not a valid for loop, copy as-is
        result.push(t);
        continue;
      }
      const innerVarName = innerVarToken.value;
      i++; // skip var name

      // Expect 'in'
      if (i >= bodyTokens.length || bodyTokens[i].value !== 'in') {
        // Rewind and copy
        result.push(...bodyTokens.slice(forIndex, i));
        continue;
      }
      i++; // skip 'in'

      // Expect 'range'
      if (i >= bodyTokens.length || bodyTokens[i].value !== 'range') {
        result.push(...bodyTokens.slice(forIndex, i));
        continue;
      }
      i++; // skip 'range'

      // Expect '('
      if (i >= bodyTokens.length || bodyTokens[i].value !== '(') {
        result.push(...bodyTokens.slice(forIndex, i));
        continue;
      }
      i++; // skip '('

      // Collect range arguments until ')'
      const rangeArgTokens: Token[] = [];
      let parenDepth = 1;
      while (i < bodyTokens.length && parenDepth > 0) {
        if (bodyTokens[i].value === '(') parenDepth++;
        if (bodyTokens[i].value === ')') {
          parenDepth--;
          if (parenDepth === 0) break;
        }
        rangeArgTokens.push(bodyTokens[i]);
        i++;
      }
      i++; // skip ')'

      // Parse range arguments (with constant resolution)
      const rangeArgs = parseRangeArgsSimple(rangeArgTokens, symbols);
      if (!rangeArgs) {
        result.push(...bodyTokens.slice(forIndex, i));
        continue;
      }

      // Expect '{'
      if (i >= bodyTokens.length || bodyTokens[i].type !== TokenType.BRACE_OPEN) {
        result.push(...bodyTokens.slice(forIndex, i));
        continue;
      }
      i++; // skip '{'

      // Collect inner body until matching '}'
      const innerBodyTokens: Token[] = [];
      let braceDepth = 1;
      while (i < bodyTokens.length && braceDepth > 0) {
        if (bodyTokens[i].type === TokenType.BRACE_OPEN) braceDepth++;
        if (bodyTokens[i].type === TokenType.BRACE_CLOSE) {
          braceDepth--;
          if (braceDepth === 0) break;
        }
        innerBodyTokens.push(bodyTokens[i]);
        i++;
      }
      i++; // skip '}'

      // Expand inner loop: for each inner iteration, substitute both vars
      const { start: innerStart, end: innerEnd, step: innerStep } = rangeArgs;
      const innerShouldContinue = innerStep > 0
        ? (j: number) => j < innerEnd
        : (j: number) => j > innerEnd;

      for (let innerIterValue = innerStart; innerShouldContinue(innerIterValue); innerIterValue += innerStep) {
        // First substitute outer variable, then inner variable
        let processed = processBodyTokensWithCoordinateEval(innerBodyTokens, outerVarName, outerIterValue);

        // Check for further nested loops (recursive, with decremented depth)
        if (containsNestedLoop(processed) && remainingDepth > 2) {
          processed = expandNestedLoops(processed, innerVarName, innerIterValue, symbols, remainingDepth - 1);
        } else {
          processed = processBodyTokensWithCoordinateEval(processed, innerVarName, innerIterValue);
        }

        result.push(...processed);
      }

      continue;
    }

    // Not a for loop, copy token as-is
    result.push({ ...t });
    i++;
  }

  return result;
}

/**
 * Simple range args parser for nested loop expansion
 * Supports constants from symbol table (e.g., range(N) where N is defined via .const)
 */
function parseRangeArgsSimple(tokens: Token[], symbols: SymbolTable): RangeArgs | null {
  const numbers: number[] = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === TokenType.NUMBER) {
      numbers.push(parseInt(t.value, 10));
    } else if (t.type === TokenType.IDENTIFIER) {
      // Try to resolve as a constant from symbol table
      const constValue = symbols.constants.get(t.value);
      if (constValue !== undefined) {
        const parsed = parseInt(constValue, 10);
        if (!isNaN(parsed)) {
          numbers.push(parsed);
        }
      }
      // If not found, ignore (will result in null return if no valid numbers)
    } else if (t.value === ',') {
      // Skip commas
    } else if (t.type === TokenType.OPERATOR && t.value === '-') {
      // Negative number
      i++;
      if (i < tokens.length && tokens[i].type === TokenType.NUMBER) {
        numbers.push(-parseInt(tokens[i].value, 10));
      }
    }
    i++;
  }

  if (numbers.length === 0) return null;
  if (numbers.length === 1) return { start: 0, end: numbers[0], step: 1 };
  if (numbers.length === 2) return { start: numbers[0], end: numbers[1], step: 1 };
  if (numbers.length >= 3) return { start: numbers[0], end: numbers[1], step: numbers[2] };

  return null;
}

/**
 * Expands any remaining for loops in tokens sequentially (standard unrolling).
 * This is used when collapse(N) leaves inner loops unexpanded.
 *
 * For example, with collapse(2) on 3 nested loops:
 * - outer `i` and middle `j` loops are collapsed in parallel
 * - inner `k` loop remains and needs sequential expansion
 *
 * @param tokens - Tokens that may contain unexpanded for loops
 * @param symbols - Symbol table for constant resolution
 * @returns Fully expanded tokens with no remaining for loops
 */
function expandRemainingLoops(tokens: Token[], symbols: SymbolTable): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];

    // Check for a for loop
    if (t.type === TokenType.KEYWORD && t.value === 'for') {
      const forIndex = i;
      i++; // skip 'for'

      // Get variable name
      if (i >= tokens.length) {
        result.push(t);
        continue;
      }
      const varToken = tokens[i];
      if (varToken.type !== TokenType.IDENTIFIER && varToken.type !== TokenType.UNDERSCORE) {
        // Not a valid for loop variable, copy token
        result.push(t);
        continue;
      }
      const varName = varToken.value;
      i++; // skip var name

      // Expect 'in'
      if (i >= tokens.length || tokens[i].value !== 'in') {
        // Rewind and copy
        result.push(...tokens.slice(forIndex, i));
        continue;
      }
      i++; // skip 'in'

      // Expect 'range'
      if (i >= tokens.length || tokens[i].value !== 'range') {
        result.push(...tokens.slice(forIndex, i));
        continue;
      }
      i++; // skip 'range'

      // Expect '('
      if (i >= tokens.length || tokens[i].value !== '(') {
        result.push(...tokens.slice(forIndex, i));
        continue;
      }
      i++; // skip '('

      // Collect range arguments until ')'
      const rangeArgTokens: Token[] = [];
      let parenDepth = 1;
      while (i < tokens.length && parenDepth > 0) {
        if (tokens[i].value === '(') parenDepth++;
        if (tokens[i].value === ')') {
          parenDepth--;
          if (parenDepth === 0) break;
        }
        rangeArgTokens.push(tokens[i]);
        i++;
      }
      i++; // skip ')'

      // Parse range arguments
      const rangeArgs = parseRangeArgsSimple(rangeArgTokens, symbols);
      if (!rangeArgs) {
        result.push(...tokens.slice(forIndex, i));
        continue;
      }

      // Expect '{'
      if (i >= tokens.length || tokens[i].type !== TokenType.BRACE_OPEN) {
        result.push(...tokens.slice(forIndex, i));
        continue;
      }
      i++; // skip '{'

      // Collect loop body until matching '}'
      const bodyTokens: Token[] = [];
      let braceDepth = 1;
      while (i < tokens.length && braceDepth > 0) {
        if (tokens[i].type === TokenType.BRACE_OPEN) braceDepth++;
        if (tokens[i].type === TokenType.BRACE_CLOSE) {
          braceDepth--;
          if (braceDepth === 0) break;
        }
        bodyTokens.push(tokens[i]);
        i++;
      }
      i++; // skip '}'

      // Expand this loop: for each iteration, substitute variable and recurse
      const { start, end, step } = rangeArgs;
      const shouldContinue = step > 0
        ? (j: number) => j < end
        : (j: number) => j > end;

      for (let iterValue = start; shouldContinue(iterValue); iterValue += step) {
        // Substitute the variable in body tokens
        const substituted = processBodyTokensWithCoordinateEval(bodyTokens, varName, iterValue);

        // Recursively expand any nested loops in the substituted tokens
        if (containsNestedLoop(substituted)) {
          const fullyExpanded = expandRemainingLoops(substituted, symbols);
          result.push(...fullyExpanded);
        } else {
          result.push(...substituted);
        }
      }

      continue;
    }

    // Not a for loop, copy token as-is
    result.push({ ...t });
    i++;
  }

  return result;
}

/**
 * Generates unrolled loop tokens (default behavior)
 *
 * Supports dynamic coordinates: if the loop variable is used in @col,row: position,
 * coordinate expressions are evaluated (e.g., @k%4,k/4: becomes @0,0:).
 * For operand positions, IMM(value) is used.
 */
function generateUnrolledLoop(
  bodyTokens: Token[],
  varName: string,
  range: RangeArgs,
  unrollFactor: number | undefined,
  line: number
): Token[] {
  const { start, end, step } = range;
  const expandedTokens: Token[] = [];

  const shouldContinue = step > 0
    ? (i: number) => i < end
    : (i: number) => i > end;

  if (unrollFactor && unrollFactor > 0) {
    // Partial unroll
    let iterCount = 0;
    for (let i = start; shouldContinue(i) && iterCount < unrollFactor; i += step) {
      const processed = processBodyTokensWithCoordinateEval(bodyTokens, varName, i);
      expandedTokens.push(...processed);
      iterCount++;
    }
  } else {
    // Full unroll
    for (let i = start; shouldContinue(i); i += step) {
      const processed = processBodyTokensWithCoordinateEval(bodyTokens, varName, i);
      expandedTokens.push(...processed);
    }
  }

  return expandedTokens;
}

/**
 * Generates runtime loop with branch/jump instructions
 */
function generateRuntimeLoop(
  bodyTokens: Token[],
  varName: string,
  range: RangeArgs,
  controlRow: number,
  controlCol: number,
  state: ParserState,
  line: number
): Token[] {
  const { start, end, step } = range;
  const col = 1;
  const cycleCounter = currentCycleNumber(state);

  const uniqueId = cycleCounter;
  const startLabel = `_for_start_${uniqueId}`;
  const endLabel = `_for_end_${uniqueId}`;

  // Analyze body for fusion optimization
  const bodyAnalysis = analyzeBodyForFusion(bodyTokens, varName, controlRow, controlCol);
  const bodyCycleCount = countCyclesInTokens(bodyTokens);

  const syntheticTokens: Token[] = [];

  if (bodyAnalysis.canFuse) {
    // Aggressive optimization: 2 cycles per iteration
    registerLabel(state, startLabel, cycleCounter);
    registerLabel(state, endLabel, cycleCounter + 2);

    // Calculate jump PE location
    const usedCols = new Set([controlCol, bodyAnalysis.bodyCol]);
    let jumpCol = (Math.max(controlCol, bodyAnalysis.bodyCol) + 1) % 4;
    while (usedCols.has(jumpCol)) {
      jumpCol = (jumpCol + 1) % 4;
    }

    // --- Condition Check Cycle ---
    syntheticTokens.push(...createLabeledCycleHeader(startLabel, line, col));

    // BGE @ control PE
    syntheticTokens.push(...createLocationPrefix(controlCol, controlRow, line, col));
    const branchOp = step > 0 ? 'BGE' : 'BLT';
    syntheticTokens.push(...createBranchInstruction(branchOp, varName, end.toString(), endLabel, line, col));

    // Relay counter to body PE
    syntheticTokens.push(...createLocationPrefix(bodyAnalysis.bodyCol, bodyAnalysis.bodyRow, line, col));
    syntheticTokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line, col));
    syntheticTokens.push(createToken(TokenType.IDENTIFIER, 'R3', line, col));
    syntheticTokens.push(createToken(TokenType.OPERATOR, ',', line, col));
    syntheticTokens.push(createToken(TokenType.IDENTIFIER, bodyAnalysis.neighborRef, line, col));
    syntheticTokens.push(createToken(TokenType.OPERATOR, ',', line, col));
    syntheticTokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line, col));
    syntheticTokens.push(createToken(TokenType.SEMICOLON, ';', line, col));

    syntheticTokens.push(...createCycleFooter(line, col));

    // --- FUSED Cycle: Body + Increment + Jump ---
    syntheticTokens.push(...createCycleHeader(line, col));

    // Body instruction with ROUT substitution
    let foundInstruction = false;
    for (let i = 0; i < bodyAnalysis.bodyTokens.length; i++) {
      const t = bodyAnalysis.bodyTokens[i];
      if (t.type === TokenType.AT_SYMBOL) {
        while (i < bodyAnalysis.bodyTokens.length) {
          const token = bodyAnalysis.bodyTokens[i];
          if (token.type === TokenType.IDENTIFIER && token.value === bodyAnalysis.neighborRef) {
            syntheticTokens.push({ ...token, value: 'ROUT' });
          } else {
            syntheticTokens.push(token);
          }
          if (token.type === TokenType.SEMICOLON) {
            foundInstruction = true;
            break;
          }
          i++;
        }
        break;
      }
    }

    if (!foundInstruction) {
      throw { message: 'Internal error: could not extract body instruction for fusion', line };
    }

    // Increment @ control PE
    syntheticTokens.push(...createLocationPrefix(controlCol, controlRow, line, col));
    syntheticTokens.push(...createIncrementInstruction(varName, step, line, col));

    // Jump @ jumpCol
    syntheticTokens.push(...createLocationPrefix(jumpCol, controlRow, line, col));
    syntheticTokens.push(...createJumpInstruction(startLabel, line, col));

    syntheticTokens.push(...createCycleFooter(line, col));

  } else {
    // Standard optimization: 3 cycles per iteration
    registerLabel(state, startLabel, cycleCounter);
    registerLabel(state, endLabel, cycleCounter + 1 + bodyCycleCount + 1);

    const jumpCol = (controlCol + 1) % 4;

    // --- Condition Check Cycle ---
    syntheticTokens.push(...createLabeledCycleHeader(startLabel, line, col));
    syntheticTokens.push(...createLocationPrefix(controlCol, controlRow, line, col));
    const branchOp = step > 0 ? 'BGE' : 'BLT';
    syntheticTokens.push(...createBranchInstruction(branchOp, varName, end.toString(), endLabel, line, col));
    syntheticTokens.push(...createCycleFooter(line, col));

    // --- Body Tokens (unchanged) ---
    syntheticTokens.push(...bodyTokens);

    // --- Fused Increment + Jump Cycle ---
    syntheticTokens.push(...createCycleHeader(line, col));

    // Increment @ control PE
    syntheticTokens.push(...createLocationPrefix(controlCol, controlRow, line, col));
    syntheticTokens.push(...createIncrementInstruction(varName, step, line, col));

    // Jump @ jumpCol
    syntheticTokens.push(...createLocationPrefix(jumpCol, controlRow, line, col));
    syntheticTokens.push(...createJumpInstruction(startLabel, line, col));

    syntheticTokens.push(...createCycleFooter(line, col));
  }

  return syntheticTokens;
}

/**
 * Generates parallel loop tokens (distribute across columns)
 *
 * Behavior depends on pragma modifiers:
 * - #pragma parallel: Wave-based distribution across columns (original behavior)
 * - #pragma parallel collapse: Collapses all iterations into same cycle blocks
 *   (requires dynamic coordinates like @i,j)
 *
 * The 'collapse' modifier is similar to OpenMP's collapse clause for nested loops.
 */
function generateParallelLoop(
  bodyTokens: Token[],
  varName: string,
  range: RangeArgs,
  symbols: SymbolTable,
  line: number,
  pragma: PragmaDirective | null
): Token[] {
  // Check if 'collapse' modifier is present and get its depth argument
  const collapseModifier = pragma?.modifiers?.find(m => m.name === 'collapse');
  const hasCollapseModifier = collapseModifier !== undefined;
  // collapse(N) specifies how many nested loop levels to collapse (default: all levels = Infinity)
  const collapseDepth = collapseModifier?.arg ?? Infinity;

  // Check if body contains dynamic coordinates using the loop variable
  const hasDynCoords = hasDynamicCoordinates(bodyTokens, varName);

  if (hasCollapseModifier && hasDynCoords) {
    // Collapse all iterations into same cycle blocks (requires dynamic coords)
    return generateParallelLoopWithDynamicCoords(bodyTokens, varName, range, symbols, line, collapseDepth);
  } else {
    // Original behavior: wave-based distribution across columns
    return generateParallelLoopWaves(bodyTokens, varName, range, line);
  }
}

/**
 * Generates parallel loop with dynamic coordinates.
 * All iterations collapse into the same cycle blocks.
 *
 * Supports nested loops - inner loops are expanded first, then all iterations
 * from both outer and inner loops collapse into parallel cycles.
 *
 * Example:
 *   #pragma parallel
 *   for i in range(4) {
 *     for j in range(4) {
 *       cycle { @i,j: SADD R0, ZERO, i; }
 *     }
 *   }
 *
 * Generates 1 cycle with 16 instructions (4x4 grid fully utilized).
 */
function generateParallelLoopWithDynamicCoords(
  bodyTokens: Token[],
  varName: string,
  range: RangeArgs,
  symbols: SymbolTable,
  line: number,
  collapseDepth: number = Infinity
): Token[] {
  const { start, end, step } = range;

  const shouldContinue = step > 0
    ? (i: number) => i < end
    : (i: number) => i > end;

  // Check if body contains nested loops
  const hasNestedLoops = containsNestedLoop(bodyTokens);

  if (hasNestedLoops) {
    // Expand ALL iterations of outer loop, each expanding nested loops up to collapseDepth
    let allExpandedTokens: Token[] = [];

    for (let iterValue = start; shouldContinue(iterValue); iterValue += step) {
      const expanded = expandNestedLoops(bodyTokens, varName, iterValue, symbols, collapseDepth);
      allExpandedTokens.push(...expanded);
    }

    // Check if there are remaining loops to expand sequentially
    const hasRemainingLoops = containsNestedLoop(allExpandedTokens);

    if (hasRemainingLoops) {
      // Count parallel units = number of remaining for loops (each will be expanded to multiple cycles)
      const parallelUnits = countForLoops(allExpandedTokens);

      // Expand remaining loops
      allExpandedTokens = expandRemainingLoops(allExpandedTokens, symbols);

      // Count total cycles after expansion
      const totalCycles = countCyclesInTokens(allExpandedTokens);
      if (totalCycles === 0) {
        return allExpandedTokens;
      }

      // Cycles per parallel unit = sequential cycles from unexpanded loops
      const cyclesPerParallelUnit = Math.max(1, Math.floor(totalCycles / parallelUnits));

      // Collapse: group cycles with same relative position
      return collapseExpandedCycles(allExpandedTokens, cyclesPerParallelUnit, line);
    }

    // No remaining loops - use original collapse logic
    const cyclesPerIteration = countCyclesInInnermostBody(bodyTokens);
    if (cyclesPerIteration === 0) {
      return allExpandedTokens;
    }

    // Collapse: group cycles with same relative position
    return collapseExpandedCycles(allExpandedTokens, cyclesPerIteration, line);
  }

  // No nested loops - original behavior
  const expandedTokens: Token[] = [];
  const cycleTemplates = extractCycleStructure(bodyTokens);

  if (cycleTemplates.length === 0) {
    return generateUnrolledLoop(bodyTokens, varName, range, undefined, line);
  }

  // For each cycle template, generate ONE collapsed cycle with all iterations
  for (const template of cycleTemplates) {
    expandedTokens.push(createToken(TokenType.KEYWORD, 'cycle', line, 1));
    expandedTokens.push(createToken(TokenType.BRACE_OPEN, '{', line, 1));

    for (let iterValue = start; shouldContinue(iterValue); iterValue += step) {
      const processed = processBodyTokensWithCoordinateEval(
        template.instructionTokens,
        varName,
        iterValue
      );
      expandedTokens.push(...processed);
    }

    expandedTokens.push(createToken(TokenType.BRACE_CLOSE, '}', line, 1));
  }

  return expandedTokens;
}

/**
 * Collapses expanded cycles by grouping cycles with the same relative position.
 * After nested loop expansion, we have many cycle blocks. This function groups them
 * so that cycle[0] from all iterations become one parallel cycle, cycle[1] become another, etc.
 *
 * Example: If we have 16 iterations and 4 cycles per iteration (64 total cycles),
 * this function collapses them into 4 cycles, each with 16 instructions.
 *
 * @param tokens - Expanded tokens with many cycle blocks
 * @param cyclesPerIteration - Number of cycles in each loop iteration body
 * @param line - Line number for generated tokens
 */
function collapseExpandedCycles(
  tokens: Token[],
  cyclesPerIteration: number,
  line: number
): Token[] {
  const cycles = extractCycleStructure(tokens);

  if (cycles.length === 0) {
    return tokens;
  }

  // If cyclesPerIteration is 0 or invalid, can't collapse
  if (cyclesPerIteration <= 0) {
    // Just return as-is
    const result: Token[] = [];
    for (const cycle of cycles) {
      result.push(createToken(TokenType.KEYWORD, 'cycle', line, 1));
      result.push(createToken(TokenType.BRACE_OPEN, '{', line, 1));
      result.push(...cycle.instructionTokens);
      result.push(createToken(TokenType.BRACE_CLOSE, '}', line, 1));
    }
    return result;
  }

  // Group cycles by their position within the iteration
  // cycles[0], cycles[cyclesPerIteration], cycles[2*cyclesPerIteration], ... → collapsed cycle 0
  // cycles[1], cycles[cyclesPerIteration+1], cycles[2*cyclesPerIteration+1], ... → collapsed cycle 1
  // etc.

  const collapsedCycles: Token[][] = [];
  for (let pos = 0; pos < cyclesPerIteration; pos++) {
    collapsedCycles[pos] = [];
  }

  for (let i = 0; i < cycles.length; i++) {
    const position = i % cyclesPerIteration;
    collapsedCycles[position].push(...cycles[i].instructionTokens);
  }

  // Emit collapsed cycles
  const result: Token[] = [];
  for (const cycleInstructions of collapsedCycles) {
    result.push(createToken(TokenType.KEYWORD, 'cycle', line, 1));
    result.push(createToken(TokenType.BRACE_OPEN, '{', line, 1));
    result.push(...cycleInstructions);
    result.push(createToken(TokenType.BRACE_CLOSE, '}', line, 1));
  }

  return result;
}

/**
 * Original wave-based parallel loop (when no dynamic coordinates).
 * Distributes iterations across columns, using waves if iterations > grid width.
 */
function generateParallelLoopWaves(
  bodyTokens: Token[],
  varName: string,
  range: RangeArgs,
  line: number
): Token[] {
  const { start, end, step } = range;
  const iterations = calculateIterations(range);
  const GRID_WIDTH = 4;

  const waveSize = Math.min(iterations, GRID_WIDTH);
  const numWaves = Math.ceil(iterations / waveSize);
  const expandedTokens: Token[] = [];

  // For each wave, execute iterations in parallel across columns
  for (let wave = 0; wave < numWaves; wave++) {
    const waveStart = start + wave * waveSize * step;

    // Clone body for each column in this wave
    for (let col = 0; col < waveSize; col++) {
      const iterValue = waveStart + col * step;

      // Check if this iteration is valid
      if (step > 0 && iterValue >= end) continue;
      if (step < 0 && iterValue <= end) continue;

      // Process with coordinate evaluation
      const processed = processBodyTokensWithCoordinateEval(bodyTokens, varName, iterValue);
      expandedTokens.push(...processed);
    }
  }

  return expandedTokens;
}

// ==========================================
// Body Analysis Functions
// ==========================================

/**
 * Analyzes loop body for fusion optimization potential
 */
function analyzeBodyForFusion(
  bodyTokens: Token[],
  varName: string,
  controlRow: number,
  controlCol: number
): BodyFusionAnalysis {
  const result: BodyFusionAnalysis = {
    canFuse: false,
    bodyCol: 0,
    bodyRow: 0,
    bodyTokens: [],
    neighborRef: ''
  };

  // Count cycles and find body structure
  let cycleCount = 0;
  let bodyPeCol = -1;
  let bodyPeRow = -1;
  let instructionCount = 0;
  let usesCounter = false;

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
        bodyPeRow = parseInt(rowToken.value);
        bodyPeCol = parseInt(colToken.value);
        instructionCount++;
      }
    }

    // Detect visual syntax (row N:) - skip fusion
    if (t.type === TokenType.KEYWORD && t.value.toLowerCase() === 'row') {
      return result;
    }

    // Check if counter is used
    if (t.type === TokenType.IDENTIFIER && t.value === varName) {
      usesCounter = true;
    }
  }

  // Check fusion conditions
  if (cycleCount !== 1) return result;
  if (instructionCount !== 1) return result;
  if (bodyPeCol < 0 || bodyPeRow < 0) return result;
  if (!usesCounter) return result;
  if (bodyPeRow !== controlRow) return result;

  // Determine neighbor reference
  const neighborRef = calculateNeighborRef(controlCol, controlRow, bodyPeCol, bodyPeRow);
  if (!neighborRef) return result;

  // Build modified body tokens with varName replaced by neighborRef
  const modifiedTokens = replaceVariable(bodyTokens, varName, neighborRef);

  result.canFuse = true;
  result.bodyCol = bodyPeCol;
  result.bodyRow = bodyPeRow;
  result.bodyTokens = modifiedTokens;
  result.neighborRef = neighborRef;

  return result;
}
