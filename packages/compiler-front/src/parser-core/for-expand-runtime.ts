import {
  Diagnostic,
  ErrorCodes,
  KernelAst,
  makeDiagnostic,
  spanAt
} from '@openedge/compiler-ir';
import type { ForHeader } from './control-flow.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';
import {
  buildRuntimeNoUnrollAggressivePlan,
  buildRuntimeNoUnrollExitBranch,
  chooseJumpColumn
} from './for-expand-helpers.js';
import type { ExpandForCallbacks, FunctionDefinitionLike } from './for-expand-types.js';

interface ExpandRuntimeForInput {
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

export function expandRuntimeForLoop(input: ExpandRuntimeForInput): boolean {
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

  if (header.runtime !== true) return false;

  if (!/^R\d+$/i.test(header.variable)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, lineLength),
      `Runtime for-loop requires a register loop variable, got '${header.variable}'.`,
      'Use for R0 in range(...) at @r,c runtime { ... }, for R1..., etc.'
    ));
    return true;
  }

  const controlRow = header.control?.row ?? 0;
  const controlCol = header.control?.col ?? 0;
  const suffix = controlFlowCounter.value++;
  const startLabel = `__for_start_${suffix}`;
  const endLabel = `__for_end_${suffix}`;
  const loopKernel: KernelAst = {
    name: '__for_runtime_body__',
    config: undefined,
    cycles: [],
    directives: [],
    pragmas: [],
    span: spanAt(lineNo, 1, lineLength)
  };
  const loopCounter = { value: 0 };
  callbacks.expandFunctionBodyIntoKernel(
    loopBody,
    loopKernel,
    functions,
    constants,
    diagnostics,
    loopCounter,
    callStack,
    expansionCounter,
    controlFlowCounter
  );
  const aggressivePlan = buildRuntimeNoUnrollAggressivePlan(
    loopKernel.cycles,
    header.variable,
    controlRow,
    controlCol,
    callbacks.cycleHasControlFlow,
    callbacks.parseInstruction
  );

  kernel.cycles.push(callbacks.makeControlCycle(
    cycleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    `SADD ${header.variable}, ZERO, IMM(${header.start})`
  ));

  kernel.cycles.push(callbacks.makeControlCycle(
    cycleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    buildRuntimeNoUnrollExitBranch(header.variable, header.end, endLabel, header.step),
    startLabel
  ));

  if (aggressivePlan) {
    const conditionCycle = kernel.cycles[kernel.cycles.length - 1];
    conditionCycle.statements.push({
      kind: 'at',
      row: aggressivePlan.bodyRow,
      col: aggressivePlan.bodyCol,
      instruction: callbacks.parseInstruction(
        `SADD ${aggressivePlan.relayRegister}, ${aggressivePlan.incomingRegister}, ZERO`,
        lineNo,
        1
      ),
      span: spanAt(lineNo, 1, lineLength)
    });

    const jumpCol = chooseJumpColumn(controlCol, aggressivePlan.bodyCol);
    kernel.cycles.push({
      index: cycleCounter.value++,
      statements: [
        {
          kind: 'at',
          row: aggressivePlan.bodyRow,
          col: aggressivePlan.bodyCol,
          instruction: aggressivePlan.bodyInstruction,
          span: spanAt(lineNo, 1, lineLength)
        },
        {
          kind: 'at',
          row: controlRow,
          col: controlCol,
          instruction: callbacks.parseInstruction(
            `SADD ${header.variable}, ${header.variable}, IMM(${header.step})`,
            lineNo,
            1
          ),
          span: spanAt(lineNo, 1, lineLength)
        },
        {
          kind: 'at',
          row: controlRow,
          col: jumpCol,
          instruction: callbacks.parseInstruction(`JUMP ${startLabel}, ZERO`, lineNo, 1),
          span: spanAt(lineNo, 1, lineLength)
        }
      ],
      span: spanAt(lineNo, 1, lineLength)
    });
  } else {
    for (const cycle of loopKernel.cycles) {
      kernel.cycles.push(callbacks.cloneCycle(cycle, cycleCounter.value++));
    }

    const jumpCol = chooseJumpColumn(controlCol);
    kernel.cycles.push({
      index: cycleCounter.value++,
      statements: [
        {
          kind: 'at',
          row: controlRow,
          col: controlCol,
          instruction: callbacks.parseInstruction(
            `SADD ${header.variable}, ${header.variable}, IMM(${header.step})`,
            lineNo,
            1
          ),
          span: spanAt(lineNo, 1, lineLength)
        },
        {
          kind: 'at',
          row: controlRow,
          col: jumpCol,
          instruction: callbacks.parseInstruction(`JUMP ${startLabel}, ZERO`, lineNo, 1),
          span: spanAt(lineNo, 1, lineLength)
        }
      ],
      span: spanAt(lineNo, 1, lineLength)
    });
  }

  kernel.cycles.push(callbacks.makeControlCycle(
    cycleCounter.value++,
    lineNo,
    controlRow,
    controlCol,
    'NOP',
    endLabel
  ));
  return true;
}
