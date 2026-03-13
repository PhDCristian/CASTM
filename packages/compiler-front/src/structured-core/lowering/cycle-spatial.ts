import { CycleStatementAst, Diagnostic, ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import { parseInstruction } from './instructions.js';
import { SourceLineEntry } from '../parser-utils/blocks.js';
import { applyBindings } from '../parser-utils/numbers.js';

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
