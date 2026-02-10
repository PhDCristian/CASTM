/**
 * OpenEdge-DSL Function Parser
 *
 * Handles parsing and expansion of function calls.
 * 
 * Features:
 * - Textual parameter substitution
 * - Auto-prefixing of internal labels to avoid collisions
 */

import { Token, TokenType } from '../types/tokens';
import { FunctionDefinition } from '../types/symbols';

// Counter for generating unique function expansion IDs
let functionExpansionCounter = 0;

/**
 * Resets the function expansion counter (for testing)
 */
export function resetFunctionExpansionCounter(): void {
  functionExpansionCounter = 0;
}

/**
 * Helper to check if a token is a colon
 */
function isColon(t: Token | undefined): boolean {
  return t?.type === TokenType.OPERATOR && t.value === ':';
}

/**
 * Parses function call arguments from a token array.
 * Handles nested parentheses and multi-token arguments.
 * 
 * Supports two modes:
 * 1. Positional args (required if function has no types): FUNC(arg1, arg2)
 * 2. Named args (allowed if function has typed params): FUNC(b: arg2, a: arg1)
 * 
 * Like Python, you can mix positional then named: FUNC(arg1, b: arg2)
 * But named args must come after all positional args.
 *
 * @param tokens - Token array
 * @param current - Current position (updated in place via returned value)
 * @param func - Function definition with params and optional paramTypes
 * @returns Object with parsed args and new position
 */
export function parseFunctionArgs(
  tokens: Token[],
  current: number,
  func: { params: string[]; paramTypes?: string[] }
): { args: Token[][]; position: number } {
  // Skip opening paren
  if (tokens[current]?.value !== '(') {
    throw { message: `Expected '(' for function call`, line: tokens[current]?.line ?? -1 };
  }
  current++;

  const args: Token[][] = new Array(func.params.length).fill(null).map(() => []);
  const filledIndices = new Set<number>();

  // Check if function has typed params (allows named args)
  const hasTypedParams = func.paramTypes && func.paramTypes.some(t => t !== '');

  let positionalCount = 0;
  let usingNamedArgs = false;

  if (tokens[current]?.value !== ')') {
    while (true) {
      // Check if this is a named argument: paramName: value
      // Look for pattern: IDENTIFIER followed by COLON
      const isNamedArg = hasTypedParams &&
        tokens[current]?.type === TokenType.IDENTIFIER &&
        tokens[current + 1]?.type === TokenType.OPERATOR &&
        tokens[current + 1]?.value === ':' &&
        func.params.includes(tokens[current].value);

      if (isNamedArg) {
        usingNamedArgs = true;
        const paramName = tokens[current].value;
        const paramIndex = func.params.indexOf(paramName);

        if (filledIndices.has(paramIndex)) {
          throw {
            message: `Parameter '${paramName}' specified multiple times`,
            line: tokens[current]?.line ?? -1
          };
        }

        current += 2; // Skip param name and colon

        // Parse the argument value
        let parenCount = 0;
        const argTokens: Token[] = [];
        while (current < tokens.length) {
          const t = tokens[current];
          if (t.value === ',' && parenCount === 0) break;
          if (t.value === ')' && parenCount === 0) break;
          if (t.value === '(') parenCount++;
          if (t.value === ')') parenCount--;
          argTokens.push(t);
          current++;
        }

        args[paramIndex] = argTokens;
        filledIndices.add(paramIndex);
      } else {
        // Positional argument
        if (usingNamedArgs) {
          throw {
            message: `Positional arguments must come before named arguments`,
            line: tokens[current]?.line ?? -1
          };
        }

        if (positionalCount >= func.params.length) {
          throw {
            message: `Too many arguments for function (expected ${func.params.length})`,
            line: tokens[current]?.line ?? -1
          };
        }

        // Parse the argument value
        let parenCount = 0;
        const argTokens: Token[] = [];
        while (current < tokens.length) {
          const t = tokens[current];
          if (t.value === ',' && parenCount === 0) break;
          if (t.value === ')' && parenCount === 0) break;
          if (t.value === '(') parenCount++;
          if (t.value === ')') parenCount--;
          argTokens.push(t);
          current++;
        }

        args[positionalCount] = argTokens;
        filledIndices.add(positionalCount);
        positionalCount++;
      }

      // Check for comma or end
      if (tokens[current]?.value === ',') {
        current++;
      } else if (tokens[current]?.value === ')') {
        break;
      } else if (current >= tokens.length) {
        throw { message: `Unexpected end of function call`, line: -1 };
      }
    }
  }

  // Validate all required parameters are filled
  for (let i = 0; i < func.params.length; i++) {
    if (!filledIndices.has(i)) {
      throw {
        message: `Missing argument for parameter '${func.params[i]}'`,
        line: tokens[current]?.line ?? -1
      };
    }
  }

  // Skip closing paren
  if (tokens[current]?.value !== ')') {
    throw { message: `Expected ')' for function call`, line: tokens[current]?.line ?? -1 };
  }
  current++;

  return { args, position: current };
}

