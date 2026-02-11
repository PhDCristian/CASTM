import {
  AstProgram,
  StructuredKernelStmtAst,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import { cloneAstProgram } from './utils.js';

export function toStructuredProgramAst(ast: AstProgram): StructuredProgramAst {
  const cloned = cloneAstProgram(ast);
  if (!cloned.kernel) {
    return {
      targetProfileId: cloned.targetProfileId,
      kernel: null,
      span: cloned.span
    };
  }

  const body: StructuredKernelStmtAst[] = [];
  for (const pragma of cloned.kernel.pragmas) {
    body.push({
      kind: 'advanced',
      text: pragma.text,
      span: pragma.span
    });
  }

  for (const cycle of cloned.kernel.cycles) {
    body.push({
      kind: 'cycle',
      cycle,
      span: cycle.span
    });
  }

  return {
    targetProfileId: cloned.targetProfileId,
    kernel: {
      name: cloned.kernel.name,
      config: cloned.kernel.config,
      directives: cloned.kernel.directives,
      body,
      span: cloned.kernel.span
    },
    span: cloned.span
  };
}

export function lowerStructuredProgramToAst(structured: StructuredProgramAst): AstProgram {
  if (!structured.kernel) {
    return {
      targetProfileId: structured.targetProfileId,
      kernel: null,
      span: structured.span
    };
  }

  const pragmas = structured.kernel.body
    .filter((stmt): stmt is Extract<StructuredKernelStmtAst, { kind: 'advanced' }> => stmt.kind === 'advanced')
    .map((stmt) => ({ text: stmt.text, span: stmt.span }));

  const cycles = structured.kernel.body
    .filter((stmt): stmt is Extract<StructuredKernelStmtAst, { kind: 'cycle' }> => stmt.kind === 'cycle')
    .map((stmt, index) => ({
      ...stmt.cycle,
      index
    }));

  return {
    targetProfileId: structured.targetProfileId,
    kernel: {
      name: structured.kernel.name,
      config: structured.kernel.config,
      directives: structured.kernel.directives,
      pragmas,
      cycles,
      span: structured.kernel.span
    },
    span: structured.span
  };
}
