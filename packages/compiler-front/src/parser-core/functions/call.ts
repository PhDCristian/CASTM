import { splitTopLevel } from '../../parser-utils/strings.js';
import { ParsedFunctionCall } from './types.js';

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
