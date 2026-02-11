import {
  Diagnostic,
  KernelAst
} from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseAdvancedStatementAsPragma } from './statements.js';
import {
  SourceLineEntry
} from '../parser-utils/blocks.js';
import {
  FunctionDefinitionLike
} from './for-expand.js';
import {
  tryExpandIfStatement,
  tryExpandWhileStatement
} from './function-expand-control-flow.js';
import { tryExpandForStatement } from './function-expand-for.js';
import { tryExpandCycleStatement } from './function-expand-cycle.js';
import { tryExpandFunctionCall } from './function-expand-call.js';

export {
  buildWhileFusionPlan,
  cloneCycle,
  cycleHasControlFlow,
  instantiateFunctionBody,
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
  controlFlowCounter: { value: number }
): void {
  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    const clean = entry.cleanLine.trim();
    if (!clean) continue;

    if (/^#pragma\b/i.test(clean)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        `Legacy pragma syntax is not supported: '${clean}'.`,
        'Use canonical statements (for example route(...), reduce(...), scan(...)) and explicit control-flow syntax.'
      ));
      continue;
    }

    const advancedPragmaText = parseAdvancedStatementAsPragma(clean);
    if (advancedPragmaText) {
      kernel.pragmas.push({
        text: advancedPragmaText,
        span: spanAt(entry.lineNo, 1, clean.length)
      });
      continue;
    }

    const forResult = tryExpandForStatement({
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
      expandBody: expandFunctionBodyIntoKernel
    });
    if (forResult.handled) {
      if (forResult.shouldBreak) break;
      i = forResult.nextIndex;
      continue;
    }

    const ifResult = tryExpandIfStatement({
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
      expandBody: expandFunctionBodyIntoKernel
    });
    if (ifResult.handled) {
      if (ifResult.shouldBreak) break;
      i = ifResult.nextIndex;
      continue;
    }

    const whileResult = tryExpandWhileStatement({
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
      expandBody: expandFunctionBodyIntoKernel
    });
    if (whileResult.handled) {
      if (whileResult.shouldBreak) break;
      i = whileResult.nextIndex;
      continue;
    }

    const cycleResult = tryExpandCycleStatement({
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
      expandBody: expandFunctionBodyIntoKernel
    });
    if (cycleResult.handled) {
      if (cycleResult.shouldBreak) break;
      i = cycleResult.nextIndex;
      continue;
    }

    const callResult = tryExpandFunctionCall({
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
      expandBody: expandFunctionBodyIntoKernel
    });
    if (callResult.handled) {
      if (callResult.shouldBreak) break;
      i = callResult.nextIndex;
      continue;
    }

    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      `Unsupported function body statement: '${clean}'.`,
      'Function bodies currently support advanced statements, for/while/if control-flow, cycle blocks, labeled cycles, and function calls.'
    ));
  }
}
