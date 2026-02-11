import {
  ConsumeTopLevelScopeInput,
  ConsumeTopLevelScopeResult
} from './types.js';
import { createTopLevelScopeResultFactory } from './result.js';
import {
  consumeFunctionDefinitionStep,
  consumeKernelDeclarationStep,
  consumeLegacyPragmaStep,
  consumeTargetStep,
  consumeTopDirectiveStep,
  createTopLevelScopeWorkingState,
  reportUnexpectedTopLevelStatement
} from './steps.js';

export function consumeTopLevelScopeStatement(input: ConsumeTopLevelScopeInput): ConsumeTopLevelScopeResult {
  const state = createTopLevelScopeWorkingState(input);
  const keep = createTopLevelScopeResultFactory(input, state);

  if (consumeLegacyPragmaStep(input)) {
    return keep();
  }

  const functionStep = consumeFunctionDefinitionStep(input, state);
  if (functionStep.handled) {
    return keep(
      functionStep.nextIndex,
      functionStep.inKernel ?? false,
      functionStep.shouldBreak ?? false
    );
  }

  if (consumeTargetStep(input)) {
    return keep();
  }

  const kernelStep = consumeKernelDeclarationStep(input, state);
  if (kernelStep.handled) {
    return keep(
      kernelStep.nextIndex,
      kernelStep.inKernel ?? false,
      kernelStep.shouldBreak ?? false
    );
  }

  const directiveStep = consumeTopDirectiveStep(input, state);
  if (directiveStep.handled) {
    return keep(
      directiveStep.nextIndex,
      directiveStep.inKernel ?? false,
      directiveStep.shouldBreak ?? false
    );
  }

  reportUnexpectedTopLevelStatement(input);
  return keep();
}
