import { Diagnostic } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { splitTopLevel } from '../parser-utils/strings.js';

export interface FunctionSignature {
  name: string;
  params: string[];
}

export interface ParsedFunctionCall {
  name: string;
  args: string[];
}

export function parseFunctionHeader(cleanLine: string): { name: string; paramsText: string } | null {
  const match = cleanLine.match(/^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*\{\s*$/i);
  if (!match) return null;
  return {
    name: match[1],
    paramsText: match[2].trim()
  };
}

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

export function parseFunctionCallLine(cleanLine: string): ParsedFunctionCall | null {
  const match = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*;?\s*$/);
  if (!match) return null;

  const argsText = match[2].trim();
  const args = argsText.length === 0
    ? []
    : splitTopLevel(argsText, ',').map((arg) => arg.trim());

  return {
    name: match[1],
    args
  };
}

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
