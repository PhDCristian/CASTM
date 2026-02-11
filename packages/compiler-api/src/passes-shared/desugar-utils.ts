import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  InstructionAst,
  SourceSpan,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { cloneAst } from './ast-utils.js';
import { isIdentifier, parseIntegerLiteral } from './pragma-args-utils.js';

export interface DataSymbolInfo {
  start: number;
  length: number;
  rows?: number;
  cols?: number;
}

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
      `Declare it first: .data ${arrayName} { ... } or .data2d ${arrayName}[rows][cols].`
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
        `Expected 2D addressing for '.data2d ${arrayName}', got '${trimmed}'.`,
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
          `Index out of bounds for '.data2d ${arrayName}[${symbol.rows}][${symbol.cols}]': [${rowIndex}][${colIndex}].`,
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
      `Expected 1D addressing for '.data ${arrayName}', got '${trimmed}'.`,
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
        `Index out of bounds for '.data ${arrayName}[${symbol.length}]': [${literalIndex}].`,
        'Use indices within declared bounds.'
      ));
      return null;
    }

    return String(symbol.start + literalIndex * 4);
  }

  return `${symbol.start} + (${indices[0]}) * 4`;
}

export function splitAssignment(text: string): { lhs: string; rhs: string } | null {
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (ch !== '=' || paren !== 0 || bracket !== 0) continue;

    const prev = text[i - 1] ?? '';
    const next = text[i + 1] ?? '';
    const isComparison = prev === '=' || prev === '!' || prev === '<' || prev === '>' || next === '=';
    if (isComparison) continue;

    return {
      lhs: text.slice(0, i).trim(),
      rhs: text.slice(i + 1).trim()
    };
  }

  return null;
}

export function splitTopLevelBinary(rhs: string): { left: string; op: string; right: string } | null {
  let paren = 0;
  let bracket = 0;
  const operators = ['>>>', '>>', '<<', '**', '~&', '~|', '~^', '+', '-', '*', '&', '|', '^'];

  for (let i = 0; i < rhs.length; i++) {
    const ch = rhs[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (paren !== 0 || bracket !== 0) continue;

    for (const op of operators) {
      if (!rhs.startsWith(op, i)) continue;
      if (op === '-' && i === 0) continue;
      return {
        left: rhs.slice(0, i).trim(),
        op,
        right: rhs.slice(i + op.length).trim()
      };
    }
  }

  return null;
}

export function transformInstructions(
  ast: AstProgram,
  transformer: (instruction: InstructionAst, diagnostics: Diagnostic[]) => InstructionAst
): { output: AstProgram; diagnostics: Diagnostic[] } {
  const out = cloneAst(ast);
  if (!out.kernel) return { output: out, diagnostics: [] };

  const diagnostics: Diagnostic[] = [];

  for (const cycle of out.kernel.cycles) {
    for (const stmt of cycle.statements) {
      if (stmt.kind === 'row') {
        stmt.instructions = stmt.instructions.map((inst) => transformer(inst, diagnostics));
        continue;
      }

      stmt.instruction = transformer(stmt.instruction, diagnostics);
    }
  }

  return { output: out, diagnostics };
}

export function requireIdentifier(
  token: string,
  diagnostics: Diagnostic[],
  span: SourceSpan,
  message: string,
  hint: string
): boolean {
  if (isIdentifier(token)) return true;
  diagnostics.push(makeDiagnostic(
    ErrorCodes.Semantic.InvalidAssignment,
    'error',
    span,
    message,
    hint
  ));
  return false;
}
