/**
 * OpenEdge-DSL Expression Desugarer
 *
 * Transforms C-like register expressions into standard ISA instructions.
 * Runs as a token-level pass between the lexer and parser.
 *
 * Example:
 *   R1 = R2 + R3;       →  SADD R1, R2, R3;
 *   R0 = R1 - 5;        →  SSUB R0, R1, 5;
 *   ROUT = R0 * R2;     →  SMUL ROUT, R0, R2;
 *   R1 = R0 & 0xFF;     →  LAND R1, R0, 0xFF;
 */

import { Token, TokenType } from '../types/tokens';

/**
 * Mapping from C-like operators to ISA instruction opcodes.
 */
const OPERATOR_TO_OPCODE: Record<string, string> = {
  '+': 'SADD',
  '-': 'SSUB',
  '*': 'SMUL',
  '**': 'FXPMUL',
  '<<': 'SLT',
  '>>': 'SRT',
  '>>>': 'SRA',
  '&': 'LAND',
  '|': 'LOR',
  '^': 'LXOR',
  '~&': 'LNAND',
  '~|': 'LNOR',
  '~^': 'LXNOR',
};

/**
 * Set of valid register and neighbor names that can appear as
 * assignment targets (left-hand side of `=`).
 */
const VALID_DESTINATIONS = new Set([
  'R0', 'R1', 'R2', 'R3', 'ROUT',
]);

/**
 * Set of identifiers that are valid operands in expressions.
 * Includes registers, neighbors, and special values.
 */
const VALID_OPERAND_IDENTIFIERS = new Set([
  'R0', 'R1', 'R2', 'R3', 'ROUT', 'ZERO',
  'SELF', 'RCL', 'RCR', 'RCT', 'RCB', 'PREV',
]);

/**
 * Set of identifiers that are known ISA opcodes.
 * When we see one of these at statement start, it's assembly — not a C-like expression.
 */
const ISA_OPCODES = new Set([
  'NOP', 'EXIT',
  'SADD', 'SSUB', 'SMUL', 'FXPMUL',
  'LAND', 'LOR', 'LXOR', 'LNAND', 'LNOR', 'LXNOR',
  'SLT', 'SRT', 'SRA',
  'LWD', 'SWD', 'LWI', 'SWI',
  'BSFA', 'BZFA', 'BEQ', 'BNE', 'BLT', 'BGE', 'JUMP',
  'PRINT', 'CHECK', 'ASSERT', 'CHECKPOINT', 'OUTPUT',
  'ADD', 'SUB', 'MUL', // aliases
]);

/**
 * Creates a synthetic token preserving line/column from a reference token.
 */
function tok(type: TokenType, value: string, ref: Token): Token {
  return { type, value, line: ref.line, column: ref.column };
}

/**
 * Checks if a token at position `i` starts a C-like expression assignment:
 *   DEST_REGISTER '=' (not '==') ...
 */
function isExpressionStart(tokens: Token[], i: number): boolean {
  if (i + 2 >= tokens.length) return false;

  const dest = tokens[i];
  const eq = tokens[i + 1];
  const afterEq = tokens[i + 2];

  // Must be: IDENTIFIER(register) OPERATOR('=') and NOT '=='
  if (dest.type !== TokenType.IDENTIFIER) return false;
  if (!VALID_DESTINATIONS.has(dest.value.toUpperCase())) return false;
  if (eq.type !== TokenType.OPERATOR || eq.value !== '=') return false;
  // If next is also '=', this is '==' (comparison), not assignment
  if (afterEq.type === TokenType.OPERATOR && afterEq.value === '=') return false;

  return true;
}

/**
 * Collects tokens for a single operand starting at position i.
 * An operand can be:
 *   - IDENTIFIER (register, neighbor)
 *   - NUMBER (immediate)
 *   - DIRECTIVE (.CONST reference)
 *   - IDENTIFIER '[' ... ']' (data/array reference)
 *   - 'IMM' '(' ... ')' (explicit IMM wrapper)
 *
 * Returns the operand tokens and the new position after the operand.
 */
