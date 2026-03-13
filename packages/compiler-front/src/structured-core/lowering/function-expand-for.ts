import { ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import { parseForHeader } from './control-flow.js';
import { parseInstruction } from './instructions.js';
import { collectBlockFromEntries } from '../parser-utils/blocks.js';
import { expandForLoopIntoKernel } from './for-expand.js';
import {
  cloneCycle,
  cycleHasControlFlow,
  makeControlCycle
} from './function-expand-helpers.js';
import {
  FunctionExpandStepInput,
  FunctionExpandStepResult
} from './function-expand-types.js';
import { INTERPOLATED_IDENT, RESERVED_KEYWORDS } from '../constants.js';

function stripLabelPrefix(clean: string): { label: string; rest: string } | null {
  const match = clean.match(new RegExp(`^(${INTERPOLATED_IDENT})\\s*:\\s*(.+)$`));
  if (!match) return null;
  const keyword = match[1].toLowerCase();
  if (RESERVED_KEYWORDS.has(keyword)) return null;
  if (match[2].startsWith(':')) return null;
  return { label: match[1], rest: match[2] };
}

export function tryExpandForStatement(input: FunctionExpandStepInput): FunctionExpandStepResult {
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
    expandBody,
    expansionContext
  } = input;

  const labelResult = stripLabelPrefix(clean);
  const toParse = labelResult ? labelResult.rest : clean;
  const forHeader = parseForHeader(toParse, entry.lineNo, constants, new Map(), diagnostics);
  if (!forHeader) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  const loopBlock = collectBlockFromEntries(body, index);
  if (loopBlock.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      'Unterminated for block.',
      'Add a closing brace for for { ... }.'
    ));
    return { handled: true, nextIndex: index, shouldBreak: true };
  }

  const prevCycleCount = kernel.cycles.length;
  const prevPragmaCount = kernel.pragmas.length;
  expandForLoopIntoKernel(
    forHeader,
    labelResult?.label,
    loopBlock.body,
    entry.lineNo,
    toParse.length,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    {
      cycleHasControlFlow,
      cloneCycle,
      parseInstruction,
      makeControlCycle,
      expandFunctionBodyIntoKernel: expandBody
    },
    expansionContext,
    input.loopControlStack
  );

  if (labelResult) {
    if (kernel.cycles.length > prevCycleCount) {
      kernel.cycles[prevCycleCount].label = labelResult.label;
    } else if (kernel.pragmas.length > prevPragmaCount) {
      kernel.pragmas[prevPragmaCount].label = labelResult.label;
    } else {
      kernel.cycles.push({
        index: cycleCounter.value++,
        label: labelResult.label,
        statements: [],
        span: spanAt(entry.lineNo, 1, toParse.length)
      });
    }
  }

  return { handled: true, nextIndex: loopBlock.endIndex, shouldBreak: false };
}
