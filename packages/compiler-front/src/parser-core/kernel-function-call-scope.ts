import { Diagnostic, KernelAst } from '@openedge/compiler-ir';
import { FunctionDefinitionLike } from './for-expand.js';
import { expandFunctionBodyIntoKernel, instantiateFunctionBody } from './function-expand.js';
import { parseFunctionCallLine } from './functions.js';

export interface ConsumeKernelFunctionCallInput {
  lineNo: number;
  clean: string;
  kernel: KernelAst | null;
  functions: ReadonlyMap<string, FunctionDefinitionLike>;
  kernelConstants: Map<string, number>;
  diagnostics: Diagnostic[];
  cycleIndex: number;
  functionExpansionCounter: { value: number };
  controlFlowCounter: { value: number };
}

export interface ConsumeKernelFunctionCallResult {
  handled: boolean;
  cycleIndex: number;
}

export function consumeKernelFunctionCallStatement(
  input: ConsumeKernelFunctionCallInput
): ConsumeKernelFunctionCallResult {
  const {
    lineNo,
    clean,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    functionExpansionCounter,
    controlFlowCounter
  } = input;
  let cycleIndex = input.cycleIndex;

  const functionCall = parseFunctionCallLine(clean);
  if (!(functionCall && functions.has(functionCall.name) && kernel)) {
    return { handled: false, cycleIndex };
  }

  const def = functions.get(functionCall.name)!;
  const instantiated = instantiateFunctionBody(def, functionCall.args, lineNo, diagnostics, functionExpansionCounter);
  if (instantiated) {
    const cycleCounter = { value: cycleIndex };
    expandFunctionBodyIntoKernel(
      instantiated,
      kernel,
      functions,
      kernelConstants,
      diagnostics,
      cycleCounter,
      [functionCall.name],
      functionExpansionCounter,
      controlFlowCounter
    );
    cycleIndex = cycleCounter.value;
  }

  return { handled: true, cycleIndex };
}
