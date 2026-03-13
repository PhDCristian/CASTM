import {
  CycleAst,
  ErrorCodes,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import {
  expandLoopBody,
  parseInlineCycleStatements,
  parseLabeledCycleLine
} from './cycle-expand.js';
import { collectBlockFromEntries } from '../parser-utils/blocks.js';
import {
  FunctionExpandStepInput,
  FunctionExpandStepResult
} from './function-expand-types.js';

export function tryExpandCycleStatement(input: FunctionExpandStepInput): FunctionExpandStepResult {
  const {
    body,
    index,
    entry,
    clean,
    kernel,
    constants,
    diagnostics,
    cycleCounter
  } = input;

  const labeledCycle = parseLabeledCycleLine(clean);
  if (labeledCycle && labeledCycle.inlinePayload !== undefined) {
    const cycle: CycleAst = {
      index: cycleCounter.value++,
      label: labeledCycle.label,
      statements: parseInlineCycleStatements(labeledCycle.inlinePayload, entry.lineNo, constants, diagnostics),
      span: spanAt(entry.lineNo, 1, clean.length)
    };
    kernel.cycles.push(cycle);
    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  if (labeledCycle) {
    const block = collectBlockFromEntries(body, index);
    if (block.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        `Unterminated labeled bundle '${labeledCycle.label}' inside function body.`,
        'Add a closing brace for bundle { ... }.'
      ));
      return { handled: true, nextIndex: index, shouldBreak: true };
    }

    kernel.cycles.push({
      index: cycleCounter.value++,
      label: labeledCycle.label,
      statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
      span: spanAt(entry.lineNo, 1, clean.length)
    });
    return { handled: true, nextIndex: block.endIndex, shouldBreak: false };
  }

  const inlineCycleMatch = clean.match(/^(?:cycle|bundle)\s*\{\s*(.+)\s*\}\s*$/i);
  if (inlineCycleMatch) {
    const cycle: CycleAst = {
      index: cycleCounter.value++,
      statements: parseInlineCycleStatements(inlineCycleMatch[1], entry.lineNo, constants, diagnostics),
      span: spanAt(entry.lineNo, 1, clean.length)
    };
    kernel.cycles.push(cycle);
    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  if (!/^(?:cycle|bundle)\s*\{\s*$/i.test(clean)) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  const block = collectBlockFromEntries(body, index);
  if (block.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      'Unterminated bundle block inside function body.',
      'Add a closing brace for bundle { ... }.'
    ));
    return { handled: true, nextIndex: index, shouldBreak: true };
  }

  kernel.cycles.push({
    index: cycleCounter.value++,
    statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
    span: spanAt(entry.lineNo, 1, clean.length)
  });
  return { handled: true, nextIndex: block.endIndex, shouldBreak: false };
}
