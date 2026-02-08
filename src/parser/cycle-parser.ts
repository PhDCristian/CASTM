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
    // Function call inside cycle
    else if (stream.peek().type === TokenType.IDENTIFIER &&
      context.symbols.functions.has(stream.peek().value)) {
      expandFunctionCall(stream, context);
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
function expandFunctionCall(
  stream: TokenStream,
  context: CycleParserContext
): void {
  const funcName = stream.advance().value;
  const func = context.symbols.functions.get(funcName)!;

  stream.expect(TokenType.OPERATOR, '(');

  const args: Token[][] = [];
  if (stream.peek().value !== ')') {
    let currentArg: Token[] = [];
    let parenCount = 0;
    while (!(stream.peek().value === ')' && parenCount === 0)) {
      // Only split if we haven't reached the last argument yet
      if (stream.peek().value === ',' && parenCount === 0 && args.length < func.params.length - 1) {
        args.push(currentArg);
        currentArg = [];
        stream.advance();
      } else {
        const t = stream.advance();
        if (t.value === '(') parenCount++;
        if (t.value === ')') parenCount--;
        currentArg.push(t);
      }
    }
    args.push(currentArg);
  }
  stream.expect(TokenType.OPERATOR, ')');
  stream.expect(TokenType.SEMICOLON);

  // Expand Function
  const expandedTokens: Token[] = [];
  for (const t of func.tokens) {
    if (t.type === TokenType.IDENTIFIER && func.params.includes(t.value)) {
      const paramIndex = func.params.indexOf(t.value);
      if (paramIndex >= 0 && paramIndex < args.length) {
        expandedTokens.push(...args[paramIndex]);
      } else {
        expandedTokens.push(t);
      }
    } else {
      expandedTokens.push(t);
    }
  }

  // Inject expanded tokens at current position
  context.tokens.splice(stream.position, 0, ...expandedTokens);
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