function collectOperand(tokens: Token[], i: number): { operandTokens: Token[]; nextPos: number } {
  const operandTokens: Token[] = [];

  if (i >= tokens.length) {
    return { operandTokens, nextPos: i };
  }

  const t = tokens[i];

  // Directive reference (.CONST_NAME)
  if (t.type === TokenType.DIRECTIVE) {
    operandTokens.push(t);
    return { operandTokens, nextPos: i + 1 };
  }

  // Number literal
  if (t.type === TokenType.NUMBER) {
    operandTokens.push(t);
    return { operandTokens, nextPos: i + 1 };
  }

  // Identifier (register, neighbor, or array name)
  if (t.type === TokenType.IDENTIFIER) {
    operandTokens.push(t);
    let pos = i + 1;

    // Check for IMM(...) pattern
    if (t.value.toUpperCase() === 'IMM' && pos < tokens.length &&
        tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === '(') {
      // Collect everything through the closing ')'
      operandTokens.push(tokens[pos]); // '('
      pos++;
      let parenDepth = 1;
      while (pos < tokens.length && parenDepth > 0) {
        if (tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === '(') parenDepth++;
        if (tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === ')') parenDepth--;
        operandTokens.push(tokens[pos]);
        pos++;
      }
      return { operandTokens, nextPos: pos };
    }

    // Check for array indexing: name[...]
    if (pos < tokens.length && tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === '[') {
      operandTokens.push(tokens[pos]); // '['
      pos++;
      let bracketDepth = 1;
      while (pos < tokens.length && bracketDepth > 0) {
        if (tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === '[') bracketDepth++;
        if (tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === ']') bracketDepth--;
        operandTokens.push(tokens[pos]);
        pos++;
      }
      return { operandTokens, nextPos: pos };
    }

    // Check for property access: name.method()
    if (pos < tokens.length && tokens[pos].type === TokenType.DIRECTIVE) {
      // This is actually name.property() syntax tokenized as IDENTIFIER + DIRECTIVE
      operandTokens.push(tokens[pos]); // .method
      pos++;
      if (pos < tokens.length && tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === '(') {
        operandTokens.push(tokens[pos]); // '('
        pos++;
        if (pos < tokens.length && tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === ')') {
          operandTokens.push(tokens[pos]); // ')'
          pos++;
        }
      }
      return { operandTokens, nextPos: pos };
    }

    return { operandTokens, nextPos: pos };
  }

  // Fallback: just take the one token
  operandTokens.push(t);
  return { operandTokens, nextPos: i + 1 };
}

/**
 * Desugars a single expression statement starting at position `i`.
 * Pattern: DEST = OPERAND1 OP OPERAND2 ;
 *
 * Returns the replacement tokens and the position after the expression.
 * Returns null if this is not a valid expression to desugar.
 */
function desugarExpression(tokens: Token[], i: number, inRowSyntax: boolean = false): { replacement: Token[]; nextPos: number } | null {
  const dest = tokens[i];
  const destUpper = dest.value.toUpperCase();
  // Skip the '='
  let pos = i + 2;

  // Collect first operand
  const { operandTokens: op1, nextPos: afterOp1 } = collectOperand(tokens, pos);
  if (op1.length === 0) return null;
  pos = afterOp1;

  // Check what follows: could be operator, semicolon, or pipe
  if (pos >= tokens.length) return null;

  const nextTok = tokens[pos];

  // If semicolon immediately after first operand, this is a simple copy: R1 = R2;
  // Desugar as: SADD R1, R2, ZERO;
  if (nextTok.type === TokenType.SEMICOLON) {
    const replacement: Token[] = [
      tok(TokenType.IDENTIFIER, 'SADD', dest),
      tok(TokenType.IDENTIFIER, destUpper, dest),
      tok(TokenType.OPERATOR, ',', dest),
      ...op1,
      tok(TokenType.OPERATOR, ',', dest),
      tok(TokenType.IDENTIFIER, 'ZERO', dest),
      nextTok, // ;
    ];
    return { replacement, nextPos: pos + 1 };
  }

  // Handle '|' ambiguity: pipe separator in row syntax vs bitwise OR
  if (nextTok.type === TokenType.OPERATOR && nextTok.value === '|') {
    if (inRowSyntax) {
      // In row syntax, '|' is a pipe separator → treat as simple copy
      const replacement: Token[] = [
        tok(TokenType.IDENTIFIER, 'SADD', dest),
        tok(TokenType.IDENTIFIER, destUpper, dest),
        tok(TokenType.OPERATOR, ',', dest),
        ...op1,
        tok(TokenType.OPERATOR, ',', dest),
        tok(TokenType.IDENTIFIER, 'ZERO', dest),
      ];
      // Don't consume the pipe — let the caller handle it
      return { replacement, nextPos: pos };
    }
    // In @row,col context, '|' is bitwise OR — fall through to operator handling
  }

  // Must be an operator
  if (nextTok.type !== TokenType.OPERATOR) return null;

  const operator = nextTok.value;
  const opcode = OPERATOR_TO_OPCODE[operator];
  if (!opcode) return null;

  pos++; // skip operator

  // Collect second operand
  const { operandTokens: op2, nextPos: afterOp2 } = collectOperand(tokens, pos);
  if (op2.length === 0) return null;
  pos = afterOp2;

  // Build replacement: OPCODE DEST, OP1, OP2
  const replacement: Token[] = [
    tok(TokenType.IDENTIFIER, opcode, dest),
    tok(TokenType.IDENTIFIER, destUpper, dest),
    tok(TokenType.OPERATOR, ',', dest),
    ...op1,
    tok(TokenType.OPERATOR, ',', dest),
    ...op2,
  ];

  // If followed by semicolon, include it
  if (pos < tokens.length && tokens[pos].type === TokenType.SEMICOLON) {
    replacement.push(tokens[pos]);
    pos++;
  }

  return { replacement, nextPos: pos };
}

