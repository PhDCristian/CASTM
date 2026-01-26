/**
 * OpenEdge-DSL Directive Parser
 *
 * Handles parsing of preprocessor directives:
 * .const, .alias, .data, .data2d, .io_load, .io_store, .limit, .assert
 */

import { TokenType } from '../types/tokens';
import { TokenStream } from './token-stream';
import {
  ParserState,
  registerConstant,
  registerAlias,
  registerNamedArray,
  registerNamedArray2D,
  registerAnonymousData,
  setIoLoadAddrs,
  setIoStoreAddrs,
  setCycleLimit,
  addAssertion
} from './parser-state';
import { Assertion } from '../types/ast';
import { evaluateSimpleExpression } from '../utils/expression';

/**
 * Parses a .const directive
 * Syntax: .const NAME VALUE
 * Extended: .const NAME EXPR (e.g., .const NEXT BASE+4)
 */
export function parseConstDirective(stream: TokenStream, state: ParserState): void {
  const nameToken = stream.expect(TokenType.IDENTIFIER);

  // Collect expression tokens until end of line (newline or semicolon or next directive)
  const exprTokens: string[] = [];

  while (!stream.isAtEnd()) {
    const peek = stream.peek();

    // Stop at newline, semicolon, directive, keyword, or brace
    if (peek.type === TokenType.DIRECTIVE ||
      peek.type === TokenType.KEYWORD ||
      peek.type === TokenType.BRACE_OPEN ||
      peek.type === TokenType.BRACE_CLOSE ||
      peek.type === TokenType.SEMICOLON) {
      break;
    }

    // Also stop if we see another identifier that could be a directive on next line
    // This handles the case where there's no explicit separator
    if (peek.type === TokenType.IDENTIFIER && peek.value.startsWith('.')) {
      break;
    }

    stream.advance();
    exprTokens.push(peek.value);
  }

  if (exprTokens.length === 0) {
    throw { message: `.const ${nameToken.value} requires a value or expression`, line: nameToken.line };
  }

  // Evaluate the expression, resolving any existing constants
  const value = evaluateSimpleExpression(exprTokens, state.symbols);

  registerConstant(state, nameToken.value, value.toString());
}

/**
 * Parses a .alias directive
 * Syntax: .alias NAME REGISTER
 */
export function parseAliasDirective(stream: TokenStream, state: ParserState): void {
  const nameToken = stream.expect(TokenType.IDENTIFIER);
  const regToken = stream.expect(TokenType.IDENTIFIER);
  registerAlias(state, nameToken.value, regToken.value);
}

/**
 * Parses a .limit directive
 * Syntax: .limit NUMBER
 */
export function parseLimitDirective(stream: TokenStream, state: ParserState): void {
  const valueToken = stream.expect(TokenType.NUMBER);
  setCycleLimit(state, parseInt(valueToken.value, 10));
}

/**
 * Parses a .data directive
 * Syntax variants:
 *   .data { 1, 2, 3 }           - anonymous, auto-address
 *   .data 100 { 1, 2, 3 }       - anonymous, explicit address
 *   .data input { 1, 2, 3 }     - named, auto-address
 *   .data input 100 { 1, 2, 3 } - named, explicit address
 */
export function parseDataDirective(stream: TokenStream, state: ParserState): void {
  let arrayName: string | null = null;
  let address: number;

  // Check for optional name (IDENTIFIER before NUMBER or BRACE_OPEN)
  if (stream.check(TokenType.IDENTIFIER)) {
    arrayName = stream.advance().value;
  }

  // Check for optional explicit address
  if (stream.check(TokenType.NUMBER)) {
    address = parseInt(stream.advance().value, 10);
  } else {
    address = state.nextFreeAddress;
  }

  // Parse values
  stream.expect(TokenType.BRACE_OPEN);
  const values = parseNumberList(stream);
  stream.expect(TokenType.BRACE_CLOSE);

  // Register the data
  if (arrayName) {
    registerNamedArray(state, arrayName, address, values);
  } else {
    registerAnonymousData(state, address, values);
  }
}

