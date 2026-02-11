import { CycleStatementAst, Diagnostic } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseForHeader } from './control-flow.js';
import { parseInstruction } from './instructions.js';
import { parseCycleStatement } from './statements.js';
import { collectBlockFromEntries, SourceLineEntry } from '../parser-utils/blocks.js';
import { applyBindings, evaluateNumericExpression } from '../parser-utils/numbers.js';
import { splitTopLevel } from '../parser-utils/strings.js';

export interface ParsedLabeledCycle {
  label: string;
  inlinePayload?: string;
}

export function expandSpatialAtBlockStatements(
  body: SourceLineEntry[],
  row: number,
  col: number,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): CycleStatementAst[] {
  const statements: CycleStatementAst[] = [];

  for (const entry of body) {
    const clean = applyBindings(entry.cleanLine, bindings).trim();
    const raw = applyBindings(entry.rawLine, bindings);
    if (!clean) continue;

    if (clean.includes('{') || clean.includes('}')) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, Math.max(1, clean.length)),
        `Unsupported nested block inside spatial at-block: '${clean}'.`,
        'Only plain instruction lines are allowed inside at @row,col { ... }.'
      ));
      continue;
    }

    const segments = clean.split(';').map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) continue;

    for (const segment of segments) {
      const column = Math.max(1, raw.indexOf(segment) + 1);
      statements.push({
        kind: 'at',
        row,
        col,
        instruction: parseInstruction(segment, entry.lineNo, column),
        span: spanAt(entry.lineNo, 1, Math.max(1, clean.length))
      });
    }
  }

  return statements;
}

export function expandLoopBody(
  body: SourceLineEntry[],
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): CycleStatementAst[] {
  const statements: CycleStatementAst[] = [];

  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    if (!entry.cleanLine) continue;

    const clean = applyBindings(entry.cleanLine, bindings);
    const raw = applyBindings(entry.rawLine, bindings);
    if (!clean) continue;

    const loopHeader = parseForHeader(clean, entry.lineNo, constants, bindings, diagnostics);
    if (loopHeader) {
      if (loopHeader.control) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Control location @row,col is not supported for for-loops inside cycle blocks.',
          'Move the loop to kernel/function scope to use runtime-control syntax.'
        ));
        continue;
      }

      if (loopHeader.runtime) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Runtime for-loops are not supported inside cycle blocks.',
          'Move the runtime loop to kernel/function scope.'
        ));
        continue;
      }

      const nested = collectBlockFromEntries(body, i);
      if (nested.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated for loop inside cycle block.',
          'Add a closing brace for for { ... }.'
        ));
        break;
      }

      const shouldContinue = loopHeader.step > 0
        ? (v: number) => v < loopHeader.end
        : (v: number) => v > loopHeader.end;

      for (let value = loopHeader.start; shouldContinue(value); value += loopHeader.step) {
        const nestedBindings = new Map(bindings);
        nestedBindings.set(loopHeader.variable, value);
        statements.push(...expandLoopBody(nested.body, constants, nestedBindings, diagnostics));
      }

      i = nested.endIndex;
      continue;
    }

    const atBlockHeader = clean.match(/^at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
    if (atBlockHeader) {
      const row = evaluateNumericExpression(atBlockHeader[1].trim(), constants, bindings);
      const col = evaluateNumericExpression(atBlockHeader[2].trim(), constants, bindings);
      if (row === null || col === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          `Invalid spatial at-block location '@${atBlockHeader[1].trim()},${atBlockHeader[2].trim()}'.`,
          'Coordinates must evaluate to integers.'
        ));
        continue;
      }

      const nested = collectBlockFromEntries(body, i);
      if (nested.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated spatial at-block.',
          'Add a closing brace for at @row,col { ... }.'
        ));
        break;
      }

      statements.push(...expandSpatialAtBlockStatements(nested.body, row, col, bindings, diagnostics));
      i = nested.endIndex;
      continue;
    }

    if (clean === '}') {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        'Unexpected closing brace inside cycle block.',
        'Check for mismatched braces around for/cycle blocks.'
      ));
      continue;
    }

    const statement = parseCycleStatement(clean, entry.lineNo, raw, constants, bindings);
    if (!statement) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        `Invalid cycle statement: '${clean}'`,
        'Expected @row,col:, at @row,col:, at @row,col { ... }, at row/col/all, or for ... in range(...) { ... }.'
      ));
      continue;
    }

    statements.push(statement);
  }

  return statements;
}

export function parseLabeledCycleLine(cleanLine: string): ParsedLabeledCycle | null {
  const inline = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*cycle\s*\{\s*(.+)\s*\}\s*$/i);
  if (inline) {
    return {
      label: inline[1],
      inlinePayload: inline[2]
    };
  }

  const block = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*cycle\s*\{\s*$/i);
  if (block) {
    return {
      label: block[1]
    };
  }

  return null;
}

export function parseInlineCycleStatements(
  payload: string,
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): CycleStatementAst[] {
  const statements: CycleStatementAst[] = [];
  const parts = splitTopLevel(payload, ';').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const cleanStmt = `${part};`;
    const parsed = parseCycleStatement(cleanStmt, lineNo, cleanStmt, constants, new Map());
    if (!parsed) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanStmt.length),
        `Invalid inline cycle statement: '${part}'.`,
        'Use valid cycle placement syntax like @r,c:, at @r,c:, at row:, at col:, or at all:.'
      ));
      continue;
    }
    statements.push(parsed);
  }
  return statements;
}

export function isElseOpenLine(cleanLine: string): boolean {
  return /^else\s*\{\s*$/i.test(cleanLine);
}
