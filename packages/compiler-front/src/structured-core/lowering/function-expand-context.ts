import {
  Diagnostic,
  ExpansionMode,
  KernelAst
} from '@castm/compiler-ir';
import {
  FunctionDefinitionLike
} from './for-expand.js';
import { instantiateFunctionBody, makeControlBundle } from './function-expand-helpers.js';
import type { LoopControlScope } from './loop-control-scope.js';

interface JumpReuseSpecialization {
  key: string;
  name: string;
  args: string[];
  definition: FunctionDefinitionLike;
  entryLabel: string;
  depth: number;
  lineNo: number;
}

interface JumpReuseReturnSite {
  id: number;
  label: string;
  depth: number;
  lineNo: number;
}

/**
 * Link-PE configuration for register-based subroutine return.
 * Each depth level uses a different PE to avoid clobbering the
 * link register when calls are nested across depths.
 */
interface LinkPeConfig {
  row: number;
  col: number;
}

export interface FunctionExpansionContext {
  mode: ExpansionMode;
  /** Register name used as link (return address) register. */
  linkRegName: string;
  /** PE used for JUMP instructions in call bundles. */
  jumpPeRow: number;
  jumpPeCol: number;
  /**
   * Per-depth link PE: linkPeByDepth[d] is the PE where SADD sets the
   * return address and where JUMP ZERO, R3 returns at depth `d`.
   * Depth 0 = @3,0 ; Depth 1 = @3,1 (avoids link-register clobbering).
   */
  linkPeByDepth: LinkPeConfig[];
  /** Maximum depth that can use jump-reuse (inclusive). */
  maxJumpReuseDepth: number;
  nextReturnId: number;
  jumpReuseSpecializations: Map<string, JumpReuseSpecialization>;
  jumpReuseOrder: string[];
  jumpReuseReturnSites: JumpReuseReturnSite[];
  finalized: boolean;
}

export interface JumpReuseResolution {
  specialization: JumpReuseSpecialization;
  returnId: number;
  returnLabel: string;
}

interface FinalizeJumpReuseInput {
  context: FunctionExpansionContext;
  kernel: KernelAst;
  functions: ReadonlyMap<string, FunctionDefinitionLike>;
  constants: ReadonlyMap<string, number>;
  diagnostics: Diagnostic[];
  bundleCounter: { value: number };
  expansionCounter: { value: number };
  controlFlowCounter: { value: number };
  expandBody: (
    body: Array<{ lineNo: number; rawLine: string; cleanLine: string }>,
    kernel: KernelAst,
    functions: ReadonlyMap<string, FunctionDefinitionLike>,
    constants: ReadonlyMap<string, number>,
    diagnostics: Diagnostic[],
    bundleCounter: { value: number },
    callStack: string[],
    expansionCounter: { value: number },
    controlFlowCounter: { value: number },
    expansionContext?: FunctionExpansionContext,
    isRoot?: boolean,
    loopControlStack?: LoopControlScope[]
  ) => void;
  loopControlStack: LoopControlScope[];
}

function buildSpecializationKey(name: string, args: string[]): string {
  return `${name}(${args.join(',')})`;
}

function buildSpecializationKeyWithDepth(name: string, args: string[], depth: number): string {
  return `${depth}:${buildSpecializationKey(name, args)}`;
}

export function createFunctionExpansionContext(mode: ExpansionMode, maxDepth: number = 0): FunctionExpansionContext {
  return {
    mode,
    linkRegName: 'R3',
    jumpPeRow: 0,
    jumpPeCol: 1,
    linkPeByDepth: [
      { row: 3, col: 0 },  // depth 0 — R3 on @3,0
      { row: 3, col: 1 }   // depth 1 — R3 on @3,1
    ],
    maxJumpReuseDepth: maxDepth,
    nextReturnId: 1,
    jumpReuseSpecializations: new Map(),
    jumpReuseOrder: [],
    jumpReuseReturnSites: [],
    finalized: false
  };
}

