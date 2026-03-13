import { CycleStatementAst, Diagnostic } from '@castm/compiler-ir';
import { SourceLineEntry } from '../parser-utils/blocks.js';
import { applyBindings } from '../parser-utils/numbers.js';
import {
  tryExpandNestedForLoopStep,
  tryExpandSingleCycleStatementStep,
  tryExpandSpatialAtBlockStep
} from './cycle-loop/steps.js';

export function expandLoopBody(
  body: SourceLineEntry[],
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): CycleStatementAst[] {
  const statements: CycleStatementAst[] = [];

  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    if (!entry.cleanLine) continue;

    const clean = applyBindings(entry.cleanLine, bindings);
    const raw = applyBindings(entry.rawLine, bindings);
    if (!clean) continue;

    const stepInput = {
      body,
      index: i,
      entry,
      clean,
      raw,
      constants,
      bindings,
      diagnostics
    };

    const nestedForStep = tryExpandNestedForLoopStep(stepInput, expandLoopBody);
    if (nestedForStep.handled) {
      statements.push(...nestedForStep.statements);
      if (nestedForStep.shouldBreak) break;
      i = nestedForStep.nextIndex;
      continue;
    }

    const spatialStep = tryExpandSpatialAtBlockStep(stepInput);
    if (spatialStep.handled) {
      statements.push(...spatialStep.statements);
      if (spatialStep.shouldBreak) break;
      i = spatialStep.nextIndex;
      continue;
    }

    const statementStep = tryExpandSingleCycleStatementStep(stepInput);
    if (statementStep.handled) {
      statements.push(...statementStep.statements);
      if (statementStep.shouldBreak) break;
      i = statementStep.nextIndex;
      continue;
    }
  }

  return statements;
}
