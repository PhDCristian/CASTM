/**
 * OpenEdge-DSL Instruction Parser
 *
 * Handles parsing of individual instructions within cycle blocks,
 * including operand resolution for named arrays, data references,
 * and immediate values.
 */

import { TokenType } from '../types/tokens';
import { Instruction } from '../types/ast';
import { SymbolTable, getArrayPropertyValue, isArrayProperty } from '../types/symbols';
import { TokenStream } from './token-stream';
import { evaluateSimpleExpression } from '../utils/expression';
import { extractNumericValue } from '../utils/string-utils';

// Re-export for backward compatibility with parser/index.ts
export { evaluateSimpleExpression, extractNumericValue };

/**
 * Opcode aliases for common instruction names
 */
export const OPCODE_ALIASES: Record<string, string> = {
  'ADD': 'SADD',
  'SUB': 'SSUB',
  'MUL': 'SMUL',
};

/**
 * Parses a single instruction from the token stream.
 * Handles various operand formats including:
 * - IMM(value) immediate values
 * - .CONST references
 * - data[index] references
 * - namedArray[index] references
 * - namedArray.property() calls
 *
 * @param stream - The token stream to parse from
 * @param symbols - Symbol table for resolving named arrays
 * @returns The parsed instruction
 * @throws Error if instruction parsing fails
 */
export function parseInstruction(
  stream: TokenStream,
  symbols: SymbolTable
): Instruction {
  const opcodeToken = stream.expect(TokenType.IDENTIFIER);
  let opcode = opcodeToken.value.toUpperCase();

  // Normalize Opcode (Alias Support)
  if (OPCODE_ALIASES[opcode]) {
    opcode = OPCODE_ALIASES[opcode];
  }

  const operands: string[] = [];

  // If not NOP/EXIT, parse operands
  if (opcode !== 'NOP' && opcode !== 'EXIT') {
    // SPECIAL CASE: ASSERT and CHECK instructions support colon syntax (R0: 120)
    if (opcode === 'ASSERT' || opcode === 'CHECK') {
      do {
        // Parse the register/source part
        const left = parseOperand(stream, symbols);
        
        // Check if we have a colon pair
        if (stream.match(TokenType.OPERATOR, ':')) {
          // Parse the expected value part
          const right = parseOperand(stream, symbols);
          operands.push(`${left}: ${right}`);
        } else {
          // Standard single operand (old format)
          operands.push(left || '');
        }
      } while (stream.match(TokenType.OPERATOR, ','));
    } else {
      // Standard parsing for other instructions
      do {
        const operand = parseOperand(stream, symbols);
        if (operand !== null) {
          operands.push(operand);
        }
      } while (stream.match(TokenType.OPERATOR, ','));
    }
  }

  return { opcode, operands, originalLine: opcodeToken.line };
}

/**
 * Parses a single operand from the token stream.
 *
 * @param stream - The token stream to parse from
 * @param symbols - Symbol table for resolving named arrays
 * @returns The parsed operand string, or null if no operand
 */
function parseOperand(
  stream: TokenStream,
  symbols: SymbolTable
): string | null {
  const currentToken = stream.peek();
  const nextToken = stream.peekAhead(1);

  // Handle IMM(val) or IMM(expr) syntax
  if (currentToken.value.toUpperCase() === 'IMM' && nextToken.value === '(') {
    stream.advance(); // IMM
    stream.advance(); // (

    // Collect all tokens until closing paren to support expressions like IMM(i * 2 + j)
    const exprTokens: string[] = [];
    let parenDepth = 1;
    while (!stream.isAtEnd() && parenDepth > 0) {
      const tok = stream.peek();
      if (tok.value === '(') {
        parenDepth++;
        exprTokens.push(tok.value);
        stream.advance();
      } else if (tok.value === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          stream.advance(); // consume closing ')'
          break;
        }
        exprTokens.push(tok.value);
        stream.advance();
      } else {
        exprTokens.push(tok.value);
        stream.advance();
      }
    }

    // If single number token, return directly
    if (exprTokens.length === 1) {
      return exprTokens[0];
    }

    // Evaluate expression
    const val = evaluateSimpleExpression(exprTokens, symbols);
    return val.toString();
  }

  // Handle .CONST
  if (currentToken.type === TokenType.DIRECTIVE) {
    const constName = stream.advance().value.substring(1); // Remove .
    return `.${constName}`;
  }

  // Handle data[index] or data[expression]
  if (currentToken.value === 'data' && nextToken.value === '[') {
    return parseDataReference(stream, symbols);
  }

  // Handle namedArray[index]
  if (currentToken.type === TokenType.IDENTIFIER && nextToken?.value === '[') {
    const arrayName = currentToken.value;
    if (symbols.namedArrays.has(arrayName)) {
      return parseNamedArrayIndexAccess(stream, symbols, arrayName);
    }
  }

  // Handle namedArray.property()
  // Note: The tokenizer treats .len as a DIRECTIVE token
  if (currentToken.type === TokenType.IDENTIFIER &&
      stream.peekAhead(1)?.type === TokenType.DIRECTIVE &&
      stream.peekAhead(1)?.value.startsWith('.')) {
    const arrayName = currentToken.value;
    if (symbols.namedArrays.has(arrayName)) {
      return parseNamedArrayPropertyAccess(stream, symbols, arrayName);
    }
  }

  // Default: just return the token value
  return stream.advance().value;
}

