import { ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import {
  buildFalseBranchInstruction,
  parseControlHeader
} from './control-flow.js';
import { makeControlCycle } from './function-expand-helpers.js';
import {
  collectBlockFromEntries
} from '../parser-utils/blocks.js';
import {
  ExpandControlBaseInput,
  ExpandControlFlowResult
} from './function-expand-control-types.js';
import { resolveOptionalElseBlockInFunction } from './function-expand-if/else-resolution.js';
import { RESERVED_KEYWORDS } from '../constants.js';

function stripLabelPrefix(clean: string): { label: string; rest: string } | null {
  const match = clean.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
  if (!match) return null;
  const keyword = match[1].toLowerCase();
  if (RESERVED_KEYWORDS.has(keyword)) return null;
  if (match[2].startsWith(':')) return null;
  return { label: match[1], rest: match[2] };
}

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
    expandBody,
    expansionContext
  } = input;

  const labelResult = stripLabelPrefix(clean);
  const toParse = labelResult ? labelResult.rest : clean;
  const ifHeader = parseControlHeader(toParse, 'if', entry.lineNo, constants, diagnostics);
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

  const prevCycleCount = kernel.cycles.length;
  const prevPragmaCount = kernel.pragmas.length;
  const suffixId = controlFlowCounter.value++;
  const elseLabel = `__if_else_${suffixId}`;
  const endLabel = `__if_end_${suffixId}`;
  const resolvedElse = resolveOptionalElseBlockInFunction(body, thenBlock, entry.lineNo, clean.length, diagnostics);
  if (resolvedElse.shouldBreak) {
    return { handled: true, nextIndex: index, shouldBreak: true };
  }
  const hasElse = resolvedElse.hasElse;
  const elseBlock = resolvedElse.elseBlock;
  const consumedEnd = resolvedElse.consumedEnd;

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
    controlFlowCounter,
    expansionContext,
    false,
    input.loopControlStack
  );

  if (hasElse && elseBlock) {
    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      entry.lineNo,
      ifHeader.row,
      ifHeader.col,
      `JUMP ZERO, ${endLabel}`
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
      controlFlowCounter,
      expansionContext,
      false,
      input.loopControlStack
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

  if (labelResult) {
    // tryExpandIfStatement always emits at least one control cycle.
    if (kernel.cycles.length > prevCycleCount) {
      kernel.cycles[prevCycleCount].label = labelResult.label;
    }
  }

  return { handled: true, nextIndex: consumedEnd, shouldBreak: false };
}
