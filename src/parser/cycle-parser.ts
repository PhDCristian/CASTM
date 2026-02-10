/**
 * OpenEdge-DSL Cycle Parser
 *
 * Handles parsing of cycle blocks in the DSL.
 * Supports three instruction placement styles:
 * - Style A: Visual pipe syntax (row N: instr | instr | instr;)
 * - Style A': Broadcast syntax (row N: instr;) - replicates to all columns
 * - Style B: Structural block syntax (row N { col 0: instr; col 1: instr; })
 * - Style C: Direct coordinate syntax (@row,col: instr;) - follows C convention [row][col]
 * - Style D: all: instr; - replicates to all 16 PEs
 * - Style E: col N: instr; - replicates to all rows in column N
 */

import { Token, TokenType } from '../types/tokens';
import { Instruction, CycleBlock } from '../types/ast';
import { SymbolTable, FunctionDefinition } from '../types/symbols';
import { TokenStream } from './token-stream';
import { parseInstruction as parseInstructionFromStream } from './instruction-parser';
import { evaluateSimpleExpression } from '../utils/expression';
import { parseFunctionArgs, expandFunctionTokens } from './function-parser';
import {
  RESERVED_LOOP_VARIABLES,
  parseRangeArgs,
  calculateIterations,
  validateIterationCount,
  processBodyTokensWithCoordinateEval
} from './control-flow-utils';

/**
 * Context for cycle parsing, including access to parser state
 */
export interface CycleParserContext {
  /** Current cycle number */
  cycleCounter: number;
  /** Symbol table with function definitions */
  symbols: SymbolTable;
  /** Token array (for injection during function expansion) */
  tokens: Token[];
  /** Current position in token array */
  current: number;
}

/**
 * Result of parsing a cycle block
 */
export interface CycleParseResult {
  /** The parsed cycle block */
  cycleBlock: CycleBlock;
  /** Updated cycle counter */
  cycleCounter: number;
  /** Whether token injection occurred (affects parsing flow) */
  tokensInjected: boolean;
}

/**
 * Parses a complete cycle block from the token stream.
 * Expects 'cycle' keyword has been matched, '{' is next.
 *
 * @param stream - Token stream positioned after 'cycle' keyword
 * @param label - Optional label for the cycle (already parsed)
 * @param context - Parser context with state access
 * @returns Parsed cycle block result
 */
export function parseCycleBlock(
  stream: TokenStream,
  label: string | undefined,
  context: CycleParserContext
): CycleParseResult {
  stream.expect(TokenType.BRACE_OPEN);

  const cycleBlock: CycleBlock = {
    cycleNumber: context.cycleCounter,
    label,
    instructions: new Map(),
  };

  let tokensInjected = false;

  // Parse instructions inside cycle
  while (!stream.check(TokenType.BRACE_CLOSE)) {
    // Style C: Direct Coordinate @c,r: INSTR;
    if (stream.match(TokenType.AT_SYMBOL)) {
      const { row, col, instruction } = parseDirectCoordinateInstruction(stream, context.symbols);
      cycleBlock.instructions.set(`${row},${col}`, instruction);
      stream.expect(TokenType.SEMICOLON);
    }
    // Style A & B: Row based
    else if (stream.match(TokenType.KEYWORD, 'row')) {
      const instructions = parseRowInstructions(stream, context.symbols);
      for (const [key, instr] of instructions) {
        cycleBlock.instructions.set(key, instr);
      }
    }
    // Style D: all: instr; — replicate to all 16 PEs
    else if (stream.peek().type === TokenType.IDENTIFIER &&
      stream.peek().value.toLowerCase() === 'all') {
      stream.advance(); // consume 'all'
      stream.expect(TokenType.OPERATOR, ':');
      const instr = parseInstructionFromStream(stream, context.symbols);
      stream.expect(TokenType.SEMICOLON);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          cycleBlock.instructions.set(`${r},${c}`, { ...instr });
        }
      }
    }
    // Style E: col N: instr; — replicate to all rows in column N
    else if (stream.match(TokenType.KEYWORD, 'col')) {
      const col = parseInt(stream.expect(TokenType.NUMBER).value);
      stream.expect(TokenType.OPERATOR, ':');
      const instr = parseInstructionFromStream(stream, context.symbols);
      stream.expect(TokenType.SEMICOLON);
      for (let r = 0; r < 4; r++) {
        cycleBlock.instructions.set(`${r},${col}`, { ...instr });
      }
    }
    // Inline for-loop inside cycle: for i in range(...) { ... }
    else if (stream.match(TokenType.KEYWORD, 'for')) {
      expandForLoopInsideCycle(stream, context.symbols, context.tokens);
      tokensInjected = true;
    }
    // Function call inside cycle
    else if (stream.peek().type === TokenType.IDENTIFIER &&
      context.symbols.functions.has(stream.peek().value)) {
      expandFunctionCallInsideCycle(stream, context);
      tokensInjected = true;
      // Continue parsing - injected tokens are now at current position
      // The next iteration will parse the expanded function body
    }
    else {
      throw {
        message: `Unexpected token inside cycle: ${stream.peek().value}`,
        line: stream.peek().line
      };
    }
  }

  if (!tokensInjected) {
    stream.expect(TokenType.BRACE_CLOSE);
  }

  return {
    cycleBlock,
    cycleCounter: context.cycleCounter + 1,
    tokensInjected
  };
}

