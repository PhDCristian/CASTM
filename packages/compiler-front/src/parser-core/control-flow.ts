import { Diagnostic } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { evaluateNumericExpression } from '../parser-utils/numbers.js';
import { splitTopLevel } from '../parser-utils/strings.js';

export interface ForHeader {
  variable: string;
  start: number;
  end: number;
  step: number;
  runtime?: boolean;
  control?: {
    row: number;
    col: number;
  };
}

export interface ParsedCondition {
  lhs: string;
  operator: '==' | '!=' | '<' | '>=' | '>' | '<=';
  rhs: string;
}

export interface ParsedControlHeader {
  condition: ParsedCondition;
  row: number;
  col: number;
}

export function parseForHeader(
  cleanLine: string,
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): ForHeader | null {
  const loopMatch = cleanLine.match(
    /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\((.*)\)\s*(?:at\s+@\s*([^,{\s]+)\s*,\s*([^{\s]+))?\s*(runtime)?\s*\{\s*$/i
  );
  if (!loopMatch) return null;

  const variable = loopMatch[1];
  const argsText = loopMatch[2].trim();
  const args = argsText.length === 0 ? [] : splitTopLevel(argsText, ',');

  if (args.length < 1 || args.length > 3) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      `Invalid range() in for loop: expected 1..3 arguments, got ${args.length}.`,
      'Valid forms: range(end), range(start,end), range(start,end,step).'
    ));
    return null;
  }

  const values: number[] = [];
  for (const arg of args) {
    const value = evaluateNumericExpression(arg.trim(), constants, bindings);
    if (value === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanLine.length),
        `Invalid range() argument '${arg.trim()}' in for loop.`,
        'Use integer literals, constants, loop bindings, and + - * / % operators.'
      ));
      return null;
    }
    values.push(value);
  }

  let start = 0;
  let end = 0;
  let step = 1;
  if (values.length === 1) {
    end = values[0];
  } else if (values.length === 2) {
    start = values[0];
    end = values[1];
  } else {
    start = values[0];
    end = values[1];
    step = values[2];
  }

  if (step === 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      'Invalid range() step: 0.',
      'Step must be a non-zero integer.'
    ));
    return null;
  }

  const runtime = Boolean(loopMatch[5]);
  let control: { row: number; col: number } | undefined;
  if (loopMatch[3] !== undefined || loopMatch[4] !== undefined) {
    const row = evaluateNumericExpression((loopMatch[3] ?? '').trim(), constants, bindings);
    const col = evaluateNumericExpression((loopMatch[4] ?? '').trim(), constants, bindings);
    if (row === null || col === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanLine.length),
        `Invalid control location '@${(loopMatch[3] ?? '').trim()},${(loopMatch[4] ?? '').trim()}' in for loop.`,
        'Control coordinates must evaluate to integers.'
      ));
      return null;
    }
    control = { row, col };
  }

  if (runtime && !control) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      'Runtime for-loops require an explicit control location.',
      'Use: for R0 in range(...) at @row,col runtime { ... }'
    ));
    return null;
  }

  return {
    variable,
    start,
    end,
    step,
    runtime,
    control
  };
}

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
