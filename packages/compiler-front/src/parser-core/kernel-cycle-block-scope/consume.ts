import { spanAt } from '@openedge/compiler-ir';
import {
  parseLabeledCycleLine
} from '../cycle-expand.js';
import {
  ConsumeKernelCycleBlockInput,
  ConsumeKernelCycleBlockResult
} from './types.js';
import { tryConsumeInlineCycle } from './inline.js';
import { tryConsumeLabeledCycleBlock } from './labeled-block.js';

export function consumeKernelCycleBlockStatement(
  input: ConsumeKernelCycleBlockInput
): ConsumeKernelCycleBlockResult {
  const {
    lines,
    index,
    lineNo,
    clean,
    kernel,
    kernelConstants,
    diagnostics
  } = input;
  const cycleIndex = input.cycleIndex;

  const inlineResult = tryConsumeInlineCycle(
    clean,
    lineNo,
    index,
    cycleIndex,
    kernel,
    kernelConstants,
    diagnostics
  );
  if (inlineResult) return inlineResult;

  const labeledCycle = parseLabeledCycleLine(clean);
  if (labeledCycle && labeledCycle.inlinePayload === undefined) {
    const labeledResult = tryConsumeLabeledCycleBlock(
      lines,
      index,
      lineNo,
      clean,
      cycleIndex,
      labeledCycle.label,
      kernel,
      kernelConstants,
      diagnostics
    );
    if (labeledResult) return labeledResult;
  }

  if (/^cycle\s*\{\s*$/i.test(clean)) {
    return {
      handled: true,
      nextIndex: index,
      cycleIndex: cycleIndex + 1,
      enterCycle: true,
      currentCycle: {
        index: cycleIndex,
        statements: [],
        span: spanAt(lineNo, 1, clean.length)
      },
      cycleConstants: new Map(kernelConstants),
      shouldBreak: false
    };
  }

  return {
    handled: false,
    nextIndex: index,
    cycleIndex,
    enterCycle: false,
    currentCycle: null,
    cycleConstants: new Map(),
    shouldBreak: false
  };
}
