import {
  Diagnostic,
  ErrorCodes,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { parseIntegerLiteral } from '../pragma-args-utils.js';
import { DataSymbolInfo } from './types.js';

export function isRawAddress(expr: string): boolean {
  return /^\[(.+)\]$/s.test(expr.trim());
}

export function isArrayAddress(expr: string): boolean {
  const compact = expr.replace(/\s+/g, '');
  return /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]+\])+$/.test(compact);
}

export function isMemoryReference(expr: string): boolean {
  return isRawAddress(expr) || isArrayAddress(expr);
}

export function toAddressOperand(
  memExpr: string,
  dataSymbols: ReadonlyMap<string, DataSymbolInfo>,
  passDiagnostics: Diagnostic[],
  span: SourceSpan
): string | null {
  const trimmed = memExpr.trim();
  const raw = trimmed.match(/^\[(.+)\]$/s);
  if (raw) {
    return raw[1].trim();
  }

  const compact = trimmed.replace(/\s+/g, '');
  const arrayMatch = compact.match(/^([A-Za-z_][A-Za-z0-9_]*)((?:\[[^\]]+\])+)$/
  );
  if (!arrayMatch) {
    return trimmed;
  }

  const arrayName = arrayMatch[1];
  const symbol = dataSymbols.get(arrayName);
  if (!symbol) {
    passDiagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidAssignment,
      'error',
      span,
      `Undefined data symbol '${arrayName}'.`,
      `Declare it first with let: let ${arrayName} = { ... } or let ${arrayName}[rows][cols] = { ... }.`
    ));
    return null;
  }

  const indices = [...arrayMatch[2].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  if (symbol.rows !== undefined && symbol.cols !== undefined) {
    if (indices.length !== 2) {
      passDiagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `Expected 2D addressing for '${arrayName}', got '${trimmed}'.`,
        `Use two indices like ${arrayName}[row][col].`
      ));
      return null;
    }

    const rowIndex = parseIntegerLiteral(indices[0]);
    const colIndex = parseIntegerLiteral(indices[1]);
    if (rowIndex !== null && colIndex !== null) {
      if (rowIndex < 0 || rowIndex >= symbol.rows || colIndex < 0 || colIndex >= symbol.cols) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.CoordinateOutOfBounds,
          'error',
          span,
          `Index out of bounds for '${arrayName}[${symbol.rows}][${symbol.cols}]': [${rowIndex}][${colIndex}].`,
          'Use indices within declared bounds.'
        ));
        return null;
      }

      const linearIndex = rowIndex * symbol.cols + colIndex;
      return String(symbol.start + linearIndex * 4);
    }

    const rowExpr = indices[0];
    const colExpr = indices[1];
    return `${symbol.start} + (((${rowExpr}) * ${symbol.cols}) + (${colExpr})) * 4`;
  }

  if (indices.length !== 1) {
    passDiagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Expected 1D addressing for '${arrayName}', got '${trimmed}'.`,
      `Use one index like ${arrayName}[i].`
    ));
    return null;
  }

  const literalIndex = parseIntegerLiteral(indices[0]);
  if (literalIndex !== null) {
    if (literalIndex < 0 || literalIndex >= symbol.length) {
      passDiagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.CoordinateOutOfBounds,
        'error',
        span,
        `Index out of bounds for '${arrayName}[${symbol.length}]': [${literalIndex}].`,
        'Use indices within declared bounds.'
      ));
      return null;
    }

    return String(symbol.start + literalIndex * 4);
  }

  return `${symbol.start} + (${indices[0]}) * 4`;
}