/**
 * Parses a .data2d directive for 2D arrays
 * Syntax variants:
 *   .data2d A[4][4]                    // 4x4, auto-init to zeros
 *   .data2d A[4][4] { 1,2,3,... }      // 4x4 with explicit values
 *   .data2d A[16]                      // 16 elements, infer square dims
 */
export function parseData2dDirective(stream: TokenStream, state: ParserState): void {
  // Array name is required for .data2d
  const nameToken = stream.expect(TokenType.IDENTIFIER);
  const arrayName = nameToken.value;

  // Parse first dimension [rows] or [total]
  stream.expect(TokenType.OPERATOR, '[');
  const dim1Token = stream.expect(TokenType.NUMBER);
  const dim1 = parseInt(dim1Token.value, 10);
  stream.expect(TokenType.OPERATOR, ']');

  let rows: number;
  let cols: number;

  // Check for second dimension [cols]
  if (stream.check(TokenType.OPERATOR) && stream.peek().value === '[') {
    stream.advance(); // [
    const dim2Token = stream.expect(TokenType.NUMBER);
    cols = parseInt(dim2Token.value, 10);
    stream.expect(TokenType.OPERATOR, ']');
    rows = dim1;
  } else {
    // Single dimension [total] - infer as square if possible
    const total = dim1;
    const sqrt = Math.sqrt(total);
    if (Number.isInteger(sqrt)) {
      rows = sqrt;
      cols = sqrt;
    } else {
      // Not a perfect square: 1 row, N columns
      rows = 1;
      cols = total;
    }
  }

  const totalElements = rows * cols;

  // Parse optional values or auto-initialize to zeros
  let values: number[];
  if (stream.check(TokenType.BRACE_OPEN)) {
    stream.advance();
    values = parseNumberList(stream);
    stream.expect(TokenType.BRACE_CLOSE);

    if (values.length !== totalElements) {
      throw {
        message: `.data2d ${arrayName}[${rows}][${cols}] expects ${totalElements} values, got ${values.length}`,
        line: nameToken.line
      };
    }
  } else {
    // Auto-initialize to zeros
    values = new Array(totalElements).fill(0);
  }

  // Use auto-allocated address
  const address = state.nextFreeAddress;

  // Register the 2D array
  registerNamedArray2D(state, arrayName, address, values, rows, cols);
}

/**
 * Parses a .io_load directive
 * Syntax: .io_load { addr0, addr1, ... }
 */
export function parseIoLoadDirective(stream: TokenStream, state: ParserState): void {
  stream.expect(TokenType.BRACE_OPEN);
  const values = parseNumberList(stream);
  stream.expect(TokenType.BRACE_CLOSE);
  setIoLoadAddrs(state, values);
}

/**
 * Parses a .io_store directive
 * Syntax: .io_store { addr0, addr1, ... }
 */
export function parseIoStoreDirective(stream: TokenStream, state: ParserState): void {
  stream.expect(TokenType.BRACE_OPEN);
  const values = parseNumberList(stream);
  stream.expect(TokenType.BRACE_CLOSE);
  setIoStoreAddrs(state, values);
}

/**
 * Parses a .assert directive
 * Syntax: .assert { cycle: N, location: row,col, register: RX, value: N }
 * 
 * If 'cycle' is not specified, it defaults to the last cycle before the assertion.
 */
