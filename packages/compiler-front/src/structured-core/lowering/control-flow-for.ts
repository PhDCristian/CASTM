import { Diagnostic, ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import { evaluateNumericExpression } from '../parser-utils/numbers.js';
import { splitTopLevel } from '../parser-utils/strings.js';
import { ForHeader } from './control-flow-types.js';

interface ParsedLoopModifiers {
  unrollFactor?: number;
  collapseLevels?: number;
  collapseOrder?: 'row_major';
}

function parseLoopModifiers(
  modifiersText: string,
  lineNo: number,
  lineLength: number,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): ParsedLoopModifiers | null {
  const trimmed = modifiersText.trim();
  if (!trimmed) return {};

  const modifierMatches = Array.from(trimmed.matchAll(/\b(unroll|collapse)\s*\(([^)]*)\)/gi));
  if (modifierMatches.length === 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, lineLength),
      `Invalid for-loop modifier list '${trimmed}'.`,
      'Use modifiers as unroll(k) and/or collapse(n).'
    ));
    return null;
  }

  const residue = trimmed.replace(/\b(?:unroll|collapse)\s*\([^)]*\)\s*/gi, '').trim();
  if (residue.length > 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, lineLength),
      `Invalid for-loop modifier segment '${residue}'.`,
      'Use only unroll(k) and collapse(n) after range(...).'
    ));
    return null;
  }

  const result: ParsedLoopModifiers = {};
  for (const match of modifierMatches) {
    const name = match[1].toLowerCase();
    const argText = match[2].trim();
    const value = evaluateNumericExpression(argText, constants, bindings);

    if (value === null || !Number.isInteger(value)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, lineLength),
        `Invalid ${name}(...) argument '${argText}'.`,
        'Use an integer literal/expression.'
      ));
      return null;
    }

    if (value <= 0) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, lineLength),
        `Invalid ${name}(${value}) value.`,
        `${name}(k) requires k > 0.`
      ));
      return null;
    }

    if (name === 'unroll') {
      if (result.unrollFactor !== undefined) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(lineNo, 1, lineLength),
          'Duplicate unroll(...) modifier in for-loop header.',
          'Declare unroll(k) at most once per for-loop.'
        ));
        return null;
      }
      result.unrollFactor = value;
      continue;
    }

    if (result.collapseLevels !== undefined) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, lineLength),
        'Duplicate collapse(...) modifier in for-loop header.',
        'Declare collapse(n) at most once per for-loop.'
      ));
      return null;
    }
    result.collapseLevels = value;
    result.collapseOrder = 'row_major';
  }

  return result;
}

export function parseForHeader(
  cleanLine: string,
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): ForHeader | null {
  const loopMatch = cleanLine.match(
    /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\(([^)]*)\)\s*(?:at\s+@\s*([^,{\s]+)\s*,\s*([^{\s]+))?\s*(runtime)?\s*([^{]*)\{\s*$/i
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

  const parsedModifiers = parseLoopModifiers(
    loopMatch[6],
    lineNo,
    cleanLine.length,
    constants,
    bindings,
    diagnostics
  );
  if (!parsedModifiers) return null;

  if (runtime && parsedModifiers.collapseLevels !== undefined) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      'collapse(n) is not supported for runtime for-loops.',
      'Use collapse(n) only on static compile-time loops.'
    ));
    return null;
  }

  if (runtime && parsedModifiers.unrollFactor !== undefined) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      'unroll(k) is not supported for runtime for-loops.',
      'Use unroll(k) only on static compile-time loops.'
    ));
    return null;
  }

  return {
    variable,
    start,
    end,
    step,
    unrollFactor: parsedModifiers.unrollFactor,
    collapseLevels: parsedModifiers.collapseLevels,
    collapseOrder: parsedModifiers.collapseOrder,
    runtime,
    control
  };
}
