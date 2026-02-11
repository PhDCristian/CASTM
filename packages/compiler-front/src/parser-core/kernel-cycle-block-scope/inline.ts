import { Diagnostic, KernelAst, spanAt } from '@openedge/compiler-ir';
import {
  parseInlineCycleStatements,
  parseLabeledCycleLine
} from '../cycle-expand.js';
import {
  ConsumeKernelCycleBlockResult
} from './types.js';

export function tryConsumeInlineCycle(
  clean: string,
  lineNo: number,
  index: number,
  cycleIndex: number,
  kernel: KernelAst | null,
  kernelConstants: Map<string, number>,
  diagnostics: Diagnostic[]
): ConsumeKernelCycleBlockResult | null {
  const inlineCycleMatch = clean.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
  if (inlineCycleMatch && kernel) {
    const statements = parseInlineCycleStatements(
      inlineCycleMatch[1],
      lineNo,
      kernelConstants,
      diagnostics
    );
    kernel.cycles.push({
      index: cycleIndex,
      statements,
      span: spanAt(lineNo, 1, clean.length)
    });
    return {
      handled: true,
      nextIndex: index,
      cycleIndex: cycleIndex + 1,
      enterCycle: false,
      currentCycle: null,
      cycleConstants: new Map(),
      shouldBreak: false
    };
  }

  const labeledCycle = parseLabeledCycleLine(clean);
  if (labeledCycle && labeledCycle.inlinePayload !== undefined && kernel) {
    kernel.cycles.push({
      index: cycleIndex,
      label: labeledCycle.label,
      statements: parseInlineCycleStatements(labeledCycle.inlinePayload, lineNo, kernelConstants, diagnostics),
      span: spanAt(lineNo, 1, clean.length)
    });
    return {
      handled: true,
      nextIndex: index,
      cycleIndex: cycleIndex + 1,
      enterCycle: false,
      currentCycle: null,
      cycleConstants: new Map(),
      shouldBreak: false
    };
  }

  return null;
}
