import { Diagnostic } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { isElseOpenLine } from '../cycle-expand.js';
import {
  CollectedBlock,
  collectBlockAfterOpenFromSource,
  collectBlockFromSource
} from '../../parser-utils/blocks.js';
import { stripLineComment } from '../../parser-utils/strings.js';

export interface ResolvedElseBlock {
  hasElse: boolean;
  elseBlock: CollectedBlock | null;
  consumedEnd: number;
  shouldBreak: boolean;
}

export function resolveOptionalElseBlock(
  lines: string[],
  thenBlock: CollectedBlock,
  lineNo: number,
  cleanLength: number,
  diagnostics: Diagnostic[]
): ResolvedElseBlock {
  let hasElse = false;
  let elseBlock: CollectedBlock | null = null;
  let consumedEnd = thenBlock.endIndex ?? 0;

  if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
    hasElse = true;
    elseBlock = collectBlockAfterOpenFromSource(lines, thenBlock.endIndex! + 1);
    if (elseBlock.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanLength),
        'Unterminated else block.',
        'Add a closing brace for else { ... }.'
      ));
      return { hasElse, elseBlock, consumedEnd, shouldBreak: true };
    }
    consumedEnd = elseBlock.endIndex;
  } else {
    const maybeElseIndex = thenBlock.endIndex! + 1;
    if (maybeElseIndex < lines.length && isElseOpenLine(stripLineComment(lines[maybeElseIndex]).trim())) {
      hasElse = true;
      elseBlock = collectBlockFromSource(lines, maybeElseIndex);
      if (elseBlock.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(maybeElseIndex + 1, 1, cleanLength),
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
