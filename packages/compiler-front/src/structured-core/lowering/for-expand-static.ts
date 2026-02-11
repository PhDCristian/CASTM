import {
  CycleAst,
  Diagnostic,
  KernelAst,
  spanAt
} from '@openedge/compiler-ir';
import type { ForHeader } from './control-flow.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';
import {
  enumerateForValues,
  instantiateEntriesWithBindings
} from './for-expand-helpers.js';
import type { ExpandForCallbacks, FunctionDefinitionLike } from './for-expand-types.js';

interface ExpandStaticForInput {
  header: ForHeader;
  loopBody: SourceLineEntry[];
  lineNo: number;
  lineLength: number;
  kernel: KernelAst;
  functions: ReadonlyMap<string, FunctionDefinitionLike>;
  constants: ReadonlyMap<string, number>;
  diagnostics: Diagnostic[];
  cycleCounter: { value: number };
  callStack: string[];
  expansionCounter: { value: number };
  controlFlowCounter: { value: number };
  callbacks: ExpandForCallbacks;
}

export function expandStaticForLoop(input: ExpandStaticForInput): void {
  const {
    header,
    loopBody,
    lineNo,
    lineLength,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    callbacks
  } = input;
  const values = enumerateForValues(header, lineNo, lineLength, diagnostics);
  if (!values) return;

  const perIterationCycles: CycleAst[][] = [];
  for (const value of values) {
    const bindings = new Map<string, number>();
    bindings.set(header.variable, value);
    const instantiated = instantiateEntriesWithBindings(loopBody, bindings);

    const tmpKernel: KernelAst = {
      name: '__for_iter__',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: spanAt(lineNo, 1, lineLength)
    };
    const tmpCounter = { value: 0 };
    callbacks.expandFunctionBodyIntoKernel(
      instantiated,
      tmpKernel,
      functions,
      constants,
      diagnostics,
      tmpCounter,
      callStack,
      expansionCounter,
      controlFlowCounter
    );
    perIterationCycles.push(tmpKernel.cycles);
  }

  for (const iterCycles of perIterationCycles) {
    for (const cycle of iterCycles) {
      kernel.cycles.push(callbacks.cloneCycle(cycle, cycleCounter.value++));
    }
  }
}
