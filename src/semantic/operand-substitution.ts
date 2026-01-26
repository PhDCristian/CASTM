/**
 * OpenEdge-DSL Operand Substitution
 *
 * Handles variable substitution in loop bodies and array references.
 */

import { SymbolTable, NamedArray } from '../types/symbols';
import { evaluateSimpleExpression, tokenizeExpression } from '../utils/expression';

/**
 * Substitutes a loop variable in an operand with its current value
 * Handles array references like data[i], input[i+1], etc.
 */
export function substituteLoopVariable(
  operand: string,
  varName: string,
  value: number,
  symbols: SymbolTable
): string {
  // Check for array access pattern: name[expr]
  const arrayMatch = operand.match(/^(\w+)\[([^\]]+)\]$/);
  if (arrayMatch) {
    const arrayName = arrayMatch[1];
    const indexExpr = arrayMatch[2];

    // Substitute variable in index expression
    const substitutedExpr = substituteInExpression(indexExpr, varName, value);

    // Try to evaluate the expression
    try {
      const tokens = tokenizeExpression(substitutedExpr);
      const evaluatedIndex = evaluateSimpleExpression(tokens, symbols);

      // Resolve the array reference
      if (arrayName === 'data') {
        return `data[${evaluatedIndex}]`;
      }

      const namedArray = symbols.namedArrays.get(arrayName);
      if (namedArray) {
        // Convert to global data index
        const globalIndex = namedArray.globalStartIndex + evaluatedIndex;
        return `data[${globalIndex}]`;
      }

      // Unknown array, keep as-is with evaluated index
      return `${arrayName}[${evaluatedIndex}]`;
    } catch {
      // Can't evaluate - return with substituted expression
      return `${arrayName}[${substitutedExpr}]`;
    }
  }

  // Check for array property: name.property()
  const propMatch = operand.match(/^(\w+)\.(len|base|size|last)\(\)$/);
  if (propMatch) {
    // Properties are compile-time constants, no substitution needed
    return operand;
  }

  // Check if operand is the variable itself
  if (operand === varName) {
    return `IMM(${value})`;
  }

  // Check for variable in an expression
  if (operand.includes(varName)) {
    return substituteInExpression(operand, varName, value);
  }

  // No substitution needed
  return operand;
}

/**
 * Substitutes a variable in an arithmetic expression
 */
function substituteInExpression(expr: string, varName: string, value: number): string {
  // Use word boundary matching to avoid partial substitutions
  const regex = new RegExp(`\\b${varName}\\b`, 'g');
  return expr.replace(regex, value.toString());
}

/**
 * Resolves array property to its value
 */
export function resolveArrayPropertyValue(
  arrayName: string,
  property: string,
  symbols: SymbolTable
): number | null {
  const namedArray = symbols.namedArrays.get(arrayName);
  if (!namedArray) {
    return null;
  }

  switch (property) {
    case 'len':
      return namedArray.length;
    case 'base':
      return namedArray.baseAddress;
    case 'size':
      return namedArray.length * 4;
    case 'last':
      return namedArray.length - 1;
    default:
      return null;
  }
}

/**
 * Substitutes array properties in an expression
 * Replaces input.len() with the actual length value
 */
export function substituteArrayProperties(
  expr: string,
  symbols: SymbolTable
): string {
  // Match patterns like: arrayName.property()
  const propPattern = /(\w+)\.(len|base|size|last)\(\)/g;

  return expr.replace(propPattern, (match, arrayName, property) => {
    const value = resolveArrayPropertyValue(arrayName, property, symbols);
    if (value !== null) {
      return value.toString();
    }
    // Can't resolve - keep original
    return match;
  });
}

/**
 * Resolves a range() expression for loop bounds
 * Syntax: range(end) or range(start, end) or range(start, end, step)
 */
export function resolveRangeExpression(
  args: string[],
  symbols: SymbolTable
): { start: number; end: number; step: number } | null {
  // Substitute array properties in args
  const resolvedArgs = args.map(arg => {
    const substituted = substituteArrayProperties(arg, symbols);
    try {
      const tokens = tokenizeExpression(substituted);
      return evaluateSimpleExpression(tokens, symbols);
    } catch {
      return NaN;
    }
  });

  // Check all args resolved
  if (resolvedArgs.some(isNaN)) {
    return null;
  }

  switch (resolvedArgs.length) {
    case 1:
      // range(end) - start=0, step=1
      return { start: 0, end: resolvedArgs[0], step: 1 };
    case 2:
      // range(start, end) - step=1
      return { start: resolvedArgs[0], end: resolvedArgs[1], step: 1 };
    case 3:
      // range(start, end, step)
      return { start: resolvedArgs[0], end: resolvedArgs[1], step: resolvedArgs[2] };
    default:
      return null;
  }
}

/**
 * Calculates the number of iterations for a range
 */
export function calculateIterations(
  start: number,
  end: number,
  step: number
): number {
  if (step === 0) return 0;
  if (step > 0 && start >= end) return 0;
  if (step < 0 && start <= end) return 0;

  return Math.ceil(Math.abs(end - start) / Math.abs(step));
}

/**
 * Generates iteration values for a range
 */
export function* iterateRange(
  start: number,
  end: number,
  step: number
): Generator<number, void, unknown> {
  if (step > 0) {
    for (let i = start; i < end; i += step) {
      yield i;
    }
  } else if (step < 0) {
    for (let i = start; i > end; i += step) {
      yield i;
    }
  }
}
