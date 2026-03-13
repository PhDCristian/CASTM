import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  KernelAst,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import type { ForHeader } from './control-flow.js';
import {
  collectBlockFromEntries,
  type SourceLineEntry
} from '../parser-utils/blocks.js';
import {
  enumerateForValues,
  instantiateEntriesWithBindings
} from './for-expand-helpers.js';
import type { ExpandForCallbacks, FunctionDefinitionLike } from './for-expand-types.js';
import { parseForHeader } from './control-flow-for.js';
import type { FunctionExpansionContext } from './function-expand-context.js';
import type { LoopControlScope } from './loop-control-scope.js';

interface ExpandStaticForInput {
  header: ForHeader;
  loopLabel?: string;
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
  expansionContext?: FunctionExpansionContext;
  loopControlStack?: LoopControlScope[];
}

interface StaticLoopPlan {
  body: SourceLineEntry[];
  bindings: Array<Map<string, number>>;
}

function collectLoopBindingProduct(
  headers: ForHeader[],
  lineNo: number,
  lineLength: number,
  diagnostics: Diagnostic[]
): Array<Map<string, number>> | null {
  let combinations: Array<Map<string, number>> = [new Map()];

  for (const loopHeader of headers) {
    const values = enumerateForValues(loopHeader, lineNo, lineLength, diagnostics);
    if (!values) return null;

    const next: Array<Map<string, number>> = [];
    for (const base of combinations) {
      for (const value of values) {
        const bound = new Map(base);
        bound.set(loopHeader.variable, value);
        next.push(bound);
      }
    }
    combinations = next;
  }

  return combinations;
}

function buildStaticLoopPlan(
  header: ForHeader,
  loopBody: SourceLineEntry[],
  lineNo: number,
  lineLength: number,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): StaticLoopPlan | null {
  const collapseLevels = header.collapseLevels ?? 1;
  if (collapseLevels <= 1) {
    const bindings = collectLoopBindingProduct([header], lineNo, lineLength, diagnostics);
    if (!bindings) return null;
    return { body: loopBody, bindings };
  }

  if (header.runtime) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, lineLength),
      'collapse(n) is not supported for runtime for-loops.',
      'Use collapse(n) only on static compile-time loops.'
    ));
    return null;
  }

  const collapseHeaders: ForHeader[] = [header];
  let nestedBody = loopBody;

  for (let level = 2; level <= collapseLevels; level++) {
    const firstNonEmptyIndex = nestedBody.findIndex((entry) => entry.cleanLine.trim().length > 0);
    if (firstNonEmptyIndex < 0) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, lineLength),
        `collapse(${collapseLevels}) requires ${collapseLevels} nested static for-loops.`,
        'Add nested for-loops or reduce collapse(n).'
      ));
      return null;
    }

    const nestedHeaderEntry = nestedBody[firstNonEmptyIndex];
    const nestedHeader = parseForHeader(
      nestedHeaderEntry.cleanLine,
      nestedHeaderEntry.lineNo,
      constants,
      new Map(),
      diagnostics
    );
    if (!nestedHeader) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(nestedHeaderEntry.lineNo, 1, nestedHeaderEntry.cleanLine.length),
        `collapse(${collapseLevels}) expects a nested for-loop at level ${level}.`,
        'Ensure the collapsed loop body begins with another static for-loop.'
      ));
      return null;
    }

    if (nestedHeader.runtime || nestedHeader.control) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(nestedHeaderEntry.lineNo, 1, nestedHeaderEntry.cleanLine.length),
        `collapse(${collapseLevels}) supports only static nested for-loops.`,
        'Remove runtime/control loop headers inside collapsed region.'
      ));
      return null;
    }

    const nestedBlock = collectBlockFromEntries(nestedBody, firstNonEmptyIndex);
    if (nestedBlock.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(nestedHeaderEntry.lineNo, 1, nestedHeaderEntry.cleanLine.length),
        'Unterminated nested for-loop in collapsed region.',
        'Add a closing brace for the nested for-loop.'
      ));
      return null;
    }

    for (let i = 0; i < nestedBody.length; i++) {
      if (i >= firstNonEmptyIndex && i <= nestedBlock.endIndex) continue;
      if (!nestedBody[i].cleanLine.trim()) continue;
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(nestedBody[i].lineNo, 1, nestedBody[i].cleanLine.length),
        `collapse(${collapseLevels}) currently requires perfectly nested loops.`,
        'Move sibling statements outside the collapsed loop region or reduce collapse(n).'
      ));
      return null;
    }

    collapseHeaders.push(nestedHeader);
    nestedBody = nestedBlock.body;
  }

  const bindings = collectLoopBindingProduct(collapseHeaders, lineNo, lineLength, diagnostics);
  if (!bindings) return null;
  return {
    body: nestedBody,
    bindings
  };
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
    callbacks,
    expansionContext,
    loopLabel,
    loopControlStack
  } = input;
  const plan = buildStaticLoopPlan(
    header,
    loopBody,
    lineNo,
    lineLength,
    constants,
    diagnostics
  );
  if (!plan) return;

  const unrollFactor = Math.max(1, header.unrollFactor ?? 1);
  for (let chunkStart = 0; chunkStart < plan.bindings.length; chunkStart += unrollFactor) {
    const chunkEnd = Math.min(plan.bindings.length, chunkStart + unrollFactor);
    for (let idx = chunkStart; idx < chunkEnd; idx++) {
      const bindings = plan.bindings[idx];
      const instantiated = instantiateEntriesWithBindings(plan.body, bindings);

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
        controlFlowCounter,
        expansionContext,
        false,
        [
          ...(loopControlStack ?? []),
          {
            kind: 'for-static',
            label: loopLabel,
            breakLabel: '__for_static_break__',
            continueLabel: '__for_static_continue__',
            row: 0,
            col: 0,
            supportsBreakContinue: false
          }
        ]
      );

      for (const cycle of tmpKernel.cycles) {
        kernel.cycles.push(callbacks.cloneCycle(cycle, cycleCounter.value++));
      }
    }
  }
}
