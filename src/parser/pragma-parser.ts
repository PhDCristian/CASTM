/**
 * OpenEdge-DSL Pragma Parser
 *
 * Handles parsing of pragma directives:
 * #pragma unroll, #pragma no_unroll, #pragma parallel, #pragma reduce, #pragma stencil
 */

import { Token, TokenType } from '../types/tokens';
import { PragmaDirective, PragmaModifier } from '../types/ast';
import { TokenStream } from './token-stream';
import { ParserState, setActivePragma } from './parser-state';

/**
 * Known pragma names
 */
export const PRAGMA_NAMES = [
  'unroll',
  'no_unroll',
  'inline',
  'no_fuse',
  'parallel',
  'reduce',
  'scan',
  'broadcast',
  'stencil',
  'route',
  'rotate',
  'shift'
] as const;

export type PragmaName = typeof PRAGMA_NAMES[number];

/**
 * Checks if a name is a valid pragma name
 */
export function isPragmaName(name: string): name is PragmaName {
  return PRAGMA_NAMES.includes(name.toLowerCase() as PragmaName);
}

/**
 * Valid modifiers for specific pragmas
 */
const PRAGMA_MODIFIERS: Record<string, string[]> = {
  'parallel': ['collapse']
};

/**
 * Parses a pragma directive from the token stream
 * The PRAGMA token has already been consumed, containing the pragma name
 *
 * Supports formats:
 * - #pragma parallel
 * - #pragma parallel collapse
 * - #pragma parallel collapse(2)
 * - #pragma unroll(4)
 */
export function parsePragma(
  stream: TokenStream,
  state: ParserState,
  pragmaName: string,
  line: number
): PragmaDirective {
  const pragma: PragmaDirective = {
    name: pragmaName.toLowerCase(),
    line
  };

  // Check for modifiers (identifiers after pragma name, optionally with arguments)
  // e.g., #pragma parallel collapse or #pragma parallel collapse(2)
  const validModifiers = PRAGMA_MODIFIERS[pragma.name] || [];
  while (stream.check(TokenType.IDENTIFIER)) {
    const nextToken = stream.peek();
    const modifier = nextToken.value.toLowerCase();
    if (validModifiers.includes(modifier)) {
      pragma.modifiers = pragma.modifiers || [];
      stream.advance(); // consume modifier name

      // Check for optional modifier argument: collapse(N)
      const modifierObj: PragmaModifier = { name: modifier };
      if (stream.check(TokenType.OPERATOR) && stream.peek().value === '(') {
        stream.advance(); // consume '('
        if (stream.check(TokenType.NUMBER)) {
          modifierObj.arg = parseInt(stream.advance().value, 10);
        }
        stream.expect(TokenType.OPERATOR, ')');
      }

      pragma.modifiers.push(modifierObj);
    } else {
      // Not a valid modifier, stop looking
      break;
    }
  }

  // Check for optional arguments in parentheses (for pragmas like unroll(4))
  if (stream.check(TokenType.OPERATOR) && stream.peek().value === '(') {
    stream.advance(); // consume '('
    pragma.args = parsePragmaArgs(stream);
    stream.expect(TokenType.OPERATOR, ')');
  }

  // Set as active pragma for the next construct
  setActivePragma(state, pragma);

  return pragma;
}

/**
 * Parses comma-separated numeric arguments for a pragma
 */
function parsePragmaArgs(stream: TokenStream): number[] {
  const args: number[] = [];

  // Check for empty args
  if (stream.check(TokenType.OPERATOR) && stream.peek().value === ')') {
    return args;
  }

  do {
    // Handle both NUMBER tokens and IDENTIFIER tokens (for named args like 'sum', 'R0')
    if (stream.check(TokenType.NUMBER)) {
      args.push(parseInt(stream.advance().value, 10));
    } else if (stream.check(TokenType.IDENTIFIER)) {
      // For reduce/stencil pragmas that have string arguments
      // Store as -1 (marker) and we'll handle specially
      // Actually, let's collect the raw tokens for these
      stream.advance();
      // Don't add to args for now - these are handled specially
    }
  } while (stream.match(TokenType.OPERATOR, ','));

  return args;
}

/**
 * Parses #pragma reduce arguments
 * Syntax: #pragma reduce(operation, srcReg, destReg)
 * Example: #pragma reduce(sum, R0, ROUT)
 */