/**
 * Parses a direct coordinate instruction: @row,col: INSTRUCTION;
 * Follows C convention where first index is row, second is column.
 */
function parseDirectCoordinateInstruction(
  stream: TokenStream,
  symbols: SymbolTable
): { row: number; col: number; instruction: Instruction } {
  const row = parseInt(stream.expect(TokenType.NUMBER).value);
  stream.expect(TokenType.OPERATOR, ',');
  const col = parseInt(stream.expect(TokenType.NUMBER).value);
  stream.expect(TokenType.OPERATOR, ':');

  const instruction = parseInstructionFromStream(stream, symbols);

  return { row, col, instruction };
}

/**
 * Parses row-based instructions in Style A (visual), A' (broadcast), or B (structural).
 *
 * Style A:  row N: instr | instr | instr;   (pipe-separated, one per column)
 * Style A': row N: instr;                   (no pipes = broadcast to all 4 columns)
 * Style B:  row N { col 0: instr; col 1: instr; }
 */
function parseRowInstructions(
  stream: TokenStream,
  symbols: SymbolTable
): Map<string, Instruction> {
  const instructions = new Map<string, Instruction>();
  const row = parseInt(stream.expect(TokenType.NUMBER).value);

  // Style B: Structural Block { ... }
  if (stream.match(TokenType.BRACE_OPEN)) {
    while (!stream.check(TokenType.BRACE_CLOSE)) {
      stream.expect(TokenType.KEYWORD, 'col');
      const col = parseInt(stream.expect(TokenType.NUMBER).value);
      stream.expect(TokenType.OPERATOR, ':');
      const instr = parseInstructionFromStream(stream, symbols);
      instructions.set(`${row},${col}`, instr);
      stream.expect(TokenType.SEMICOLON);
    }
    stream.expect(TokenType.BRACE_CLOSE);
  }
  // Style A / A': Visual Pipe or Broadcast
  else if (stream.match(TokenType.OPERATOR, ':')) {
    // Parse first instruction (or underscore)
    if (stream.match(TokenType.UNDERSCORE)) {
      // First column is NOP — check for pipe continuation
      if (stream.check(TokenType.OPERATOR, '|')) {
        // Pipe style — continue with remaining columns
        let col = 1;
        while (stream.match(TokenType.OPERATOR, '|')) {
          if (col > 3) {
            throw { message: `Too many columns in row ${row}`, line: stream.peek().line };
          }
          if (stream.match(TokenType.UNDERSCORE)) {
            // NOP
          } else {
            const instr = parseInstructionFromStream(stream, symbols);
            instructions.set(`${row},${col}`, instr);
          }
          col++;
        }
      }
      // If no pipe, underscore alone = NOP for all (no instructions)
    } else {
      const firstInstr = parseInstructionFromStream(stream, symbols);

      // Check if this is pipe style (Style A) or broadcast (Style A')
      if (stream.check(TokenType.OPERATOR, '|')) {
        // Style A: Pipe-separated — first instr goes to col 0
        instructions.set(`${row},0`, firstInstr);
        let col = 1;
        while (stream.match(TokenType.OPERATOR, '|')) {
          if (col > 3) {
            throw { message: `Too many columns in row ${row}`, line: stream.peek().line };
          }
          if (stream.match(TokenType.UNDERSCORE)) {
            // NOP
          } else {
            const instr = parseInstructionFromStream(stream, symbols);
            instructions.set(`${row},${col}`, instr);
          }
          col++;
        }
      } else {
        // Style A': No pipes — broadcast to all 4 columns
        for (let col = 0; col < 4; col++) {
          instructions.set(`${row},${col}`, { ...firstInstr });
        }
      }
    }
    stream.expect(TokenType.SEMICOLON);
  }
  else {
    throw { message: `Expected '{' or ':' after row definition`, line: stream.peek().line };
  }

  return instructions;
}