export function parseAssertDirective(stream: TokenStream, state: ParserState): void {
  stream.expect(TokenType.BRACE_OPEN);

  const assertion: Partial<Assertion> = {};

  while (!stream.check(TokenType.BRACE_CLOSE) && !stream.isAtEnd()) {
    // Get key - can be keyword (like 'cycle') or identifier
    let key: string;
    if (stream.check(TokenType.KEYWORD)) {
      key = stream.advance().value;
    } else {
      key = stream.expect(TokenType.IDENTIFIER).value;
    }

    stream.expect(TokenType.OPERATOR, ':');

    switch (key.toLowerCase()) {
      case 'cycle':
        assertion.cycle = parseInt(stream.expect(TokenType.NUMBER).value, 10);
        break;
      case 'register':
        assertion.register = stream.expect(TokenType.IDENTIFIER).value;
        break;
      case 'value':
        assertion.value = parseInt(stream.expect(TokenType.NUMBER).value, 10);
        break;
      case 'location':
        assertion.row = parseInt(stream.expect(TokenType.NUMBER).value, 10);
        stream.expect(TokenType.OPERATOR, ',');
        assertion.col = parseInt(stream.expect(TokenType.NUMBER).value, 10);
        break;
    }

    // Skip optional comma
    if (stream.check(TokenType.OPERATOR) && stream.peek().value === ',') {
      stream.advance();
    }
  }

  stream.expect(TokenType.BRACE_CLOSE);

  // If cycle is not specified, use the last cycle (cycleCounter - 1)
  // This allows assertions like: .assert { location: 0,0, register: R1, value: 60 }
  if (assertion.cycle === undefined) {
    // Use the last cycle added to the AST, or the current cycle counter - 1
    const lastCycleIndex = state.ast.cycles.length > 0
      ? state.ast.cycles.length - 1
      : Math.max(0, state.cycleCounter - 1);
    assertion.cycle = lastCycleIndex;
  }

  // Validate required fields (cycle is now auto-filled if not specified)
  if (assertion.row === undefined ||
    assertion.col === undefined || assertion.register === undefined ||
    assertion.value === undefined) {
    throw {
      message: '.assert requires location, register, and value fields (cycle is optional)',
      line: stream.peek().line
    };
  }

  addAssertion(state, assertion as Assertion);
}

/**
 * Parses any directive based on its name
 */
export function parseDirective(
  stream: TokenStream,
  state: ParserState,
  directiveName: string
): boolean {
  switch (directiveName) {
    case '.const':
      parseConstDirective(stream, state);
      return true;

    case '.alias':
      parseAliasDirective(stream, state);
      return true;

    case '.limit':
      parseLimitDirective(stream, state);
      return true;

    case '.data':
      parseDataDirective(stream, state);
      return true;

    case '.data2d':
      parseData2dDirective(stream, state);
      return true;

    case '.io_load':
      parseIoLoadDirective(stream, state);
      return true;

    case '.io_store':
      parseIoStoreDirective(stream, state);
      return true;

    case '.assert':
      parseAssertDirective(stream, state);
      return true;

    default:
      return false;
  }
}

/**
 * Parses a comma-separated list of numbers inside braces
 * Supports negative numbers (e.g., { -1, 2, -3 })
 */
function parseNumberList(stream: TokenStream): number[] {
  const values: number[] = [];

  while (!stream.check(TokenType.BRACE_CLOSE) && !stream.isAtEnd()) {
    // Check for optional negative sign
    let isNegative = false;
    if (stream.check(TokenType.OPERATOR) && stream.peek().value === '-') {
      isNegative = true;
      stream.advance(); // consume the minus
    }

    const numToken = stream.expect(TokenType.NUMBER);
    let value = parseInt(numToken.value, 10);
    if (isNegative) {
      value = -value;
    }
    values.push(value);

    // Skip optional comma
    if (stream.check(TokenType.OPERATOR) && stream.peek().value === ',') {
      stream.advance();
    }
  }

  return values;
}

/**
 * Checks if a directive name is a known directive
 */
export function isKnownDirective(name: string): boolean {
  return [
    '.const',
    '.alias',
    '.limit',
    '.data',
    '.data2d',
    '.io_load',
    '.io_store',
    '.assert'
  ].includes(name);
}
