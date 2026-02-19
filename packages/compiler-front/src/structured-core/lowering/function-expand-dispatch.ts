import {
  FunctionExpandStepInput,
  FunctionExpandStepResult
} from './function-expand-types.js';
import { tryExpandLoopControlStatement } from './function-expand-loop-control.js';
import { tryExpandForStatement } from './function-expand-for.js';
import {
  tryExpandIfStatement,
  tryExpandWhileStatement
} from './function-expand-control-flow.js';
import { tryExpandCycleStatement } from './function-expand-cycle.js';
import { tryExpandFunctionCall } from './function-expand-call.js';

const STEP_HANDLERS: Array<(input: FunctionExpandStepInput) => FunctionExpandStepResult> = [
  tryExpandLoopControlStatement,
  tryExpandForStatement,
  tryExpandIfStatement,
  tryExpandWhileStatement,
  tryExpandCycleStatement,
  tryExpandFunctionCall
];

export function tryExpandKnownFunctionStatement(input: FunctionExpandStepInput): FunctionExpandStepResult {
  for (const handle of STEP_HANDLERS) {
    const result = handle(input);
    if (result.handled) return result;
  }

  return {
    handled: false,
    nextIndex: input.index,
    shouldBreak: false
  };
}