/**
 * Expands a function call by injecting its tokens into the stream.
 * This modifies the token array in place.
 */
function expandFunctionCallInsideCycle(
  stream: TokenStream,
  context: CycleParserContext
): void {
  const funcName = stream.advance().value;
  const func = context.symbols.functions.get(funcName)!;

  const { args, position } = parseFunctionArgs(context.tokens, stream.position, func);
  let insertionPos = position;
  if (context.tokens[insertionPos]?.type === TokenType.SEMICOLON) {
    insertionPos++;
  }

  const expandedTokens = expandFunctionTokens(func, args, funcName);
  context.tokens.splice(insertionPos, 0, ...expandedTokens);
  stream.position = insertionPos;
}

function expandForLoopInsideCycle(
  stream: TokenStream,
  symbols: SymbolTable,
  tokens: Token[]
): void {
  const varToken = stream.peek();
  if (varToken.type !== TokenType.IDENTIFIER && varToken.type !== TokenType.UNDERSCORE) {
    throw { message: `Expected identifier for loop variable, got '${varToken.value}'`, line: varToken.line };
  }
  const varName = stream.advance().value;

  if (RESERVED_LOOP_VARIABLES.includes(varName.toLowerCase() as any)) {
    throw { message: `Cannot use reserved keyword '${varName}' as iteration variable`, line: varToken.line };
  }

  stream.expect(TokenType.KEYWORD, 'in');
  stream.expect(TokenType.KEYWORD, 'range');
  stream.expect(TokenType.OPERATOR, '(');
  const rangeArgs = parseNumericRangeArgs(stream, symbols);
  stream.expect(TokenType.OPERATOR, ')');

  const range = parseRangeArgs(rangeArgs, varToken.line);
  const iterations = calculateIterations(range);
  validateIterationCount(iterations, varToken.line);

  stream.expect(TokenType.BRACE_OPEN);
  const loopBodyTokens = collectBalancedBraceTokens(stream);

  const expandedTokens: Token[] = [];
  const occupied = new Set<string>();
  for (let iter = range.start; range.step > 0 ? iter < range.end : iter > range.end; iter += range.step) {
    const processed = processBodyTokensWithCoordinateEval(loopBodyTokens, varName, iter);
    const assigned = collectAssignedCoordinates(processed);
    for (const key of assigned) {
      if (occupied.has(key)) {
        const [row, col] = key.split(',');
        throw {
          message: `PE (${row},${col}) assigned multiple times in the same cycle`,
          line: varToken.line
        };
      }
      occupied.add(key);
    }
    expandedTokens.push(...processed);
  }

  tokens.splice(stream.position, 0, ...expandedTokens);
}