/**
 * Context tracking for determining whether we're inside a cycle block
 * where expression desugaring is allowed.
 */
interface DesugarContext {
  /** True when we're inside a `cycle { ... }` block */
  inCycleBlock: boolean;
  /** Brace nesting depth within a cycle block */
  cycleBlockDepth: number;
  /** True when we're inside a `row N: ... ;` line */
  inRowSyntax: boolean;
}

/**
 * Main desugaring function.
 *
 * Transforms C-like register expressions into standard ISA tokens.
 * Only operates inside `cycle { ... }` blocks to avoid breaking
 * other parts of the DSL (pragmas, directives, etc.).
 *
 * @param tokens - Token array from the lexer
 * @returns Token array with expressions desugared to ISA instructions
 */
export function desugarExpressions(tokens: Token[]): Token[] {
  const result: Token[] = [];
  const ctx: DesugarContext = {
    inCycleBlock: false,
    cycleBlockDepth: 0,
    inRowSyntax: false,
  };

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    // Track entry into cycle blocks
    if (t.type === TokenType.KEYWORD && t.value.toLowerCase() === 'cycle') {
      result.push(t);
      i++;
      // Look for the opening brace
      if (i < tokens.length && tokens[i].type === TokenType.BRACE_OPEN) {
        ctx.inCycleBlock = true;
        ctx.cycleBlockDepth = 1;
        result.push(tokens[i]);
        i++;
        continue;
      }
      continue;
    }

    // Track brace nesting inside cycle blocks
    if (ctx.inCycleBlock) {
      if (t.type === TokenType.BRACE_OPEN) {
        ctx.cycleBlockDepth++;
        result.push(t);
        i++;
        continue;
      }
      if (t.type === TokenType.BRACE_CLOSE) {
        ctx.cycleBlockDepth--;
        if (ctx.cycleBlockDepth === 0) {
          ctx.inCycleBlock = false;
        }
        result.push(t);
        i++;
        continue;
      }
    }

    // Only desugar inside cycle blocks
    if (!ctx.inCycleBlock) {
      result.push(t);
      i++;
      continue;
    }

    // Track row syntax context: `row NUMBER :`
    if (t.type === TokenType.KEYWORD && t.value.toLowerCase() === 'row') {
      ctx.inRowSyntax = true;
    }
    // Semicolon ends row syntax
    if (t.type === TokenType.SEMICOLON && ctx.inRowSyntax) {
      ctx.inRowSyntax = false;
    }

    // Inside a cycle block — check for expression start
    if (t.type === TokenType.IDENTIFIER && !ISA_OPCODES.has(t.value.toUpperCase()) && isExpressionStart(tokens, i)) {
      const desugared = desugarExpression(tokens, i, ctx.inRowSyntax);
      if (desugared) {
        result.push(...desugared.replacement);
        i = desugared.nextPos;
        continue;
      }
    }

    // Pass through unchanged
    result.push(t);
    i++;
  }

  return result;
}
