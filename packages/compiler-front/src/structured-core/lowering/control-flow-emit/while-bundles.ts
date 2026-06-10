import { BundleAst, KernelAst, spanAt } from '@castm/compiler-ir';
import type { ParsedCondition } from '../control-flow.js';
import {
  cloneBundle,
  makeControlBundle
} from '../function-expand-helpers.js';
import { buildFalseBranchInstruction } from '../control-flow.js';
import { parseInstruction } from '../instructions.js';

interface WhileFusionPlanLike {
  bodyRow: number;
  bodyCol: number;
  incomingRegister: string;
}

interface EmitWhileBundlesInput {
  kernel: KernelAst;
  bundleIndex: number;
  lineNo: number;
  row: number;
  col: number;
  condition: ParsedCondition;
  startLabel: string;
  endLabel: string;
  loopBundles: BundleAst[];
  fusionPlan: WhileFusionPlanLike | null;
}

export function emitWhileControlFlowBundles(input: EmitWhileBundlesInput): number {
  const {
    kernel,
    lineNo,
    row,
    col,
    condition,
    startLabel,
    endLabel,
    loopBundles,
    fusionPlan
  } = input;
  let bundleIndex = input.bundleIndex;

  kernel.bundles.push(makeControlBundle(
    bundleIndex++,
    lineNo,
    row,
    col,
    buildFalseBranchInstruction(condition, endLabel),
    startLabel
  ));

  for (const bundle of loopBundles) {
    kernel.bundles.push(cloneBundle(bundle, bundleIndex++));
  }

  let fusedBackEdge = false;
  if (fusionPlan) {
    const jumpText = `JUMP ZERO, ${startLabel}`;
    kernel.bundles[kernel.bundles.length - 1].statements.push({
      kind: 'at',
      row,
      col,
      instruction: parseInstruction(jumpText, lineNo, 1),
      span: spanAt(lineNo, 1, jumpText.length)
    });
    fusedBackEdge = true;
  }

  if (!fusedBackEdge) {
    kernel.bundles.push(makeControlBundle(
      bundleIndex++,
      lineNo,
      row,
      col,
      `JUMP ZERO, ${startLabel}`
    ));
  }

  kernel.bundles.push(makeControlBundle(
    bundleIndex++,
    lineNo,
    row,
    col,
    'NOP',
    endLabel
  ));

  return bundleIndex;
}
