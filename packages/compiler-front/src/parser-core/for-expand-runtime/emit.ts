import { spanAt } from '@openedge/compiler-ir';
import {
  buildRuntimeNoUnrollExitBranch,
  chooseJumpColumn
} from '../for-expand-helpers.js';
import {
  ExpandRuntimeForInput,
  RuntimeLoopPlan
} from './types.js';

export function emitRuntimeLoopCycles(input: ExpandRuntimeForInput, plan: RuntimeLoopPlan): void {
  const {
    header,
    lineNo,
    lineLength,
    kernel,
    cycleCounter,
    callbacks
  } = input;
  const {
    controlRow,
    controlCol,
    startLabel,
    endLabel,
    loopKernel,
    aggressivePlan
  } = plan;

  kernel.cycles.push(callbacks.makeControlCycle(
    cycleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    `SADD ${header.variable}, ZERO, IMM(${header.start})`
  ));

  kernel.cycles.push(callbacks.makeControlCycle(
    cycleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    buildRuntimeNoUnrollExitBranch(header.variable, header.end, endLabel, header.step),
    startLabel
  ));

  if (aggressivePlan) {
    const conditionCycle = kernel.cycles[kernel.cycles.length - 1];
    conditionCycle.statements.push({
      kind: 'at',
      row: aggressivePlan.bodyRow,
      col: aggressivePlan.bodyCol,
      instruction: callbacks.parseInstruction(
        `SADD ${aggressivePlan.relayRegister}, ${aggressivePlan.incomingRegister}, ZERO`,
        lineNo,
        1
      ),
      span: spanAt(lineNo, 1, lineLength)
    });

    const jumpCol = chooseJumpColumn(controlCol, aggressivePlan.bodyCol);
    kernel.cycles.push({
      index: cycleCounter.value++,
      statements: [
        {
          kind: 'at',
          row: aggressivePlan.bodyRow,
          col: aggressivePlan.bodyCol,
          instruction: aggressivePlan.bodyInstruction,
          span: spanAt(lineNo, 1, lineLength)
        },
        {
          kind: 'at',
          row: controlRow,
          col: controlCol,
          instruction: callbacks.parseInstruction(
            `SADD ${header.variable}, ${header.variable}, IMM(${header.step})`,
            lineNo,
            1
          ),
          span: spanAt(lineNo, 1, lineLength)
        },
        {
          kind: 'at',
          row: controlRow,
          col: jumpCol,
          instruction: callbacks.parseInstruction(`JUMP ${startLabel}, ZERO`, lineNo, 1),
          span: spanAt(lineNo, 1, lineLength)
        }
      ],
      span: spanAt(lineNo, 1, lineLength)
    });
  } else {
    for (const cycle of loopKernel.cycles) {
      kernel.cycles.push(callbacks.cloneCycle(cycle, cycleCounter.value++));
    }

    const jumpCol = chooseJumpColumn(controlCol);
    kernel.cycles.push({
      index: cycleCounter.value++,
      statements: [
        {
          kind: 'at',
          row: controlRow,
          col: controlCol,
          instruction: callbacks.parseInstruction(
            `SADD ${header.variable}, ${header.variable}, IMM(${header.step})`,
            lineNo,
            1
          ),
          span: spanAt(lineNo, 1, lineLength)
        },
        {
          kind: 'at',
          row: controlRow,
          col: jumpCol,
          instruction: callbacks.parseInstruction(`JUMP ${startLabel}, ZERO`, lineNo, 1),
          span: spanAt(lineNo, 1, lineLength)
        }
      ],
      span: spanAt(lineNo, 1, lineLength)
    });
  }

  kernel.cycles.push(callbacks.makeControlCycle(
    cycleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    'NOP',
    endLabel
  ));
}
