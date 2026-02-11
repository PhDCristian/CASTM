import { Diagnostic, ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { evaluateNumericExpression } from '../parser-utils/numbers.js';
import { splitTopLevel } from '../parser-utils/strings.js';
import { ForHeader } from './control-flow-types.js';

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
