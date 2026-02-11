import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseControlHeader } from './control-flow.js';
import {
  buildWhileFusionPlan,
  rewriteConditionForWhileFusion
} from './function-expand.js';
import { collectBlockFromSource } from '../parser-utils/blocks.js';
import {
  ConsumeKernelControlFlowInput,
  ConsumeKernelControlFlowResult
} from './kernel-control-flow-types.js';
import { emitWhileControlFlowCycles } from './control-flow-emit/while-cycles.js';
import { expandControlBodyIntoKernel } from './kernel-control-utils.js';

export function consumeKernelWhileControlFlowStatement(
  input: ConsumeKernelControlFlowInput
): ConsumeKernelControlFlowResult {
  const {
    lines,
    index,
    lineNo,
    clean,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    functionExpansionCounter,
    controlFlowCounter
  } = input;
  let cycleIndex = input.cycleIndex;

  const whileHeader = parseControlHeader(clean, 'while', lineNo, kernelConstants, diagnostics);
  if (!(whileHeader && kernel)) {
    return { handled: false, nextIndex: index, cycleIndex, shouldBreak: false };
  }

  const disableFuse = false;

  const loopBlock = collectBlockFromSource(lines, index);
  if (loopBlock.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, clean.length),
      'Unterminated while block.',
      'Add a closing brace for while { ... }.'
    ));
    return { handled: true, nextIndex: index, cycleIndex, shouldBreak: true };
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
    span: spanAt(lineNo, 1, clean.length)
  };
  expandControlBodyIntoKernel(
    loopBlock.body,
    loopKernel,
    functions,
    kernelConstants,
    diagnostics,
    0,
    functionExpansionCounter,
    controlFlowCounter
  );

  const fusionPlan = !disableFuse
    ? buildWhileFusionPlan(loopKernel.cycles, whileHeader.row, whileHeader.col)
    : null;
  const branchCondition = fusionPlan
    ? rewriteConditionForWhileFusion(whileHeader.condition, fusionPlan.incomingRegister)
    : whileHeader.condition;

  cycleIndex = emitWhileControlFlowCycles({
    kernel,
    cycleIndex,
    lineNo,
    row: whileHeader.row,
    col: whileHeader.col,
    condition: branchCondition,
    startLabel,
    endLabel,
    loopCycles: loopKernel.cycles,
    fusionPlan
  });

  return { handled: true, nextIndex: loopBlock.endIndex, cycleIndex, shouldBreak: false };
}
