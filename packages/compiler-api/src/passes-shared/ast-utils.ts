import { AstProgram, CycleAst, InstructionAst, SourceSpan } from '@castm/compiler-ir';

export function cloneInstruction(instruction: InstructionAst): InstructionAst {
  return {
    ...instruction,
    operands: [...instruction.operands],
    span: { ...instruction.span }
  };
}

export function cloneAst(ast: AstProgram): AstProgram {
  if (!ast.kernel) {
    return {
      ...ast,
      span: { ...ast.span },
      target: ast.target ? { ...ast.target, span: { ...ast.target.span } } : ast.target,
      build: ast.build
        ? {
            ...ast.build,
            ...(ast.build.grid ? { grid: { ...ast.build.grid } } : {}),
            span: { ...ast.build.span }
          }
        : ast.build
    };
  }

  return {
    ...ast,
    span: { ...ast.span },
    target: ast.target ? { ...ast.target, span: { ...ast.target.span } } : ast.target,
    build: ast.build
      ? {
          ...ast.build,
          ...(ast.build.grid ? { grid: { ...ast.build.grid } } : {}),
          span: { ...ast.build.span }
        }
      : ast.build,
    kernel: {
      ...ast.kernel,
      span: { ...ast.kernel.span },
      config: ast.kernel.config ? { ...ast.kernel.config, span: { ...ast.kernel.config.span } } : undefined,
      directives: ast.kernel.directives.map((d) => ({ ...d, span: { ...d.span } })),
      runtime: (ast.kernel.runtime ?? []).map((statement) => {
        if (statement.kind === 'io_load' || statement.kind === 'io_store') {
          return {
            ...statement,
            addresses: [...statement.addresses],
            span: { ...statement.span }
          };
        }
        if (statement.kind === 'assert') {
          return {
            ...statement,
            at: { ...statement.at },
            span: { ...statement.span }
          };
        }
        return {
          ...statement,
          span: { ...statement.span }
        };
      }),
      pragmas: ast.kernel.pragmas.map((p) => ({ ...p, span: { ...p.span } })),
      cycles: ast.kernel.cycles.map((cycle) => ({
        ...cycle,
        label: cycle.label,
        span: { ...cycle.span },
        statements: cycle.statements.map((stmt) => {
          if (stmt.kind === 'at') {
            return {
              ...stmt,
              span: { ...stmt.span },
              instruction: cloneInstruction(stmt.instruction)
            };
          }

          if (stmt.kind === 'at-expr') {
            return {
              ...stmt,
              span: { ...stmt.span },
              instruction: cloneInstruction(stmt.instruction)
            };
          }

          if (stmt.kind === 'row') {
            return {
              ...stmt,
              span: { ...stmt.span },
              instructions: stmt.instructions.map(cloneInstruction)
            };
          }

          return {
            ...stmt,
            span: { ...stmt.span },
            instruction: cloneInstruction(stmt.instruction)
          };
        })
      }))
    }
  };
}

export function cloneSpan(span: SourceSpan): SourceSpan {
  return { ...span };
}

export function createInstruction(opcode: string, operands: string[], span: SourceSpan): InstructionAst {
  const normalizedOpcode = opcode.toUpperCase();
  return {
    text: operands.length > 0
      ? `${normalizedOpcode} ${operands.join(', ')}`
      : normalizedOpcode,
    opcode: normalizedOpcode,
    operands: [...operands],
    span: cloneSpan(span)
  };
}

export function createAtCycle(
  index: number,
  row: number,
  col: number,
  instruction: InstructionAst,
  span: SourceSpan,
  label?: string
): CycleAst {
  return {
    index,
    label,
    statements: [{
      kind: 'at',
      row,
      col,
      instruction,
      span: cloneSpan(span)
    }],
    span: cloneSpan(span)
  };
}

export function createRowCycle(
  index: number,
  row: number,
  instructions: InstructionAst[],
  span: SourceSpan
): CycleAst {
  return {
    index,
    statements: [{
      kind: 'row',
      row,
      instructions: instructions.map((inst) => ({
        ...inst,
        span: cloneSpan(inst.span),
        operands: [...inst.operands]
      })),
      span: cloneSpan(span)
    }],
    span: cloneSpan(span)
  };
}

export function createMultiAtCycle(
  index: number,
  placements: Array<{ row: number; col: number; instruction: InstructionAst }>,
  span: SourceSpan
): CycleAst {
  return {
    index,
    statements: placements.map((placement) => ({
      kind: 'at' as const,
      row: placement.row,
      col: placement.col,
      instruction: {
        ...placement.instruction,
        span: cloneSpan(placement.instruction.span),
        operands: [...placement.instruction.operands]
      },
      span: cloneSpan(span)
    })),
    span: cloneSpan(span)
  };
}

export function replaceIncoming(token: string, incoming: string): string {
  return token.trim().toUpperCase() === 'INCOMING' ? incoming : token.trim();
}
