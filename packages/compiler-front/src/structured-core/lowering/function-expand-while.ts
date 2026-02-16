import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import {
  parseControlHeader
} from './control-flow.js';
import {
  buildWhileFusionPlan,
  rewriteConditionForWhileFusion
} from './function-expand-helpers.js';
import { collectBlockFromEntries } from '../parser-utils/blocks.js';
import {
  ExpandControlBaseInput,
  ExpandControlFlowResult
} from './function-expand-control-types.js';
import { emitWhileControlFlowCycles } from './control-flow-emit/while-cycles.js';

export function tryExpandWhileStatement(input: ExpandControlBaseInput): ExpandControlFlowResult {
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

  const whileHeader = parseControlHeader(clean, 'while', entry.lineNo, constants, diagnostics);
  if (!whileHeader) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  const loopBlock = collectBlockFromEntries(body, index);
  if (loopBlock.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      'Unterminated while block.',
      'Add a closing brace for while { ... }.'
    ));
    return { handled: true, nextIndex: index, shouldBreak: true };
  }

  const suffixId = controlFlowCounter.value++;
  const startLabel = `__while_start_${suffixId}`;
  const endLabel = `__while_end_${suffixId}`;
  const loopKernel = {
    name: '__while_body__',
    config: undefined,
    cycles: [],
    directives: [],
    pragmas: [],
    span: spanAt(entry.lineNo, 1, clean.length)
  };
  const loopCounter = { value: 0 };
  expandBody(
    loopBlock.body,
    loopKernel,
    functions,
    constants,
    diagnostics,
    loopCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    expansionContext,
    false
  );

  const fusionPlan = buildWhileFusionPlan(loopKernel.cycles, whileHeader.row, whileHeader.col);
  const branchCondition = fusionPlan
    ? rewriteConditionForWhileFusion(whileHeader.condition, fusionPlan.incomingRegister)
    : whileHeader.condition;
  cycleCounter.value = emitWhileControlFlowCycles({
    kernel,
    cycleIndex: cycleCounter.value,
    lineNo: entry.lineNo,
    row: whileHeader.row,
    col: whileHeader.col,
    condition: branchCondition,
    startLabel,
    endLabel,
    loopCycles: loopKernel.cycles,
    fusionPlan
  });

  return { handled: true, nextIndex: loopBlock.endIndex, shouldBreak: false };
}