export function parseReducePragmaArgs(stream: TokenStream): {
  operation: string;
  srcReg: string;
  destReg: string;
  axis?: 'row' | 'col';
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  const operation = stream.expect(TokenType.IDENTIFIER).value;
  stream.expect(TokenType.OPERATOR, ',');
  // Syntax: #pragma reduce(op, destReg, srcReg)
  // e.g. reduce(sum, R3, R2) means "reduce R2 into R3"
  const destReg = stream.expect(TokenType.IDENTIFIER).value;
  stream.expect(TokenType.OPERATOR, ',');
  const srcReg = stream.expect(TokenType.IDENTIFIER).value;

  // Optional axis parameter: axis=col or axis=row
  let axis: 'row' | 'col' | undefined;
  if (stream.check(TokenType.OPERATOR) && stream.peek().value === ',') {
    stream.advance(); // consume ','
    const axisKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
    if (axisKey === 'axis') {
      stream.expect(TokenType.OPERATOR, '=');
      // 'col' or 'row' could be IDENTIFIER or KEYWORD
      if (stream.check(TokenType.IDENTIFIER)) {
        axis = stream.advance().value.toLowerCase() as 'row' | 'col';
      } else if (stream.check(TokenType.KEYWORD)) {
        axis = stream.advance().value.toLowerCase() as 'row' | 'col';
      }
    }
  }

  stream.expect(TokenType.OPERATOR, ')');

  return { operation, srcReg, destReg, axis };
}

/**
 * Parses #pragma stencil arguments
 * Syntax: #pragma stencil(pattern, operation, srcReg, destReg)
 * Example: #pragma stencil(cross, sum, R0, ROUT)
 */
export function parseStencilPragmaArgs(stream: TokenStream): {
  pattern: string;
  operation: string;
  srcReg: string;
  destReg: string;
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  const pattern = stream.expect(TokenType.IDENTIFIER).value;
  stream.expect(TokenType.OPERATOR, ',');
  const operation = stream.expect(TokenType.IDENTIFIER).value;
  stream.expect(TokenType.OPERATOR, ',');
  const srcReg = stream.expect(TokenType.IDENTIFIER).value;
  stream.expect(TokenType.OPERATOR, ',');
  const destReg = stream.expect(TokenType.IDENTIFIER).value;
  stream.expect(TokenType.OPERATOR, ')');

  return { pattern, operation, srcReg, destReg };
}

/**
 * Gets the pragma description for error messages
 */
export function getPragmaDescription(name: string): string {
  switch (name.toLowerCase()) {
    case 'unroll':
      return '#pragma unroll [N] - Unroll loop N times (default: full unroll)';
    case 'no_unroll':
      return '#pragma no_unroll - Disable loop unrolling';
    case 'inline':
      return '#pragma inline - Inline function calls';
    case 'no_fuse':
      return '#pragma no_fuse - Disable loop fusion optimization';
    case 'parallel':
      return '#pragma parallel - Execute loop iterations in parallel across columns';
    case 'reduce':
      return '#pragma reduce(op, src, dest) - Tree reduction (sum, and, or, max, min)';
    case 'stencil':
      return '#pragma stencil(pattern, op, src, dest) - Stencil computation (cross, horizontal, vertical)';
    default:
      return `Unknown pragma: ${name}`;
  }
}

/**
 * Validates pragma arguments
 */
export function validatePragma(pragma: PragmaDirective): string | null {
  switch (pragma.name) {
    case 'unroll':
      if (pragma.args && pragma.args.length > 0) {
        if (pragma.args[0] <= 0) {
          return '#pragma unroll factor must be positive';
        }
      }
      break;

    case 'reduce':
      // Args should be parsed specially, not as numbers
      break;

    case 'stencil':
      // Args should be parsed specially, not as numbers
      break;
  }

  return null; // No error
}

/**
 * Checks if a pragma affects loop behavior
 */
export function isLoopPragma(name: string): boolean {
  return ['unroll', 'no_unroll', 'parallel', 'no_fuse'].includes(name.toLowerCase());
}

/**
 * Checks if a pragma generates code directly (reduce, stencil, scan, broadcast)
 */
export function isCodeGeneratingPragma(name: string): boolean {
  return ['reduce', 'stencil', 'route', 'scan', 'broadcast', 'rotate', 'shift'].includes(name.toLowerCase());
}

/**
 * Parses #pragma route arguments
 * Syntax: #pragma route (r1,c1) -> (r2,c2) payload(REG) accum(REG)
 * Extended: #pragma route (r1,c1) -> (r2,c2) payload(REG) dest(REG) op(OPCODE Rd, Rs1, Rs2)
 */
