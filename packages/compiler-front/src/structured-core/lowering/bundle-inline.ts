import { BundleStatementAst, Diagnostic, ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import { parseBundleStatement } from './statements.js';
import { splitTopLevel } from '../parser-utils/strings.js';
import { INTERPOLATED_IDENT } from '../constants.js';

export interface ParsedLabeledBundle {
  label: string;
  inlinePayload?: string;
}

export function parseLabeledBundleLine(cleanLine: string): ParsedLabeledBundle | null {
  const inline = cleanLine.match(new RegExp(`^(${INTERPOLATED_IDENT})\\s*:\\s*bundle\\s*\\{\\s*(.+)\\s*\\}\\s*$`, 'i'));
  if (inline) {
    return {
      label: inline[1],
      inlinePayload: inline[2]
    };
  }

  const block = cleanLine.match(new RegExp(`^(${INTERPOLATED_IDENT})\\s*:\\s*bundle\\s*\\{\\s*$`, 'i'));
  if (block) {
    return {
      label: block[1]
    };
  }

  return null;
}

export function parseInlineBundleStatements(
  payload: string,
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): BundleStatementAst[] {
  const statements: BundleStatementAst[] = [];
  const parts = splitTopLevel(payload, ';').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const cleanStmt = `${part};`;
    const parsed = parseBundleStatement(cleanStmt, lineNo, cleanStmt, constants, new Map());
    if (!parsed || parsed.length === 0) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanStmt.length),
        `Invalid inline bundle statement: '${part}'.`,
        'Use valid bundle placement syntax like @r,c:, at @r,c:, at row:, at col:, or at all:.'
      ));
      continue;
    }
    statements.push(...parsed);
  }
  return statements;
}

export function isElseOpenLine(cleanLine: string): boolean {
  return /^else\s*\{\s*$/i.test(cleanLine);
}