function collectAssignedCoordinates(tokens: Token[]): Set<string> {
  const assigned = new Set<string>();
  let i = 0;

  while (i < tokens.length) {
    // @row,col: instr;
    if (
      tokens[i].type === TokenType.AT_SYMBOL &&
      tokens[i + 1]?.type === TokenType.NUMBER &&
      tokens[i + 2]?.type === TokenType.OPERATOR && tokens[i + 2].value === ',' &&
      tokens[i + 3]?.type === TokenType.NUMBER &&
      tokens[i + 4]?.type === TokenType.OPERATOR && tokens[i + 4].value === ':'
    ) {
      assigned.add(`${tokens[i + 1].value},${tokens[i + 3].value}`);
      const { nextPos } = consumeStatementUntilSemicolon(tokens, i + 5);
      i = nextPos;
      continue;
    }

    // all: instr;
    if (
      tokens[i].type === TokenType.IDENTIFIER &&
      tokens[i].value.toLowerCase() === 'all' &&
      tokens[i + 1]?.type === TokenType.OPERATOR &&
      tokens[i + 1].value === ':'
    ) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          assigned.add(`${row},${col}`);
        }
      }
      const { nextPos } = consumeStatementUntilSemicolon(tokens, i + 2);
      i = nextPos;
      continue;
    }

    // col N: instr;
    if (
      tokens[i].type === TokenType.KEYWORD &&
      tokens[i].value.toLowerCase() === 'col' &&
      tokens[i + 1]?.type === TokenType.NUMBER &&
      tokens[i + 2]?.type === TokenType.OPERATOR &&
      tokens[i + 2].value === ':'
    ) {
      const col = parseInt(tokens[i + 1].value, 10);
      if (!Number.isNaN(col)) {
        for (let row = 0; row < 4; row++) {
          assigned.add(`${row},${col}`);
        }
      }
      const { nextPos } = consumeStatementUntilSemicolon(tokens, i + 3);
      i = nextPos;
      continue;
    }

    // row N: ... ;  OR  row N { col ...; }
    if (
      tokens[i].type === TokenType.KEYWORD &&
      tokens[i].value.toLowerCase() === 'row' &&
      tokens[i + 1]?.type === TokenType.NUMBER
    ) {
      const row = parseInt(tokens[i + 1].value, 10);
      const next = tokens[i + 2];

      // row N { col 0: ...; col 1: ...; }
      if (next?.type === TokenType.BRACE_OPEN) {
        const { blockTokens, nextPos } = consumeBraceBlock(tokens, i + 2);
        if (!Number.isNaN(row)) {
          let blockPos = 0;
          while (blockPos < blockTokens.length) {
            if (
              blockTokens[blockPos].type === TokenType.KEYWORD &&
              blockTokens[blockPos].value.toLowerCase() === 'col' &&
              blockTokens[blockPos + 1]?.type === TokenType.NUMBER &&
              blockTokens[blockPos + 2]?.type === TokenType.OPERATOR &&
              blockTokens[blockPos + 2].value === ':'
            ) {
              const col = parseInt(blockTokens[blockPos + 1].value, 10);
              if (!Number.isNaN(col)) {
                assigned.add(`${row},${col}`);
              }
              const consumed = consumeStatementUntilSemicolon(blockTokens, blockPos + 3);
              blockPos = consumed.nextPos;
              continue;
            }
            blockPos++;
          }
        }
        i = nextPos;
        continue;
      }

      // row N: instr | instr | ... ;
      if (next?.type === TokenType.OPERATOR && next.value === ':') {
        const { statementTokens, nextPos } = consumeStatementUntilSemicolon(tokens, i + 3);
        if (!Number.isNaN(row)) {
          const segments = splitByTopLevelPipe(statementTokens);
          if (segments.length <= 1) {
            if (!isUnderscoreSegment(segments[0] || [])) {
              for (let col = 0; col < 4; col++) {
                assigned.add(`${row},${col}`);
              }
            }
          } else {
            for (let col = 0; col < segments.length; col++) {
              if (col > 3) break; // parser rejects >4 columns; we ignore extra in conflict scan
              if (!isUnderscoreSegment(segments[col])) {
                assigned.add(`${row},${col}`);
              }
            }
          }
        }
        i = nextPos;
        continue;
      }
    }

    i++;
  }

  return assigned;
}