export function parseRoutePragmaArgs(stream: TokenStream): {
  src: { row: number, col: number };
  dst: { row: number, col: number };
  payload: string;
  accum: string;
  destReg?: string;
  customOp?: { opcode: string; dest: string; srcA: string; srcB: string };
} | null {
  // Parse src: (r,c)
  if (!stream.match(TokenType.OPERATOR, '(')) return null;
  const srcRow = parseInt(stream.expect(TokenType.NUMBER).value, 10);
  stream.expect(TokenType.OPERATOR, ',');
  const srcCol = parseInt(stream.expect(TokenType.NUMBER).value, 10);
  stream.expect(TokenType.OPERATOR, ')');

  // Parse arrow: -> (handled as two operators or one depending on lexer)
  // Assuming lexer splits - and >
  if (stream.check(TokenType.OPERATOR) && stream.peek().value === '->') {
    stream.advance();
  } else {
    stream.expect(TokenType.OPERATOR, '-');
    stream.expect(TokenType.OPERATOR, '>');
  }

  // Parse dst: (r,c)
  stream.expect(TokenType.OPERATOR, '(');
  const dstRow = parseInt(stream.expect(TokenType.NUMBER).value, 10);
  stream.expect(TokenType.OPERATOR, ',');
  const dstCol = parseInt(stream.expect(TokenType.NUMBER).value, 10);
  stream.expect(TokenType.OPERATOR, ')');

  // Parse payload(REG)
  const payloadKey = stream.expect(TokenType.IDENTIFIER).value;
  if (payloadKey.toLowerCase() !== 'payload') return null;
  stream.expect(TokenType.OPERATOR, '(');
  const payloadReg = stream.expect(TokenType.IDENTIFIER).value;
  stream.expect(TokenType.OPERATOR, ')');

  // Parse next keyword: accum or dest
  const nextKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();

  if (nextKey === 'accum') {
    // Standard syntax: payload(REG) accum(REG)
    stream.expect(TokenType.OPERATOR, '(');
    const accumReg = stream.expect(TokenType.IDENTIFIER).value;
    stream.expect(TokenType.OPERATOR, ')');

    return {
      src: { row: srcRow, col: srcCol },
      dst: { row: dstRow, col: dstCol },
      payload: payloadReg,
      accum: accumReg
    };
  } else if (nextKey === 'dest') {
    // Extended syntax: payload(REG) dest(REG) op(OPCODE Rd, Rs1, Rs2)
    stream.expect(TokenType.OPERATOR, '(');
    const destReg = stream.expect(TokenType.IDENTIFIER).value;
    stream.expect(TokenType.OPERATOR, ')');

    // Parse op(OPCODE Rd, Rs1, Rs2)
    const opKey = stream.expect(TokenType.IDENTIFIER).value;
    if (opKey.toLowerCase() !== 'op') return null;
    stream.expect(TokenType.OPERATOR, '(');

    const opcode = stream.expect(TokenType.IDENTIFIER).value;
    const opDest = stream.expect(TokenType.IDENTIFIER).value;
    stream.expect(TokenType.OPERATOR, ',');
    const opSrcA = stream.expect(TokenType.IDENTIFIER).value;
    stream.expect(TokenType.OPERATOR, ',');
    const opSrcB = stream.expect(TokenType.IDENTIFIER).value;
    stream.expect(TokenType.OPERATOR, ')');

    return {
      src: { row: srcRow, col: srcCol },
      dst: { row: dstRow, col: dstCol },
      payload: payloadReg,
      accum: destReg, // For backward compat, accum is the dest in this mode
      destReg: destReg,
      customOp: { opcode, dest: opDest, srcA: opSrcA, srcB: opSrcB }
    };
  }

  return null;
}

/**
 * Parses #pragma scan arguments
 * Syntax: #pragma scan(operation, srcReg, dstReg, direction)
 * Syntax: #pragma scan(operation, srcReg, dstReg, direction, mode)
 * Example: #pragma scan(add, R0, R1, right)
 * Example: #pragma scan(add, R0, R1, right, exclusive)
 */