export function resolveJumpReuseCall(
  context: FunctionExpansionContext,
  name: string,
  args: string[],
  definition: FunctionDefinitionLike,
  depth: number,
  lineNo: number,
  expansionCounter: { value: number }
): JumpReuseResolution {
  const key = buildSpecializationKeyWithDepth(name, args, depth);
  let specialization = context.jumpReuseSpecializations.get(key);

  if (!specialization) {
    specialization = {
      key,
      name,
      args,
      definition,
      entryLabel: `__fn_entry_${name}_${expansionCounter.value++}`,
      depth,
      lineNo
    };
    context.jumpReuseSpecializations.set(key, specialization);
    context.jumpReuseOrder.push(key);
  }

  const returnId = context.nextReturnId++;
  const returnLabel = `__ret_label_${returnId}`;
  context.jumpReuseReturnSites.push({
    id: returnId,
    label: returnLabel,
    depth,
    lineNo
  });

  return {
    specialization,
    returnId,
    returnLabel
  };
}

export function finalizeJumpReuseFunctions(input: FinalizeJumpReuseInput): void {
  const {
    context,
    kernel,
    functions,
    constants,
    diagnostics,
    bundleCounter,
    expansionCounter,
    controlFlowCounter,
    expandBody,
    loopControlStack
  } = input;

  if (context.mode !== 'jump-reuse' || context.finalized) {
    return;
  }
  context.finalized = true;

  if (context.jumpReuseOrder.length === 0) {
    return;
  }

  // NOTE: The for-of loop over jumpReuseOrder naturally picks up new
  // entries pushed during expansion of earlier bodies (depth-0 bodies
  // register depth-1 specializations which are then processed).
  for (const key of context.jumpReuseOrder) {
    const spec = context.jumpReuseSpecializations.get(key);
    if (!spec) continue;

    const instantiated = instantiateFunctionBody(
      spec.definition,
      spec.args,
      spec.lineNo,
      diagnostics,
      expansionCounter
    );
    if (!instantiated) continue;

    // Record the array position where the body will begin.
    const bodyStartArrayIndex = kernel.bundles.length;
    const bodyStartAdvancedStatementIndex = kernel.advancedStatements.length;

    // Build a callStack that reflects the nesting depth so that
    // inner calls at depth+1 are handled correctly.
    const specializationCallStack = [
      ...Array.from({ length: spec.depth }, (_, idx) => `__jump_reuse_depth_${idx}`),
      spec.name
    ];
    expandBody(
      instantiated,
      kernel,
      functions,
      constants,
      diagnostics,
      bundleCounter,
      specializationCallStack,
      expansionCounter,
      controlFlowCounter,
      context,
      false,
      loopControlStack
    );

    // Attach the entry label to the first bundle of the expanded body,
    // or to the first new advancedStatement when the body is advancedStatement-only
    // (e.g. std::extract_bytes).
    if (bodyStartArrayIndex < kernel.bundles.length) {
      kernel.bundles[bodyStartArrayIndex].label = spec.entryLabel;
    } else if (bodyStartAdvancedStatementIndex < kernel.advancedStatements.length) {
      // AdvancedStatement-only body: label the first advancedStatement so that advancedStatement
      // expansion later attaches the label to the generated bundles.
      kernel.advancedStatements[bodyStartAdvancedStatementIndex].label = spec.entryLabel;
    } else {
      // Edge case: body generated zero bundles AND zero advancedStatements — emit a labelled NOP.
      const linkPe = context.linkPeByDepth[spec.depth] ?? context.linkPeByDepth[0];
      kernel.bundles.push(makeControlBundle(
        bundleCounter.value++,
        spec.lineNo,
        linkPe.row,
        linkPe.col,
        'NOP',
        spec.entryLabel
      ));
    }

    // Emit the register-based return: JUMP ZERO, R3 on the link PE.
    const linkPe = context.linkPeByDepth[spec.depth] ?? context.linkPeByDepth[0];
    kernel.bundles.push(makeControlBundle(
      bundleCounter.value++,
      spec.lineNo,
      linkPe.row,
      linkPe.col,
      `JUMP ZERO, ${context.linkRegName}`
    ));
  }
}
