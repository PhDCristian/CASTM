import { spanAt } from '@castm/compiler-ir';
import {
  buildRuntimeNoUnrollExitBranch,
  chooseJumpColumn
} from '../for-expand-helpers.js';
import {
  ExpandRuntimeForInput,
  RuntimeLoopPlan
} from './types.js';

export function emitRuntimeLoopBundles(input: ExpandRuntimeForInput, plan: RuntimeLoopPlan): void {
  const {
    header,
    lineNo,
    lineLength,
    kernel,
    bundleCounter,
    callbacks
  } = input;
  const {
    controlRow,
    controlCol,
    startLabel,
    continueLabel,
    endLabel,
    loopKernel,
    aggressivePlan
  } = plan;

  kernel.bundles.push(callbacks.makeControlBundle(
    bundleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    `SADD ${header.variable}, ZERO, ${header.start}`
  ));

  kernel.bundles.push(callbacks.makeControlBundle(
    bundleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    buildRuntimeNoUnrollExitBranch(header.variable, header.end, endLabel, header.step),
    startLabel
  ));

  if (aggressivePlan) {
    const conditionBundle = kernel.bundles[kernel.bundles.length - 1];
    conditionBundle.statements.push({
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
    kernel.bundles.push({
      index: bundleCounter.value++,
      label: continueLabel,
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
            `SADD ${header.variable}, ${header.variable}, ${header.step}`,
            lineNo,
            1
          ),
          span: spanAt(lineNo, 1, lineLength)
        },
        {
          kind: 'at',
          row: controlRow,
          col: jumpCol,
          instruction: callbacks.parseInstruction(`JUMP ZERO, ${startLabel}`, lineNo, 1),
          span: spanAt(lineNo, 1, lineLength)
        }
      ],
      span: spanAt(lineNo, 1, lineLength)
    });
  } else {
    for (const bundle of loopKernel.bundles) {
      kernel.bundles.push(callbacks.cloneBundle(bundle, bundleCounter.value++));
    }

    const jumpCol = chooseJumpColumn(controlCol);
    kernel.bundles.push({
      index: bundleCounter.value++,
      label: continueLabel,
      statements: [
        {
          kind: 'at',
          row: controlRow,
          col: controlCol,
          instruction: callbacks.parseInstruction(
            `SADD ${header.variable}, ${header.variable}, ${header.step}`,
            lineNo,
            1
          ),
          span: spanAt(lineNo, 1, lineLength)
        },
        {
          kind: 'at',
          row: controlRow,
          col: jumpCol,
          instruction: callbacks.parseInstruction(`JUMP ZERO, ${startLabel}`, lineNo, 1),
          span: spanAt(lineNo, 1, lineLength)
        }
      ],
      span: spanAt(lineNo, 1, lineLength)
    });
  }

  kernel.bundles.push(callbacks.makeControlBundle(
    bundleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    'NOP',
    endLabel
  ));
}