export function parseScanPragmaArgs(stream: TokenStream): {
  operation: string;
  srcReg: string;
  dstReg: string;
  direction: 'left' | 'right' | 'up' | 'down';
  mode: 'inclusive' | 'exclusive';
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  const operation = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  stream.expect(TokenType.OPERATOR, ',');
  const srcReg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();
  stream.expect(TokenType.OPERATOR, ',');
  const dstReg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();
  stream.expect(TokenType.OPERATOR, ',');
  const direction = stream.expect(TokenType.IDENTIFIER).value.toLowerCase() as 'left' | 'right' | 'up' | 'down';

  // Optional mode argument
  let mode: 'inclusive' | 'exclusive' = 'inclusive';
  if (stream.check(TokenType.OPERATOR) && stream.peek().value === ',') {
    stream.advance(); // consume ','
    mode = stream.expect(TokenType.IDENTIFIER).value.toLowerCase() as 'inclusive' | 'exclusive';
  }

  stream.expect(TokenType.OPERATOR, ')');

  return { operation, srcReg, dstReg, direction, mode };
}

/**
 * Parses #pragma broadcast arguments
 * Syntax: #pragma broadcast(value=REG, from=@row,col, to=scope)
 * Example: #pragma broadcast(value=R0, from=@0,0, to=row)
 */
export function parseBroadcastPragmaArgs(stream: TokenStream): {
  valueReg: string;
  fromRow: number;
  fromCol: number;
  scope: 'row' | 'column' | 'all';
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  // Parse value=REG
  const valueKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (valueKey !== 'value') {
    throw new Error(`Expected 'value' but got '${valueKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const valueReg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();

  stream.expect(TokenType.OPERATOR, ',');

  // Parse from=@row,col
  const fromKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (fromKey !== 'from') {
    throw new Error(`Expected 'from' but got '${fromKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  stream.expect(TokenType.AT_SYMBOL, '@');
  const fromRow = parseInt(stream.expect(TokenType.NUMBER).value, 10);
  stream.expect(TokenType.OPERATOR, ',');
  const fromCol = parseInt(stream.expect(TokenType.NUMBER).value, 10);

  stream.expect(TokenType.OPERATOR, ',');

  // Parse to=scope
  const toKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (toKey !== 'to') {
    throw new Error(`Expected 'to' but got '${toKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  // 'row' is a keyword, so we need to accept both IDENTIFIER and KEYWORD
  let scope: 'row' | 'column' | 'all';
  if (stream.check(TokenType.IDENTIFIER)) {
    scope = stream.advance().value.toLowerCase() as 'row' | 'column' | 'all';
  } else if (stream.check(TokenType.KEYWORD)) {
    scope = stream.advance().value.toLowerCase() as 'row' | 'column' | 'all';
  } else {
    throw new Error(`Expected scope (row, column, all) but got ${stream.peek().type}`);
  }

  stream.expect(TokenType.OPERATOR, ')');

  return { valueReg, fromRow, fromCol, scope };
}

/**
 * Parses #pragma rotate or #pragma shift arguments
 * Syntax: #pragma rotate(reg=R0, direction=left|right, distance=1)
 * Syntax: #pragma shift(reg=R0, direction=left|right, distance=1, fill=0)
 */
export function parseRotateShiftPragmaArgs(stream: TokenStream, isShift: boolean): {
  reg: string;
  direction: 'left' | 'right';
  distance: number;
  fill?: number;
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  // Parse reg=REG
  const regKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (regKey !== 'reg') {
    throw new Error(`Expected 'reg' but got '${regKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const reg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();

  stream.expect(TokenType.OPERATOR, ',');

  // Parse direction=left|right
  const dirKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (dirKey !== 'direction') {
    throw new Error(`Expected 'direction' but got '${dirKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const direction = stream.expect(TokenType.IDENTIFIER).value.toLowerCase() as 'left' | 'right';

  // Optional distance
  let distance = 1;
  if (stream.check(TokenType.OPERATOR) && stream.peek().value === ',') {
    stream.advance(); // consume ','

    const nextKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
    if (nextKey === 'distance') {
      stream.expect(TokenType.OPERATOR, '=');
      distance = parseInt(stream.expect(TokenType.NUMBER).value, 10);
    }
  }

  // Optional fill (for shift only)
  let fill: number | undefined;
  if (isShift && stream.check(TokenType.OPERATOR) && stream.peek().value === ',') {
    stream.advance(); // consume ','

    const fillKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
    if (fillKey === 'fill') {
      stream.expect(TokenType.OPERATOR, '=');
      fill = parseInt(stream.expect(TokenType.NUMBER).value, 10);
    }
  }

  stream.expect(TokenType.OPERATOR, ')');

  return { reg, direction, distance, fill };
}
