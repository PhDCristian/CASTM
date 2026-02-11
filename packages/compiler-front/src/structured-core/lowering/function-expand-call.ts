import {
  ErrorCodes,
  makeDiagnostic,
  spanAt
} from '@openedge/compiler-ir';
import { parseFunctionCallLine } from './functions.js';
import { instantiateFunctionBody } from './function-expand-helpers.js';
import {
  FunctionExpandStepInput,
  FunctionExpandStepResult
} from './function-expand-types.js';

export function tryExpandFunctionCall(input: FunctionExpandStepInput): FunctionExpandStepResult {
  const {
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
    expandBody
  } = input;

  const nestedCall = parseFunctionCallLine(clean);
  if (!nestedCall || !functions.has(nestedCall.name)) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  if (callStack.includes(nestedCall.name)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      `Recursive function call detected: ${[...callStack, nestedCall.name].join(' -> ')}.`,
      'Recursive function expansion is not supported.'
    ));
    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  const def = functions.get(nestedCall.name)!;
  const instantiated = instantiateFunctionBody(def, nestedCall.args, entry.lineNo, diagnostics, expansionCounter);
  if (!instantiated) {
    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  expandBody(
    instantiated,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    [...callStack, nestedCall.name],
    expansionCounter,
    controlFlowCounter
  );

  return { handled: true, nextIndex: index, shouldBreak: false };
}
