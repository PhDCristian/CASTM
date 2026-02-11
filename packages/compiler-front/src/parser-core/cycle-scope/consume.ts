import type {
  ConsumeCycleScopeInput,
  ConsumeCycleScopeResult
} from './types.js';
import { createCycleScopeResultFactory } from './result.js';
import {
  consumeCycleForLoopStep,
  consumeSingleCycleStatementStep,
  consumeSpatialAtBlockStep,
  createCycleScopeWorkingState
} from './steps.js';

export function consumeCycleScopeStatement(input: ConsumeCycleScopeInput): ConsumeCycleScopeResult {
  const state = createCycleScopeWorkingState(input);
  const keep = createCycleScopeResultFactory(input, state);

  const spatialStep = consumeSpatialAtBlockStep(input, state);
  if (spatialStep.handled) {
    return keep(spatialStep.nextIndex, spatialStep.shouldBreak ?? false);
  }

  const forStep = consumeCycleForLoopStep(input, state);
  if (forStep.handled) {
    return keep(forStep.nextIndex, forStep.shouldBreak ?? false);
  }

  const statementStep = consumeSingleCycleStatementStep(input, state);
  if (statementStep.handled) {
    return keep(statementStep.nextIndex, statementStep.shouldBreak ?? false);
  }

  return keep();
}
