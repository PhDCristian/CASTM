import {
  Diagnostic,
  ErrorCodes,
  makeDiagnostic,
  StructuredKernelStmtAst
} from '@openedge/compiler-ir';
import {
  SourceLineEntry
} from '../parser-utils/blocks.js';
import { spanAt } from './utils.js';
import {
  parseAdvancedStatement,
  parseFunctionCall,
  shouldSkipStructuredLine
} from './statements/matchers.js';
import { tryParseCycleStatement } from './statements/cycle-handler.js';
import { tryParseControlStatement } from './statements/control-handler.js';

export function parseStructuredStatements(
  entries: SourceLineEntry[],
  cycleCounter: { value: number },
  diagnostics: Diagnostic[]
): StructuredKernelStmtAst[] {
  const out: StructuredKernelStmtAst[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const clean = entry.cleanLine.trim();
    if (!clean) continue;

    if (shouldSkipStructuredLine(clean)) continue;

    const advanced = parseAdvancedStatement(clean);
    if (advanced) {
      out.push({
        kind: 'advanced',
        name: advanced.name,
        args: advanced.args,
        text: advanced.text,
        span: spanAt(entry.lineNo, clean.length)
      });
      continue;
    }

    const cycleResult = tryParseCycleStatement(entries, i, clean, entry.lineNo, cycleCounter, diagnostics);
    if (cycleResult.handled) {
      if (cycleResult.node) out.push(cycleResult.node);
      if (cycleResult.stop) break;
      i = cycleResult.nextIndex;
      continue;
    }

    const controlResult = tryParseControlStatement(
      entries,
      i,
      clean,
      entry.lineNo,
      cycleCounter,
      diagnostics,
      parseStructuredStatements
    );
    if (controlResult.handled) {
      if (controlResult.node) out.push(controlResult.node);
      if (controlResult.stop) break;
      i = controlResult.nextIndex;
      continue;
    }

    const fnCall = parseFunctionCall(clean);
    if (fnCall) {
      out.push({
        ...fnCall,
        span: spanAt(entry.lineNo, clean.length)
      });
      continue;
    }

    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, clean.length),
      `Unrecognized kernel statement: '${clean}'.`,
      'Use canonical statements (cycle, at, for, if, while, route/reduce/scan/broadcast/...).'
    ));
  }

  return out;
}
