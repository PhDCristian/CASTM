import { Diagnostic } from '@castm/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import { FunctionSignature } from './types.js';

export function bindFunctionCallArgs(
  def: FunctionSignature,
  args: string[],
  callLineNo: number,
  diagnostics: Diagnostic[]
): Map<string, string> | null {
  const byParam = new Map<string, string>();
  let positionalIndex = 0;
  let seenNamed = false;

  for (const rawArg of args) {
    const named = rawArg.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/s);
    if (named && def.params.includes(named[1])) {
      const paramName = named[1];
      const value = named[2].trim();
      seenNamed = true;

      if (byParam.has(paramName)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(callLineNo, 1, 1),
          `Parameter '${paramName}' specified multiple times in call to '${def.name}'.`,
          'Specify each function parameter at most once.'
        ));
        return null;
      }

      byParam.set(paramName, value);
      continue;
    }

    if (seenNamed) {
      const usagePreview = def.params.length > 1
        ? `${def.name}(${def.params[0]}, ${def.params[1]}: value)`
        : `${def.name}(${def.params[0]}: value)`;
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(callLineNo, 1, 1),
        `Positional arguments must come before named arguments in call to '${def.name}'.`,
        `Use positional args first, then named args like ${usagePreview}.`
      ));
      return null;
    }

    if (positionalIndex >= def.params.length) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(callLineNo, 1, 1),
        `Function '${def.name}' expects ${def.params.length} argument(s), got ${args.length}.`,
        `Call it as: ${def.name}(${def.params.join(', ')})`
      ));
      return null;
    }

    byParam.set(def.params[positionalIndex], rawArg);
    positionalIndex++;
  }

  for (const param of def.params) {
    if (!byParam.has(param)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(callLineNo, 1, 1),
        `Missing argument for parameter '${param}' in call to '${def.name}'.`,
        `Call it as: ${def.name}(${def.params.join(', ')})`
      ));
      return null;
    }
  }

  return byParam;
}
