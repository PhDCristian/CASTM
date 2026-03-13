import { Diagnostic } from '@castm/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import { splitTopLevel } from '../../parser-utils/strings.js';

export function parseFunctionParams(
  paramsText: string,
  lineNo: number,
  diagnostics: Diagnostic[]
): string[] | null {
  if (!paramsText) return [];
  const parts = splitTopLevel(paramsText, ',').map((p) => p.trim()).filter(Boolean);
  const params: string[] = [];

  for (const part of parts) {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*.+)?$/);
    if (!match) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, Math.max(1, paramsText.length)),
        `Invalid function parameter '${part}'.`,
        'Use parameter syntax: name or name: type.'
      ));
      return null;
    }

    const name = match[1];
    if (params.includes(name)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, Math.max(1, paramsText.length)),
        `Duplicate function parameter '${name}'.`,
        'Each function parameter must be unique.'
      ));
      return null;
    }

    params.push(name);
  }

  return params;
}
