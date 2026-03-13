import {
  ErrorCodes,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import { parseFunctionCallLine } from './functions.js';
import {
  instantiateFunctionBody,
  makeCallCycle,
  makeControlCycle
} from './function-expand-helpers.js';
import { resolveJumpReuseCall } from './function-expand-context.js';
import {
  FunctionExpandStepInput,
  FunctionExpandStepResult
} from './function-expand-types.js';
import { INTERPOLATED_IDENT, RESERVED_KEYWORDS } from '../constants.js';

function stripLabelPrefix(clean: string): { label: string; rest: string } | null {
  const match = clean.match(new RegExp(`^(${INTERPOLATED_IDENT})\\s*:\\s*(.+)$`));
  if (!match) return null;
  const keyword = match[1].toLowerCase();
  if (RESERVED_KEYWORDS.has(keyword)) return null;
  if (match[2].startsWith(':')) return null;
  return { label: match[1], rest: match[2] };
}

export function tryExpandFunctionCall(input: FunctionExpandStepInput): FunctionExpandStepResult {
  const {
    index,
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
    expandBody,
    expansionContext
  } = input;

  // Strip optional label prefix (e.g. "entry: doWork(R1, R0);")
  const labelResult = stripLabelPrefix(clean);
  const toParse = labelResult ? labelResult.rest : clean;
  const nestedCall = parseFunctionCallLine(toParse);
  if (!nestedCall || !functions.has(nestedCall.name)) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  if (callStack.includes(nestedCall.name)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      `Recursive function call detected: ${[...callStack, nestedCall.name].join(' -> ')}.`,
      'Recursive function expansion is not supported.'
    ));
    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  const def = functions.get(nestedCall.name)!;

  if (expansionContext?.mode === 'jump-reuse') {
    const jumpReuseDepth = callStack.length;
    const maxDepth = expansionContext.maxJumpReuseDepth;

    // Beyond the max supported depth → always inline.
    if (jumpReuseDepth > maxDepth) {
      const instantiatedNested = instantiateFunctionBody(def, nestedCall.args, entry.lineNo, diagnostics, expansionCounter);
      if (!instantiatedNested) {
        return { handled: true, nextIndex: index, shouldBreak: false };
      }

      expandBody(
        instantiatedNested,
        kernel,
        functions,
        constants,
        diagnostics,
        cycleCounter,
        [...callStack, nestedCall.name],
        expansionCounter,
        controlFlowCounter,
        expansionContext,
        false,
        input.loopControlStack
      );

      return { handled: true, nextIndex: index, shouldBreak: false };
    }

    // Within supported depth range (0..maxDepth) → jump-reuse with
    // register-based return via SADD + JUMP merged in one cycle.
    const linkPe = expansionContext.linkPeByDepth[jumpReuseDepth] ?? expansionContext.linkPeByDepth[0];

    const resolved = resolveJumpReuseCall(
      expansionContext,
      nestedCall.name,
      nestedCall.args,
      def,
      jumpReuseDepth,
      entry.lineNo,
      expansionCounter
    );

    // Emit one cycle: SADD R3, ZERO, retLabel (on link PE) + JUMP entry, ZERO (on jump PE)
    kernel.cycles.push(makeCallCycle(
      cycleCounter.value++,
      entry.lineNo,
      expansionContext.jumpPeRow,
      expansionContext.jumpPeCol,
      resolved.specialization.entryLabel,
      linkPe.row,
      linkPe.col,
      expansionContext.linkRegName,
      resolved.returnLabel
    ));

    // NOP landing pad with return label
    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      entry.lineNo,
      linkPe.row,
      linkPe.col,
      'NOP',
      resolved.returnLabel
    ));

    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  const instantiated = instantiateFunctionBody(def, nestedCall.args, entry.lineNo, diagnostics, expansionCounter);
  if (!instantiated) {
    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  const prevCycleCount = kernel.cycles.length;
  const prevPragmaCount = kernel.pragmas.length;
  expandBody(
    instantiated,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    [...callStack, nestedCall.name],
    expansionCounter,
    controlFlowCounter,
    expansionContext,
    false,
    input.loopControlStack
  );

  // Propagate label to first generated cycle, or first new pragma
  // when the function body only contains pragmas (e.g. std::extract_bytes).
  if (labelResult) {
    if (kernel.cycles.length > prevCycleCount) {
      kernel.cycles[prevCycleCount].label = labelResult.label;
    } else if (kernel.pragmas.length > prevPragmaCount) {
      kernel.pragmas[prevPragmaCount].label = labelResult.label;
    }
  }

  return { handled: true, nextIndex: index, shouldBreak: false };
}