/**
 * Detects labels defined in function tokens.
 * Labels are identifiers followed by a colon at the start of a line/cycle.
 * 
 * @param tokens - Function body tokens
 * @returns Set of label names found
 */
function detectLabelsInFunction(tokens: Token[]): Set<string> {
  const labels = new Set<string>();
  const NON_LABEL_IDENTIFIERS = new Set(['all']);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];

    // Pattern: IDENTIFIER followed by COLON (but not part of @row,col:)
    // Labels are identifiers at cycle/line start followed by :
    if (t.type === TokenType.IDENTIFIER &&
      isColon(next) &&
      !NON_LABEL_IDENTIFIERS.has(t.value.toLowerCase()) &&
      // Exclude coordinate patterns like @0,0:
      (i === 0 || tokens[i - 1]?.type !== TokenType.AT_SYMBOL)) {
      // Check it's not inside a coordinate (no comma before)
      const prevNonWhitespace = tokens[i - 1];
      if (prevNonWhitespace?.value !== ',') {
        labels.add(t.value);
      }
    }
  }

  return labels;
}


/**
 * Expands function tokens by substituting parameters with arguments
 * and prefixing internal labels with a unique ID.
 *
 * @param func - Function definition with params and tokens
 * @param args - Parsed arguments (token arrays)
 * @param functionName - Name of the function (for label prefix)
 * @returns Expanded tokens with arguments substituted and labels prefixed
 */
export function expandFunctionTokens(
  func: { params: string[]; tokens: Token[] },
  args: Token[][],
  functionName?: string
): Token[] {
  // Detect labels and references in the function body
  const labels = detectLabelsInFunction(func.tokens);

  // If there are labels, we need to prefix them to avoid collisions
  const needsLabelPrefix = labels.size > 0;
  const expansionId = needsLabelPrefix ? functionExpansionCounter++ : 0;
  const prefix = needsLabelPrefix ? `_${functionName || 'fn'}_${expansionId}_` : '';

  const expanded: Token[] = [];
  for (let i = 0; i < func.tokens.length; i++) {
    const t = func.tokens[i];

    // Parameter substitution
    if (t.type === TokenType.IDENTIFIER && func.params.includes(t.value)) {
      const idx = func.params.indexOf(t.value);
      if (idx >= 0 && idx < args.length) {
        expanded.push(...args[idx]);
      } else {
        expanded.push(t);
      }
      continue;
    }

    // Label definition prefixing: check if next token is ':'
    if (t.type === TokenType.IDENTIFIER &&
      labels.has(t.value) &&
      isColon(func.tokens[i + 1])) {
      // Prefix the label definition
      expanded.push({
        ...t,
        value: prefix + t.value
      });
      continue;
    }

    // Label reference prefixing: in branch/jump instructions
    if (t.type === TokenType.IDENTIFIER && labels.has(t.value)) {
      // Check if this is a reference (not a definition)
      const next = func.tokens[i + 1];

      // If it's followed by ':', it's a definition (handled above)
      // Otherwise, it's a reference that needs prefixing
      if (!isColon(next)) {
        expanded.push({
          ...t,
          value: prefix + t.value
        });
        continue;
      }
    }

    // Default: copy token as-is
    expanded.push(t);
  }

  return expanded;
}

/**
 * Parses and expands a function call, injecting tokens at the current position.
 *
 * @param tokens - Token array (modified in place)
 * @param current - Current position
 * @param func - Function definition
 * @param functionName - Name of the function (optional, for label prefixing)
 * @returns New position after parsing (before injected tokens)
 */
export function expandFunctionCall(
  tokens: Token[],
  current: number,
  func: FunctionDefinition,
  functionName?: string
): number {
  const { args, position } = parseFunctionArgs(tokens, current, func);

  // Skip semicolon if present
  let newPosition = position;
  if (tokens[newPosition]?.type === TokenType.SEMICOLON) {
    newPosition++;
  }

  // Expand and inject tokens with label prefixing
  const expanded = expandFunctionTokens(func, args, functionName);
  tokens.splice(newPosition, 0, ...expanded);

  return newPosition;
}