/**
 * Collects expression tokens from inside brackets, resolving array property
 * references (e.g., values.len()) inline to their numeric values.
 */
function collectBracketExprTokens(
  stream: TokenStream,
  symbols: SymbolTable
): string[] {
  const exprTokens: string[] = [];
  while (stream.peek().value !== ']' && !stream.isAtEnd()) {
    const cur = stream.peek();
    const next = stream.peekAhead(1);

    // Check for arrayName.property() pattern inside bracket expression
    if (cur.type === TokenType.IDENTIFIER &&
        next?.type === TokenType.DIRECTIVE &&
        next?.value.startsWith('.')) {
      const arrName = cur.value;
      const propName = next.value.substring(1).toLowerCase();
      const namedArray = symbols.namedArrays.get(arrName);

      if (namedArray && isArrayProperty(propName)) {
        stream.advance(); // array name
        stream.advance(); // .property directive
        // Consume optional ()
        if (stream.peek().value === '(') {
          stream.advance(); // (
          if (stream.peek().value === ')') {
            stream.advance(); // )
          }
        }
        const val = getArrayPropertyValue(namedArray, propName);
        exprTokens.push(val.toString());
        continue;
      }
    }

    exprTokens.push(stream.advance().value);
  }
  return exprTokens;
}

/**
 * Parses a data[index] reference.
 */
function parseDataReference(
  stream: TokenStream,
  symbols: SymbolTable
): string {
  stream.advance(); // data
  stream.advance(); // [

  // Parse arithmetic expression inside brackets, resolving array properties
  const exprTokens = collectBracketExprTokens(stream, symbols);
  stream.expect(TokenType.OPERATOR, ']');

  // Evaluate the expression
  const index = evaluateSimpleExpression(exprTokens, symbols);
  return `__DATA_REF_${index}`;
}

/**
 * Parses a namedArray[index] or namedArray[row][col] reference.
 * Supports both 1D and 2D array access.
 */
function parseNamedArrayIndexAccess(
  stream: TokenStream,
  symbols: SymbolTable,
  arrayName: string
): string {
  // Check if it's a registered named array
  if (!symbols.namedArrays.has(arrayName)) {
    throw {
      message: `Undefined array '${arrayName}'. Define it first with: .data ${arrayName} { values }`,
      line: stream.peek().line
    };
  }

  const arrayInfo = symbols.namedArrays.get(arrayName)!;
  const lineNum = stream.peek().line;

  stream.advance(); // array name
  stream.advance(); // [

  // Parse first index expression inside brackets, resolving array properties
  const index1Tokens = collectBracketExprTokens(stream, symbols);
  stream.expect(TokenType.OPERATOR, ']');

  // Evaluate the first index
  const index1 = evaluateSimpleExpression(index1Tokens, symbols);

  // Check for second index [col] for 2D access
  if (arrayInfo.is2D && stream.peek()?.value === '[') {
    stream.advance(); // [

    // Parse second index expression, resolving array properties
    const index2Tokens = collectBracketExprTokens(stream, symbols);
    stream.expect(TokenType.OPERATOR, ']');

    const index2 = evaluateSimpleExpression(index2Tokens, symbols);

    // Row-major indexing: linearIndex = row * cols + col
    const row = index1;
    const col = index2;
    const rows = arrayInfo.rows!;
    const cols = arrayInfo.cols!;

    // Bounds checking
    if (row < 0 || row >= rows) {
      throw {
        message: `Row index ${row} out of bounds [0, ${rows - 1}] for array '${arrayName}'`,
        line: lineNum
      };
    }
    if (col < 0 || col >= cols) {
      throw {
        message: `Column index ${col} out of bounds [0, ${cols - 1}] for array '${arrayName}'`,
        line: lineNum
      };
    }

    const linearIndex = row * cols + col;
    const globalIndex = arrayInfo.globalStartIndex + linearIndex;
    return `__DATA_REF_${globalIndex}`;
  }

  // 1D access (or 2D array with single linear index)
  if (index1 < 0 || index1 >= arrayInfo.length) {
    throw {
      message: `Index ${index1} out of bounds [0, ${arrayInfo.length - 1}] for array '${arrayName}'`,
      line: lineNum
    };
  }

  const globalIndex = arrayInfo.globalStartIndex + index1;
  return `__DATA_REF_${globalIndex}`;
}

/**
 * Parses a namedArray.property() call.
 */
function parseNamedArrayPropertyAccess(
  stream: TokenStream,
  symbols: SymbolTable,
  arrayName: string
): string {
  // Check if it's a registered named array
  if (!symbols.namedArrays.has(arrayName)) {
    throw {
      message: `Undefined array '${arrayName}'. Define it first with: .data ${arrayName} { values }`,
      line: stream.peek().line
    };
  }

  stream.advance(); // array name
  const propertyDirective = stream.advance(); // .property (as DIRECTIVE)
  const property = propertyDirective.value.substring(1).toLowerCase(); // Remove leading "."

  // Expect parentheses for function-style call
  if (stream.peek().value === '(') {
    stream.advance(); // (
    stream.expect(TokenType.OPERATOR, ')');
  }

  const arrayInfo = symbols.namedArrays.get(arrayName)!;

  // Validate and get property value
  if (!isArrayProperty(property)) {
    throw {
      message: `Unknown array property '${property}'. Available: len(), base(), size(), last(), rows(), cols(), dim()`,
      line: propertyDirective.line
    };
  }

  const value = getArrayPropertyValue(arrayInfo, property);
  return value.toString();
}
