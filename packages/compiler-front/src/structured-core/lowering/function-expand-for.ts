import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
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

  const forHeader = parseForHeader(clean, entry.lineNo, constants, new Map(), diagnostics);
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

  expandForLoopIntoKernel(
    forHeader,
    loopBlock.body,
    entry.lineNo,
    clean.length,
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
    expansionContext
  );

  return { handled: true, nextIndex: loopBlock.endIndex, shouldBreak: false };
}
