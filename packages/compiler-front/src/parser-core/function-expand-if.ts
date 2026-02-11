import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import {
  buildFalseBranchInstruction,
  parseControlHeader
} from './control-flow.js';
import { makeControlCycle } from './function-expand-helpers.js';
import {
  CollectedBlock,
  collectBlockAfterOpenFromEntries,
  collectBlockFromEntries
} from '../parser-utils/blocks.js';
import { isElseOpenLine } from './cycle-expand.js';
import {
  ExpandControlBaseInput,
  ExpandControlFlowResult
} from './function-expand-control-types.js';

export function tryExpandIfStatement(input: ExpandControlBaseInput): ExpandControlFlowResult {
  const {
    body,
    index,
    entry,
    clean,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    expandBody
  } = input;

  const ifHeader = parseControlHeader(clean, 'if', entry.lineNo, constants, diagnostics);
  if (!ifHeader) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  const thenBlock = collectBlockFromEntries(body, index);
  if (thenBlock.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      'Unterminated if block.',
      'Add a closing brace for if { ... }.'
    ));
    return { handled: true, nextIndex: index, shouldBreak: true };
  }

  const suffixId = controlFlowCounter.value++;
  const elseLabel = `__if_else_${suffixId}`;
  const endLabel = `__if_end_${suffixId}`;

  let hasElse = false;
  let elseBlock: CollectedBlock | null = null;
  let consumedEnd = thenBlock.endIndex;

  if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
    hasElse = true;
    elseBlock = collectBlockAfterOpenFromEntries(body, thenBlock.endIndex + 1);
    if (elseBlock.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        'Unterminated else block.',
        'Add a closing brace for else { ... }.'
      ));
      return { handled: true, nextIndex: index, shouldBreak: true };
    }
    consumedEnd = elseBlock.endIndex;
  } else {
    const maybeElseIndex = thenBlock.endIndex + 1;
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
        return { handled: true, nextIndex: index, shouldBreak: true };
      }
      consumedEnd = elseBlock.endIndex;
    }
  }

  const falseTarget = hasElse ? elseLabel : endLabel;
  kernel.cycles.push(makeControlCycle(
    cycleCounter.value++,
    entry.lineNo,
    ifHeader.row,
    ifHeader.col,
    buildFalseBranchInstruction(ifHeader.condition, falseTarget)
  ));

  expandBody(
    thenBlock.body,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    callStack,
    expansionCounter,
    controlFlowCounter
  );

  if (hasElse && elseBlock) {
    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      entry.lineNo,
      ifHeader.row,
      ifHeader.col,
      `JUMP ${endLabel}, ZERO`
    ));

    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      entry.lineNo,
      ifHeader.row,
      ifHeader.col,
      'NOP',
      elseLabel
    ));

    expandBody(
      elseBlock.body,
      kernel,
      functions,
      constants,
      diagnostics,
      cycleCounter,
      callStack,
      expansionCounter,
      controlFlowCounter
    );
  }

  kernel.cycles.push(makeControlCycle(
    cycleCounter.value++,
    entry.lineNo,
    ifHeader.row,
    ifHeader.col,
    'NOP',
    endLabel
  ));

  return { handled: true, nextIndex: consumedEnd, shouldBreak: false };
}
