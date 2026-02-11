import {
  AstProgram,
  CycleAst,
  Diagnostic,
  DirectiveAst,
  KernelAst
} from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import type { FunctionDefinitionLike } from './for-expand.js';

export interface ParserState {
  kernel: KernelAst | null;
  kernelConstants: Map<string, number>;
  inKernel: boolean;
  inCycle: boolean;
  currentCycle: CycleAst | null;
  cycleConstants: Map<string, number>;
  cycleIndex: number;
  functionExpansionCounter: { value: number };
  controlFlowCounter: { value: number };
  pendingDirectives: DirectiveAst[];
  functions: Map<string, FunctionDefinitionLike>;
}

export function createInitialParserState(): ParserState {
  return {
    kernel: null,
    kernelConstants: new Map<string, number>(),
    inKernel: false,
    inCycle: false,
    currentCycle: null,
    cycleConstants: new Map<string, number>(),
    cycleIndex: 0,
    functionExpansionCounter: { value: 0 },
    controlFlowCounter: { value: 0 },
    pendingDirectives: [],
    functions: new Map<string, FunctionDefinitionLike>()
  };
}

export function finalizeParserState(
  ast: AstProgram,
  lines: string[],
  state: ParserState,
  diagnostics: Diagnostic[]
): void {
  if (state.inCycle) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      'Unterminated cycle block.',
      'Add a closing brace for cycle { ... }.'
    ));
  }

  if (state.inKernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      'Unterminated kernel block.',
      'Add a closing brace for kernel { ... }.'
    ));
  }

  if (!ast.targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing required target declaration.',
      'Add: target "uma-cgra-base";'
    ));
  }

  if (!ast.kernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingKernel,
      'error',
      spanAt(1, 1, 1),
      'Missing kernel declaration.',
      'Add: kernel "Name" { ... }'
    ));
  }
}
