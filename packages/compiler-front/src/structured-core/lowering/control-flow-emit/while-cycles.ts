import { CycleAst, KernelAst, spanAt } from '@castm/compiler-ir';
import type { ParsedCondition } from '../control-flow.js';
import {
  cloneCycle,
  makeControlCycle
} from '../function-expand-helpers.js';
import { buildFalseBranchInstruction } from '../control-flow.js';
import { parseInstruction } from '../instructions.js';

interface WhileFusionPlanLike {
  bodyRow: number;
  bodyCol: number;
  incomingRegister: string;
}

interface EmitWhileCyclesInput {
  kernel: KernelAst;
  cycleIndex: number;
  lineNo: number;
  row: number;
  col: number;
  condition: ParsedCondition;
  startLabel: string;
  endLabel: string;
  loopCycles: CycleAst[];
  fusionPlan: WhileFusionPlanLike | null;
}

export function emitWhileControlFlowCycles(input: EmitWhileCyclesInput): number {
  const {
    kernel,
    lineNo,
    row,
    col,
    condition,
    startLabel,
    endLabel,
    loopCycles,
    fusionPlan
  } = input;
  let cycleIndex = input.cycleIndex;

  kernel.cycles.push(makeControlCycle(
    cycleIndex++,
    lineNo,
    row,
    col,
    buildFalseBranchInstruction(condition, endLabel),
    startLabel
  ));

  for (const cycle of loopCycles) {
    kernel.cycles.push(cloneCycle(cycle, cycleIndex++));
  }

  let fusedBackEdge = false;
  if (fusionPlan) {
    const jumpText = `JUMP ZERO, ${startLabel}`;
    kernel.cycles[kernel.cycles.length - 1].statements.push({
      kind: 'at',
      row,
      col,
      instruction: parseInstruction(jumpText, lineNo, 1),
      span: spanAt(lineNo, 1, jumpText.length)
    });
    fusedBackEdge = true;
  }

  if (!fusedBackEdge) {
    kernel.cycles.push(makeControlCycle(
      cycleIndex++,
      lineNo,
      row,
      col,
      `JUMP ZERO, ${startLabel}`
    ));
  }

  kernel.cycles.push(makeControlCycle(
    cycleIndex++,
    lineNo,
    row,
    col,
    'NOP',
    endLabel
  ));

  return cycleIndex;
}
