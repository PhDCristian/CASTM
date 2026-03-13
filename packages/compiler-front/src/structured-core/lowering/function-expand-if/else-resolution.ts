import { Diagnostic } from '@castm/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import {
  CollectedBlock,
  collectBlockAfterOpenFromEntries,
  collectBlockFromEntries,
  SourceLineEntry
} from '../../parser-utils/blocks.js';
import { isElseOpenLine } from '../cycle-expand.js';

export interface ResolvedElseBlockInFunction {
  hasElse: boolean;
  elseBlock: CollectedBlock | null;
  consumedEnd: number;
  shouldBreak: boolean;
}

export function resolveOptionalElseBlockInFunction(
  body: SourceLineEntry[],
  thenBlock: CollectedBlock,
  entryLineNo: number,
  cleanLength: number,
  diagnostics: Diagnostic[]
): ResolvedElseBlockInFunction {
  let hasElse = false;
  let elseBlock: CollectedBlock | null = null;
  let consumedEnd = thenBlock.endIndex ?? 0;

  if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
    hasElse = true;
    elseBlock = collectBlockAfterOpenFromEntries(body, thenBlock.endIndex! + 1);
    if (elseBlock.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entryLineNo, 1, cleanLength),
        'Unterminated else block.',
        'Add a closing brace for else { ... }.'
      ));
      return { hasElse, elseBlock, consumedEnd, shouldBreak: true };
    }
    consumedEnd = elseBlock.endIndex;
  } else {
    const maybeElseIndex = thenBlock.endIndex! + 1;
    if (maybeElseIndex < body.length && isElseOpenLine(body[maybeElseIndex].cleanLine)) {
      hasElse = true;
      elseBlock = collectBlockFromEntries(body, maybeElseIndex);
      if (elseBlock.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(body[maybeElseIndex].lineNo, 1, body[maybeElseIndex].cleanLine.length),
          'Unterminated else block.',
          'Add a closing brace for else { ... }.'
        ));
        return { hasElse, elseBlock, consumedEnd, shouldBreak: true };
      }
      consumedEnd = elseBlock.endIndex;
    }
  }

  return { hasElse, elseBlock, consumedEnd, shouldBreak: false };
}