function consumeStatementUntilSemicolon(tokens: Token[], start: number): { statementTokens: Token[]; nextPos: number } {
  const statementTokens: Token[] = [];
  let pos = start;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  while (pos < tokens.length) {
    const t = tokens[pos];
    if (t.type === TokenType.OPERATOR && t.value === '(') parenDepth++;
    else if (t.type === TokenType.OPERATOR && t.value === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (t.type === TokenType.OPERATOR && t.value === '[') bracketDepth++;
    else if (t.type === TokenType.OPERATOR && t.value === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (t.type === TokenType.BRACE_OPEN) braceDepth++;
    else if (t.type === TokenType.BRACE_CLOSE) braceDepth = Math.max(0, braceDepth - 1);

    if (
      t.type === TokenType.SEMICOLON &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      return { statementTokens, nextPos: pos + 1 };
    }

    statementTokens.push(t);
    pos++;
  }

  return { statementTokens, nextPos: pos };
}

function consumeBraceBlock(tokens: Token[], braceOpenPos: number): { blockTokens: Token[]; nextPos: number } {
  const blockTokens: Token[] = [];
  let pos = braceOpenPos;
  let depth = 0;

  while (pos < tokens.length) {
    const t = tokens[pos];
    if (t.type === TokenType.BRACE_OPEN) {
      depth++;
      if (depth > 1) blockTokens.push(t);
      pos++;
      continue;
    }
    if (t.type === TokenType.BRACE_CLOSE) {
      depth--;
      pos++;
      if (depth === 0) {
        return { blockTokens, nextPos: pos };
      }
      blockTokens.push(t);
      continue;
    }
    if (depth > 0) {
      blockTokens.push(t);
    }
    pos++;
  }

  return { blockTokens, nextPos: pos };
}

function splitByTopLevelPipe(tokens: Token[]): Token[][] {
  const segments: Token[][] = [];
  let current: Token[] = [];
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (const t of tokens) {
    if (t.type === TokenType.OPERATOR && t.value === '(') parenDepth++;
    else if (t.type === TokenType.OPERATOR && t.value === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (t.type === TokenType.OPERATOR && t.value === '[') bracketDepth++;
    else if (t.type === TokenType.OPERATOR && t.value === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (t.type === TokenType.BRACE_OPEN) braceDepth++;
    else if (t.type === TokenType.BRACE_CLOSE) braceDepth = Math.max(0, braceDepth - 1);

    if (
      t.type === TokenType.OPERATOR &&
      t.value === '|' &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      segments.push(current);
      current = [];
      continue;
    }

    current.push(t);
  }

  segments.push(current);
  return segments;
}

function isUnderscoreSegment(segment: Token[]): boolean {
  return segment.length === 1 && segment[0].type === TokenType.UNDERSCORE;
}

function parseNumericRangeArgs(stream: TokenStream, symbols: SymbolTable): number[] {
  const args: number[] = [];
  let currentArgTokens: Token[] = [];
  let parenDepth = 0;

  while (!stream.isAtEnd()) {
    const t = stream.peek();
    if (t.type === TokenType.OPERATOR && t.value === ')' && parenDepth === 0) {
      break;
    }

    if (t.type === TokenType.OPERATOR && t.value === ',' && parenDepth === 0) {
      if (currentArgTokens.length === 0) {
        throw { message: 'range() has an empty argument', line: t.line };
      }
      args.push(evaluateRangeArg(currentArgTokens, symbols));
      currentArgTokens = [];
      stream.advance(); // consume comma
      continue;
    }

    if (t.type === TokenType.OPERATOR && t.value === '(') parenDepth++;
    if (t.type === TokenType.OPERATOR && t.value === ')') parenDepth--;

    currentArgTokens.push(stream.advance());
  }

  if (currentArgTokens.length > 0) {
    args.push(evaluateRangeArg(currentArgTokens, symbols));
  }

  return args;
}

function evaluateRangeArg(argTokens: Token[], symbols: SymbolTable): number {
  // Handle unary sign in simple literals: -1, +2
  if (
    argTokens.length === 2 &&
    argTokens[0].type === TokenType.OPERATOR &&
    (argTokens[0].value === '-' || argTokens[0].value === '+') &&
    argTokens[1].type === TokenType.NUMBER
  ) {
    const value = parseInt(argTokens[1].value, 10);
    return argTokens[0].value === '-' ? -value : value;
  }

  try {
    return evaluateSimpleExpression(argTokens.map(t => t.value), symbols);
  } catch (err: any) {
    throw {
      message: `Invalid range() argument '${argTokens.map(t => t.value).join(' ')}': ${err.message}`,
      line: argTokens[0]?.line ?? 0
    };
  }
}

function collectBalancedBraceTokens(stream: TokenStream): Token[] {
  const bodyTokens: Token[] = [];
  let braceDepth = 1;

  while (braceDepth > 0 && !stream.isAtEnd()) {
    const t = stream.advance();
    if (t.type === TokenType.BRACE_OPEN) braceDepth++;
    if (t.type === TokenType.BRACE_CLOSE) braceDepth--;
    if (braceDepth > 0) {
      bodyTokens.push(t);
    }
  }

  if (braceDepth !== 0) {
    throw { message: 'Unterminated for-loop body inside cycle block', line: stream.peek().line };
  }

  return bodyTokens;
}

/**
 * Helper to check if an optional label precedes a cycle keyword.
 * Returns the label if found, or undefined.
 *
 * @param stream - Token stream
 * @param symbols - Symbol table to register the label
 * @param cycleCounter - Current cycle number for label registration
 * @returns Label string or undefined
 */
export function parseOptionalLabel(
  stream: TokenStream,
  symbols: SymbolTable,
  cycleCounter: number
): string | undefined {
  // Check pattern: IDENTIFIER ':' 'cycle'
  if (stream.peek().type === TokenType.IDENTIFIER) {
    const nextToken = stream.peekAhead(1);
    const afterNext = stream.peekAhead(2);

    if (nextToken?.type === TokenType.OPERATOR &&
      nextToken?.value === ':' &&
      afterNext?.type === TokenType.KEYWORD &&
      afterNext?.value.toLowerCase() === 'cycle') {
      const label = stream.advance().value;
      stream.advance(); // Consume ':'
      symbols.labels.set(label, cycleCounter);
      return label;
    }
  }
  return undefined;
}

/**
 * Creates an empty cycle block with default values.
 */
export function createEmptyCycleBlock(
  cycleNumber: number,
  label?: string
): CycleBlock {
  return {
    cycleNumber,
    label,
    instructions: new Map(),
  };
}
