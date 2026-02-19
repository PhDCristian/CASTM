import { escapeRegExp } from './strings.js';

export function parseNumber(text: string): number {
  const trimmed = text.trim();
  if (/^-?0x[0-9a-f]+$/i.test(trimmed)) {
    const sign = trimmed.startsWith('-') ? -1 : 1;
    const hex = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
    return sign * parseInt(hex, 16);
  }
  return parseInt(trimmed, 10);
}

export function applyBindings(input: string, bindings: ReadonlyMap<string, number>): string {
  let out = input;
  for (const [name, value] of bindings.entries()) {
    // Substitute {name} patterns first (label interpolation in for loops)
    const braceRegex = new RegExp(`\\{${escapeRegExp(name)}\\}`, 'g');
    out = out.replace(braceRegex, String(value));
    // Then substitute bare word occurrences (existing behavior)
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
    out = out.replace(regex, String(value));
  }
  return out;
}

export function evaluateNumericExpression(
  expression: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): number | null {
  const evaluated = evaluateNumericExpressionRaw(expression, constants, bindings);
  if (evaluated === null || !Number.isInteger(evaluated)) return null;
  return evaluated;
}

export function evaluateCoordinateExpression(
  expression: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): number | null {
  const evaluated = evaluateNumericExpressionRaw(expression, constants, bindings);
  if (evaluated === null) return null;
  return Number.isInteger(evaluated) ? evaluated : Math.trunc(evaluated);
}

function evaluateNumericExpressionRaw(
  expression: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): number | null {
  const unresolved: string[] = [];
  const replaced = expression.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (name) => {
    if (bindings.has(name)) return String(bindings.get(name));
    if (constants.has(name)) return String(constants.get(name));
    unresolved.push(name);
    return name;
  });

  if (unresolved.length > 0) return null;
  if (!/^[0-9a-fA-FxX+\-*/%()\s]+$/.test(replaced)) return null;

  try {
    const value = Function(`"use strict"; return (${replaced});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}
