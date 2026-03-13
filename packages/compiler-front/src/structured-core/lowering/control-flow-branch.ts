import { Diagnostic, ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import { evaluateNumericExpression } from '../parser-utils/numbers.js';
import { ParsedCondition, ParsedControlHeader } from './control-flow-types.js';

function parseConditionExpression(conditionText: string): ParsedCondition | null {
  const operators = ['==', '!=', '>=', '<=', '>', '<'] as const;
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i < conditionText.length; i++) {
    const ch = conditionText[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);
    if (paren !== 0 || bracket !== 0) continue;

    for (const op of operators) {
      if (!conditionText.startsWith(op, i)) continue;
      const lhs = conditionText.slice(0, i).trim();
      const rhs = conditionText.slice(i + op.length).trim();
      if (!lhs || !rhs) return null;
      return {
        lhs,
        operator: op,
        rhs
      };
    }
  }

  return null;
}

export function parseControlHeader(
  cleanLine: string,
  keyword: 'if' | 'while',
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): ParsedControlHeader | null {
  const regex = keyword === 'if'
    ? /^if\s*\((.+)\)\s*at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i
    : /^while\s*\((.+)\)\s*at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i;
  const match = cleanLine.match(regex);
  if (!match) return null;

  const parsedCondition = parseConditionExpression(match[1].trim());
  if (!parsedCondition) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      `Invalid ${keyword} condition '${match[1].trim()}'.`,
      'Use condition syntax: <operand> <op> <operand>, where op is one of == != < <= > >='
    ));
    return null;
  }

  const row = evaluateNumericExpression(match[2].trim(), constants, new Map());
  const col = evaluateNumericExpression(match[3].trim(), constants, new Map());
  if (row === null || col === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      `Invalid ${keyword} control location '@${match[2].trim()},${match[3].trim()}'.`,
      'Control location coordinates must evaluate to integers.'
    ));
    return null;
  }

  return {
    condition: parsedCondition,
    row,
    col
  };
}

export function buildFalseBranchInstruction(condition: ParsedCondition, targetLabel: string): string {
  switch (condition.operator) {
    case '==':
      return `BNE ${condition.lhs}, ${condition.rhs}, ${targetLabel}`;
    case '!=':
      return `BEQ ${condition.lhs}, ${condition.rhs}, ${targetLabel}`;
    case '<':
      return `BGE ${condition.lhs}, ${condition.rhs}, ${targetLabel}`;
    case '>=':
      return `BLT ${condition.lhs}, ${condition.rhs}, ${targetLabel}`;
    case '>':
      return `BGE ${condition.rhs}, ${condition.lhs}, ${targetLabel}`;
    case '<=':
      return `BLT ${condition.rhs}, ${condition.lhs}, ${targetLabel}`;
  }
}
