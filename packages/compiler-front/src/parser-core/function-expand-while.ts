import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import {
  buildFalseBranchInstruction,
  parseControlHeader
} from './control-flow.js';
import {
  buildWhileFusionPlan,
  cloneCycle,
  makeControlCycle,
  rewriteConditionForWhileFusion
} from './function-expand-helpers.js';
import { parseInstruction } from './instructions.js';
import { collectBlockFromEntries } from '../parser-utils/blocks.js';
import {
  ExpandControlBaseInput,
  ExpandControlFlowResult
} from './function-expand-control-types.js';

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
    expandBody
  } = input;

  const whileHeader = parseControlHeader(clean, 'while', entry.lineNo, constants, diagnostics);
  if (!whileHeader) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  const disableFuse = false;
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
    controlFlowCounter
  );

  const fusionPlan = !disableFuse
    ? buildWhileFusionPlan(loopKernel.cycles, whileHeader.row, whileHeader.col)
    : null;
  const branchCondition = fusionPlan
    ? rewriteConditionForWhileFusion(whileHeader.condition, fusionPlan.incomingRegister)
    : whileHeader.condition;

  kernel.cycles.push(makeControlCycle(
    cycleCounter.value++,
    entry.lineNo,
    whileHeader.row,
    whileHeader.col,
    buildFalseBranchInstruction(branchCondition, endLabel),
    startLabel
  ));

  for (const cycle of loopKernel.cycles) {
    kernel.cycles.push(cloneCycle(cycle, cycleCounter.value++));
  }

  let fusedBackEdge = false;
  if (fusionPlan) {
    const jumpText = `JUMP ${startLabel}, ZERO`;
    kernel.cycles[kernel.cycles.length - 1].statements.push({
      kind: 'at',
      row: whileHeader.row,
      col: whileHeader.col,
      instruction: parseInstruction(jumpText, entry.lineNo, 1),
      span: spanAt(entry.lineNo, 1, jumpText.length)
    });
    fusedBackEdge = true;
  }

  if (!fusedBackEdge) {
    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      entry.lineNo,
      whileHeader.row,
      whileHeader.col,
      `JUMP ${startLabel}, ZERO`
    ));
  }

  kernel.cycles.push(makeControlCycle(
    cycleCounter.value++,
    entry.lineNo,
    whileHeader.row,
    whileHeader.col,
    'NOP',
    endLabel
  ));

  return { handled: true, nextIndex: loopBlock.endIndex, shouldBreak: false };
}
