import {
  Diagnostic,
  KernelAst
} from '@castm/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import {
  SourceLineEntry
} from '../parser-utils/blocks.js';
import {
  FunctionDefinitionLike
} from './for-expand.js';
import { consumeFunctionPreludeStatement } from './function-expand-prelude.js';
import { tryExpandKnownFunctionStatement } from './function-expand-dispatch.js';
import {
  FunctionExpansionContext,
  finalizeJumpReuseFunctions
} from './function-expand-context.js';
import type { LoopControlScope } from './loop-control-scope.js';

export {
  buildWhileFusionPlan,
  cloneCycle,
  cycleHasControlFlow,
  instantiateFunctionBody,
  makeCallCycle,
  makeControlCycle,
  rewriteConditionForWhileFusion
} from './function-expand-helpers.js';

export function expandFunctionBodyIntoKernel(
  body: SourceLineEntry[],
  kernel: KernelAst,
  functions: ReadonlyMap<string, FunctionDefinitionLike>,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  cycleCounter: { value: number },
  callStack: string[],
  expansionCounter: { value: number },
  controlFlowCounter: { value: number },
  expansionContext?: FunctionExpansionContext,
  isRoot: boolean = true,
  loopControlStack: LoopControlScope[] = []
): void {
  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    const clean = entry.cleanLine.trim();
    if (!clean) continue;

    if (consumeFunctionPreludeStatement(entry, clean, kernel, diagnostics)) {
      continue;
    }

    const result = tryExpandKnownFunctionStatement({
      body,
      index: i,
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
      expandBody: expandFunctionBodyIntoKernel,
      expansionContext,
      loopControlStack
    });
    if (result.handled) {
      if (result.shouldBreak) break;
      i = result.nextIndex;
      continue;
    }

    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      `Unsupported function body statement: '${clean}'.`,
      'Function bodies currently support advanced statements, for/while/if control-flow, cycle blocks, labeled cycles, loop control (break/continue), and function calls.'
    ));
  }

  if (isRoot && expansionContext) {
    finalizeJumpReuseFunctions({
      context: expansionContext,
      kernel,
      functions,
      constants,
      diagnostics,
      cycleCounter,
      expansionCounter,
      controlFlowCounter,
      expandBody: expandFunctionBodyIntoKernel,
      loopControlStack: []
    });
  }
}
