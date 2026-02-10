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
 * Set of valid hardware registers that can appear as destinations/sources
 * for memory sugar forms:
 *   R0 = A[i];
 *   A[i] = R0;
 */
const VALID_REGISTERS = new Set([
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

  // Must be: IDENTIFIER OPERATOR('=') and NOT '=='
  if (dest.type !== TokenType.IDENTIFIER) return false;
  if (ISA_OPCODES.has(dest.value.toUpperCase())) return false;
  if (eq.type !== TokenType.OPERATOR || eq.value !== '=') return false;
  // If next is also '=', this is '==' (comparison), not assignment
  if (afterEq.type === TokenType.OPERATOR && afterEq.value === '=') return false;

  return true;
}

function isRegisterToken(token: Token | undefined): boolean {
  if (!token || token.type !== TokenType.IDENTIFIER) return false;
  return VALID_REGISTERS.has(token.value.toUpperCase());
}

interface MemoryOperand {
  kind: 'array' | 'raw';
  tokens: Token[];
  nextPos: number;
}

/**
 * Collects a balanced bracket expression starting at '['.
 * Returns the tokens inside the brackets (without the surrounding [ ]).
 */
function collectBracketExpr(tokens: Token[], start: number): { expr: Token[]; nextPos: number } | null {
  if (
    start >= tokens.length ||
    tokens[start].type !== TokenType.OPERATOR ||
    tokens[start].value !== '['
  ) {
    return null;
  }

  const expr: Token[] = [];
  let depth = 1;
  let pos = start + 1;

  while (pos < tokens.length && depth > 0) {
    const t = tokens[pos];
    if (t.type === TokenType.OPERATOR && t.value === '[') {
      depth++;
      expr.push(t);
      pos++;
      continue;
    }
    if (t.type === TokenType.OPERATOR && t.value === ']') {
      depth--;
      if (depth === 0) {
        pos++; // consume closing ']'
        break;
      }
      expr.push(t);
      pos++;
      continue;
    }
    expr.push(t);
    pos++;
  }

  if (depth !== 0) {
    return null;
  }

  return { expr, nextPos: pos };
}

/**
 * Parses a memory operand:
 *  - Named array access: A[i], M[i][j]
 *  - Raw address expression: [addrExpr]
 */
function collectMemoryOperand(tokens: Token[], start: number): MemoryOperand | null {
  if (start >= tokens.length) return null;
  const t = tokens[start];

  // Raw address expression: [expr]
  if (t.type === TokenType.OPERATOR && t.value === '[') {
    const raw = collectBracketExpr(tokens, start);
    if (!raw) return null;
    return {
      kind: 'raw',
      tokens: raw.expr,
      nextPos: raw.nextPos
    };
  }

  // Array access: name[expr] or name[expr][expr]
  if (t.type === TokenType.IDENTIFIER && start + 1 < tokens.length &&
      tokens[start + 1].type === TokenType.OPERATOR && tokens[start + 1].value === '[') {
    const first = collectBracketExpr(tokens, start + 1);
    if (!first) return null;

    const operandTokens: Token[] = [tokens[start], tok(TokenType.OPERATOR, '[', tokens[start]), ...first.expr, tok(TokenType.OPERATOR, ']', tokens[start])];
    let pos = first.nextPos;

    // Optional second dimension: name[expr][expr]
    if (pos < tokens.length && tokens[pos].type === TokenType.OPERATOR && tokens[pos].value === '[') {
      const second = collectBracketExpr(tokens, pos);
      if (!second) return null;
      operandTokens.push(tok(TokenType.OPERATOR, '[', tokens[start]), ...second.expr, tok(TokenType.OPERATOR, ']', tokens[start]));
      pos = second.nextPos;
    }

    return {
      kind: 'array',
      tokens: operandTokens,
      nextPos: pos
    };
  }

  return null;
}

function buildAddressOperandTokens(mem: MemoryOperand, ref: Token): Token[] {
  // Array accesses stay as-is (A[i], M[i][j]).
  if (mem.kind === 'array') {
    return mem.tokens.map(t => ({ ...t }));
  }

  // Raw [expr] becomes IMM(expr) to reuse existing operand evaluator.
  return [
    tok(TokenType.IDENTIFIER, 'IMM', ref),
    tok(TokenType.OPERATOR, '(', ref),
    ...mem.tokens.map(t => ({ ...t })),
    tok(TokenType.OPERATOR, ')', ref)
  ];
}

function validateStatementTerminator(
  tokens: Token[],
  pos: number,
  inRowSyntax: boolean,
  lineRef: Token
): { terminatorToken?: Token; nextPos: number } {
  if (pos >= tokens.length) {
    throw { message: 'Expected statement terminator after assignment', line: lineRef.line };
  }

  const term = tokens[pos];
  if (term.type === TokenType.SEMICOLON) {
    return { terminatorToken: term, nextPos: pos + 1 };
  }

  if (inRowSyntax && term.type === TokenType.OPERATOR && term.value === '|') {
    // Row pipe separator - keep it for the row parser.
    return { terminatorToken: undefined, nextPos: pos };
  }

  throw {
    message: `Expected ';'${inRowSyntax ? " or '|'" : ''} after assignment`,
    line: term.line
  };
}

/**
 * Memory sugar desugaring with priority over C-like expressions.
 *
 * Supported:
 *  - R = A[i]      -> LWI R, A[i]
 *  - A[i] = R      -> SWI R, A[i]
 *  - R = [expr]    -> LWI R, IMM(expr)
 *  - [expr] = R    -> SWI R, IMM(expr)
 */
function desugarMemoryAssignment(
  tokens: Token[],
  i: number,
  inRowSyntax: boolean
): { replacement: Token[]; nextPos: number } | null {
  if (i >= tokens.length) return null;
  const lhs = tokens[i];

  // Case 1: store mem = reg
  const lhsMem = collectMemoryOperand(tokens, i);
  if (lhsMem) {
    const eq = tokens[lhsMem.nextPos];
    if (!(eq && eq.type === TokenType.OPERATOR && eq.value === '=')) {
      return null;
    }

    const rhsStart = lhsMem.nextPos + 1;
    if (
      rhsStart < tokens.length &&
      tokens[rhsStart].type === TokenType.OPERATOR &&
      tokens[rhsStart].value === '='
    ) {
      return null;
    }

    const rhsToken = tokens[rhsStart];
    const rhsMem = collectMemoryOperand(tokens, rhsStart);
    if (rhsMem) {
      throw {
        message: 'Memory-to-memory assignment is not supported. Use a register temporary: R0 = src; dst = R0;',
        line: lhs.line
      };
    }

    if (!isRegisterToken(rhsToken)) {
      throw {
        message: `Store assignment requires a register source. Use: mem = R0;`,
        line: rhsToken?.line ?? lhs.line
      };
    }

    const { terminatorToken, nextPos } = validateStatementTerminator(tokens, rhsStart + 1, inRowSyntax, lhs);
    const replacement: Token[] = [
      tok(TokenType.IDENTIFIER, 'SWI', lhs),
      tok(TokenType.IDENTIFIER, rhsToken.value.toUpperCase(), rhsToken),
      tok(TokenType.OPERATOR, ',', lhs),
      ...buildAddressOperandTokens(lhsMem, lhs),
    ];
    if (terminatorToken) replacement.push(terminatorToken);
    return { replacement, nextPos };
  }

  // Case 2: load reg = mem
  if (i + 2 >= tokens.length) return null;
  const eq = tokens[i + 1];
  const rhsStart = i + 2;
  if (eq.type !== TokenType.OPERATOR || eq.value !== '=') return null;
  if (tokens[rhsStart].type === TokenType.OPERATOR && tokens[rhsStart].value === '=') return null;

  const rhsMem = collectMemoryOperand(tokens, rhsStart);
  if (!rhsMem) return null;

  if (!isRegisterToken(lhs)) {
    throw {
      message: `Load assignment destination must be a register (R0-R3 or ROUT). Use: R0 = mem;`,
      line: lhs.line
    };
  }

  const { terminatorToken, nextPos } = validateStatementTerminator(tokens, rhsMem.nextPos, inRowSyntax, lhs);
  const replacement: Token[] = [
    tok(TokenType.IDENTIFIER, 'LWI', lhs),
    tok(TokenType.IDENTIFIER, lhs.value.toUpperCase(), lhs),
    tok(TokenType.OPERATOR, ',', lhs),
    ...buildAddressOperandTokens(rhsMem, lhs),
  ];
  if (terminatorToken) replacement.push(terminatorToken);
  return { replacement, nextPos };
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
  const destName = dest.value;
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
      tok(TokenType.IDENTIFIER, destName, dest),
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
        tok(TokenType.IDENTIFIER, destName, dest),
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
    tok(TokenType.IDENTIFIER, destName, dest),
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

    // Inside a cycle block — first apply memory sugar, then C-like expressions.
    const memoryDesugared = desugarMemoryAssignment(tokens, i, ctx.inRowSyntax);
    if (memoryDesugared) {
      result.push(...memoryDesugared.replacement);
      i = memoryDesugared.nextPos;
      continue;
    }

    // C-like expression desugaring
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
