import {
  CycleAst,
  Diagnostic,
  KernelAst
} from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import {
  parseForHeader
} from './control-flow.js';
import { parseFunctionCallLine } from './functions.js';
import { parseInstruction } from './instructions.js';
import { parseAdvancedStatementAsPragma } from './statements.js';
import {
  expandLoopBody,
  parseInlineCycleStatements,
  parseLabeledCycleLine
} from './cycle-expand.js';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from '../parser-utils/blocks.js';
import {
  expandForLoopIntoKernel,
  FunctionDefinitionLike
} from './for-expand.js';
import {
  cloneCycle,
  cycleHasControlFlow,
  instantiateFunctionBody,
  makeControlCycle
} from './function-expand-helpers.js';
import {
  tryExpandIfStatement,
  tryExpandWhileStatement
} from './function-expand-control-flow.js';

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

    const forHeader = parseForHeader(clean, entry.lineNo, constants, new Map(), diagnostics);
    if (forHeader) {
      const loopBlock = collectBlockFromEntries(body, i);
      if (loopBlock.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated for block.',
          'Add a closing brace for for { ... }.'
        ));
        break;
      }

      expandForLoopIntoKernel(
        forHeader,
        loopBlock.body,
        entry.lineNo,
        clean.length,
        kernel,
        functions,
        constants,
        diagnostics,
        cycleCounter,
        callStack,
        expansionCounter,
        controlFlowCounter,
        {
          cycleHasControlFlow,
          cloneCycle,
          parseInstruction,
          makeControlCycle,
          expandFunctionBodyIntoKernel
        }
      );
      i = loopBlock.endIndex;
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

    const labeledCycle = parseLabeledCycleLine(clean);
    if (labeledCycle && labeledCycle.inlinePayload !== undefined) {
      const cycle: CycleAst = {
        index: cycleCounter.value++,
        label: labeledCycle.label,
        statements: parseInlineCycleStatements(labeledCycle.inlinePayload, entry.lineNo, constants, diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      };
      kernel.cycles.push(cycle);
      continue;
    }

    if (labeledCycle) {
      const block = collectBlockFromEntries(body, i);
      if (block.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          `Unterminated labeled cycle '${labeledCycle.label}' inside function body.`,
          'Add a closing brace for cycle { ... }.'
        ));
        break;
      }

      kernel.cycles.push({
        index: cycleCounter.value++,
        label: labeledCycle.label,
        statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      });
      i = block.endIndex;
      continue;
    }

    const inlineCycleMatch = clean.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
    if (inlineCycleMatch) {
      const cycle: CycleAst = {
        index: cycleCounter.value++,
        statements: parseInlineCycleStatements(inlineCycleMatch[1], entry.lineNo, constants, diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      };
      kernel.cycles.push(cycle);
      continue;
    }

    if (/^cycle\s*\{\s*$/i.test(clean)) {
      const block = collectBlockFromEntries(body, i);
      if (block.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated cycle block inside function body.',
          'Add a closing brace for cycle { ... }.'
        ));
        break;
      }

      kernel.cycles.push({
        index: cycleCounter.value++,
        statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      });
      i = block.endIndex;
      continue;
    }

    const nestedCall = parseFunctionCallLine(clean);
    if (nestedCall && functions.has(nestedCall.name)) {
      if (callStack.includes(nestedCall.name)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          `Recursive function call detected: ${[...callStack, nestedCall.name].join(' -> ')}.`,
          'Recursive function expansion is not supported.'
        ));
        continue;
      }

      const def = functions.get(nestedCall.name)!;
      const instantiated = instantiateFunctionBody(def, nestedCall.args, entry.lineNo, diagnostics, expansionCounter);
      if (!instantiated) continue;

      expandFunctionBodyIntoKernel(
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
