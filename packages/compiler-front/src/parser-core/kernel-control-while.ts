import { KernelAst } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { buildFalseBranchInstruction, parseControlHeader } from './control-flow.js';
import {
  buildWhileFusionPlan,
  cloneCycle,
  expandFunctionBodyIntoKernel,
  makeControlCycle,
  rewriteConditionForWhileFusion
} from './function-expand.js';
import { parseInstruction } from './instructions.js';
import { collectBlockFromSource } from '../parser-utils/blocks.js';
import {
  ConsumeKernelControlFlowInput,
  ConsumeKernelControlFlowResult
} from './kernel-control-flow-types.js';

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
  const loopKernel: KernelAst = {
    name: '__while_body__',
    config: undefined,
    cycles: [],
    directives: [],
    pragmas: [],
    span: spanAt(lineNo, 1, clean.length)
  };
  const loopCounter = { value: 0 };
  expandFunctionBodyIntoKernel(
    loopBlock.body,
    loopKernel,
    functions,
    kernelConstants,
    diagnostics,
    loopCounter,
    [],
    functionExpansionCounter,
    controlFlowCounter
  );

  const fusionPlan = !disableFuse
    ? buildWhileFusionPlan(loopKernel.cycles, whileHeader.row, whileHeader.col)
    : null;
  const branchCondition = fusionPlan
    ? rewriteConditionForWhileFusion(whileHeader.condition, fusionPlan.incomingRegister)
    : whileHeader.condition;

  kernel.cycles.push(makeControlCycle(
    cycleIndex++,
    lineNo,
    whileHeader.row,
    whileHeader.col,
    buildFalseBranchInstruction(branchCondition, endLabel),
    startLabel
  ));

  for (const cycle of loopKernel.cycles) {
    kernel.cycles.push(cloneCycle(cycle, cycleIndex++));
  }

  let fusedBackEdge = false;
  if (fusionPlan) {
    const jumpText = `JUMP ${startLabel}, ZERO`;
    kernel.cycles[kernel.cycles.length - 1].statements.push({
      kind: 'at',
      row: whileHeader.row,
      col: whileHeader.col,
      instruction: parseInstruction(jumpText, lineNo, 1),
      span: spanAt(lineNo, 1, jumpText.length)
    });
    fusedBackEdge = true;
  }

  if (!fusedBackEdge) {
    kernel.cycles.push(makeControlCycle(
      cycleIndex++,
      lineNo,
      whileHeader.row,
      whileHeader.col,
      `JUMP ${startLabel}, ZERO`
    ));
  }

  kernel.cycles.push(makeControlCycle(
    cycleIndex++,
    lineNo,
    whileHeader.row,
    whileHeader.col,
    'NOP',
    endLabel
  ));

  return { handled: true, nextIndex: loopBlock.endIndex, cycleIndex, shouldBreak: false };
}
