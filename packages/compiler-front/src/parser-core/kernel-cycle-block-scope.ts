import { CycleAst, Diagnostic, KernelAst } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import {
  expandLoopBody,
  parseInlineCycleStatements,
  parseLabeledCycleLine
} from './cycle-expand.js';
import { collectBlockFromSource } from '../parser-utils/blocks.js';

export interface ConsumeKernelCycleBlockInput {
  lines: string[];
  index: number;
  lineNo: number;
  clean: string;
  kernel: KernelAst | null;
  kernelConstants: Map<string, number>;
  diagnostics: Diagnostic[];
  cycleIndex: number;
}

export interface ConsumeKernelCycleBlockResult {
  handled: boolean;
  nextIndex: number;
  cycleIndex: number;
  enterCycle: boolean;
  currentCycle: CycleAst | null;
  cycleConstants: Map<string, number>;
  shouldBreak: boolean;
}

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
  let cycleIndex = input.cycleIndex;

  const keep = (): ConsumeKernelCycleBlockResult => ({
    handled: false,
    nextIndex: index,
    cycleIndex,
    enterCycle: false,
    currentCycle: null,
    cycleConstants: new Map(),
    shouldBreak: false
  });

  const inlineCycleMatch = clean.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
  if (inlineCycleMatch && kernel) {
    const statements = parseInlineCycleStatements(
      inlineCycleMatch[1],
      lineNo,
      kernelConstants,
      diagnostics
    );
    kernel.cycles.push({
      index: cycleIndex++,
      statements,
      span: spanAt(lineNo, 1, clean.length)
    });
    return {
      handled: true,
      nextIndex: index,
      cycleIndex,
      enterCycle: false,
      currentCycle: null,
      cycleConstants: new Map(),
      shouldBreak: false
    };
  }

  const labeledCycle = parseLabeledCycleLine(clean);
  if (labeledCycle && labeledCycle.inlinePayload !== undefined && kernel) {
    kernel.cycles.push({
      index: cycleIndex++,
      label: labeledCycle.label,
      statements: parseInlineCycleStatements(labeledCycle.inlinePayload, lineNo, kernelConstants, diagnostics),
      span: spanAt(lineNo, 1, clean.length)
    });
    return {
      handled: true,
      nextIndex: index,
      cycleIndex,
      enterCycle: false,
      currentCycle: null,
      cycleConstants: new Map(),
      shouldBreak: false
    };
  }

  if (labeledCycle && kernel) {
    const block = collectBlockFromSource(lines, index);
    if (block.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        `Unterminated labeled cycle '${labeledCycle.label}'.`,
        'Add a closing brace for cycle { ... }.'
      ));
      return {
        handled: true,
        nextIndex: index,
        cycleIndex,
        enterCycle: false,
        currentCycle: null,
        cycleConstants: new Map(),
        shouldBreak: true
      };
    }

    kernel.cycles.push({
      index: cycleIndex++,
      label: labeledCycle.label,
      statements: expandLoopBody(block.body, kernelConstants, new Map(), diagnostics),
      span: spanAt(lineNo, 1, clean.length)
    });
    return {
      handled: true,
      nextIndex: block.endIndex,
      cycleIndex,
      enterCycle: false,
      currentCycle: null,
      cycleConstants: new Map(),
      shouldBreak: false
    };
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

  return keep();
}
