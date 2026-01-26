/**
 * OpenEdge-DSL Expression Evaluation
 *
 * Handles compile-time evaluation of simple arithmetic expressions.
 */

import { SymbolTable } from '../types/symbols';
import { extractNumericValue } from './string-utils';

/**
 * Arithmetic operators supported in expressions
 */
export type ArithmeticOperator = '+' | '-' | '*' | '/' | '%';

/**
 * Checks if a string is an arithmetic operator
 */
export function isArithmeticOperator(str: string): str is ArithmeticOperator {
  return ['+', '-', '*', '/', '%'].includes(str);
}

/**
 * Operator precedence (higher number = higher precedence)
 */
const OPERATOR_PRECEDENCE: Record<ArithmeticOperator, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2
};

/**
 * Evaluates simple arithmetic expressions like:
 * - "3" → 3
 * - "3 + 2" → 5
 * - "3 + i" (where i was substituted to "1") → 4
 * - "3 + i * 2" → with proper precedence
 * - "N + 1" (where N is a constant) -> resolved using symbol table
 *
 * @param tokens Array of token strings (numbers and operators)
 * @param symbols Optional SymbolTable for resolving constants
 * @returns The evaluated numeric result
 * @throws Error if expression is invalid
 */
export function evaluateSimpleExpression(tokens: string[], symbols?: SymbolTable): number {
  if (tokens.length === 0) {
    throw new Error('Empty expression');
  }

  // Filter out parentheses from IMM() wrappers and reconstruct
  const cleanedTokens = cleanImmTokens(tokens);

  // Single token case
  if (cleanedTokens.length === 1) {
    const token = cleanedTokens[0];
    if (symbols && symbols.constants.has(token)) {
      const constVal = symbols.constants.get(token)!;
      return parseInt(constVal, 10);
    }
    return extractNumericValue(token);
  }

  // Parse tokens into numbers and operators
  const values: number[] = [];
  const operators: ArithmeticOperator[] = [];

  for (const token of cleanedTokens) {
    if (isArithmeticOperator(token)) {
      operators.push(token);
    } else {
      if (symbols && symbols.constants.has(token)) {
        const constVal = symbols.constants.get(token)!;
        values.push(parseInt(constVal, 10));
      } else {
        values.push(extractNumericValue(token));
      }
    }
  }

  // Validate structure
  if (values.length !== operators.length + 1) {
    throw new Error(`Invalid expression structure: ${cleanedTokens.join(' ')}`);
  }

  // Apply operators with precedence (* / % before + and -)
  // First pass: handle *, / and %
  let i = 0;
  while (i < operators.length) {
    if (operators[i] === '*' || operators[i] === '/' || operators[i] === '%') {
      const left = values[i];
      const right = values[i + 1];
      if ((operators[i] === '/' || operators[i] === '%') && right === 0) {
        throw new Error('Division by zero');
      }
      let result: number;
      if (operators[i] === '*') {
        result = left * right;
      } else if (operators[i] === '/') {
        result = Math.floor(left / right);
      } else {
        result = left % right;
      }
      values.splice(i, 2, result);
      operators.splice(i, 1);
    } else {
      i++;
    }
  }

  // Second pass: handle + and -
  let result = values[0];
  for (let j = 0; j < operators.length; j++) {
    if (operators[j] === '+') {
      result += values[j + 1];
    } else if (operators[j] === '-') {
      result -= values[j + 1];
    }
  }

  return result;
}

/**
 * Cleans up tokens by reconstructing IMM() wrappers that might have been
 * tokenized separately (e.g., ["IMM", "(", "5", ")"] → ["IMM(5)"])
 */
function cleanImmTokens(tokens: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (tokens[i].toUpperCase() === 'IMM' && tokens[i + 1] === '(') {
      // Reconstruct IMM(value)
      let immValue = 'IMM(';
      i += 2; // Skip 'IMM' and '('

      // Collect everything until closing paren
      while (i < tokens.length && tokens[i] !== ')') {
        immValue += tokens[i];
        i++;
      }

      immValue += ')';
      i++; // Skip ')'
      result.push(immValue);
    } else {
      result.push(tokens[i]);
      i++;
    }
  }

  return result;
}

/**
 * Parses an expression string into tokens
 * Handles: numbers, operators, IMM() wrappers
 */
export function tokenizeExpression(expr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      i++;
      continue;
    }

    // Operators
    if (['+', '-', '*', '/', '%'].includes(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
      i++;
      continue;
    }

    // Parentheses
    if (char === '(' || char === ')') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
      i++;
      continue;
    }

    // Accumulate other characters (numbers, identifiers)
    current += char;
    i++;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Evaluates an expression string
 */
export function evaluateExpressionString(expr: string): number {
  const tokens = tokenizeExpression(expr);
  return evaluateSimpleExpression(tokens);
}

/**
 * Substitutes a variable in an expression with a value
 * @param expr The expression string
 * @param varName The variable name to substitute
 * @param value The value to substitute
 * @returns The expression with substituted values
 */
export function substituteVariable(
  expr: string,
  varName: string,
  value: number
): string {
  // Use word boundary matching to avoid partial substitutions
  const regex = new RegExp(`\\b${varName}\\b`, 'g');
  return expr.replace(regex, value.toString());
}

/**
 * Checks if an expression can be evaluated at compile time
 * (i.e., contains only numeric literals and operators)
 */
export function isCompileTimeExpression(tokens: string[]): boolean {
  const cleaned = cleanImmTokens(tokens);

  for (const token of cleaned) {
    // Allow operators
    if (isArithmeticOperator(token)) {
      continue;
    }

    // Allow numeric values
    const immMatch = token.match(/^IMM\((-?\d+)\)$/i);
    if (immMatch) {
      continue;
    }

    // Allow plain numbers
    if (/^-?\d+$/.test(token) || /^0[xX][0-9a-fA-F]+$/.test(token)) {
      continue;
    }

    // Any other token means it's not compile-time evaluable
    return false;
  }

  return true;
}
