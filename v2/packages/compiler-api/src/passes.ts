import { getInstructionSet } from '@openedge/lang-spec';
import {
  AstProgram,
  CompilerPass,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  HirCycle,
  HirOperation,
  HirProgram,
  InstructionAst,
  MirProgram,
  makeDiagnostic
} from '@openedge/compiler-ir';

const BINARY_OPCODES: Record<string, string> = {
  '+': 'SADD',
  '-': 'SSUB',
  '*': 'SMUL',
  '&': 'LAND',
  '|': 'LOR',
  '^': 'LXOR',
  '<<': 'SLT',
  '>>': 'SRT'
};

const VALID_OPCODES = new Set(getInstructionSet().map((x) => x.opcode));

function cloneInstruction(instruction: InstructionAst): InstructionAst {
  return {
    ...instruction,
    operands: [...instruction.operands],
    span: { ...instruction.span }
  };
}

function cloneAst(ast: AstProgram): AstProgram {
  if (!ast.kernel) {
    return { ...ast, span: { ...ast.span } };
  }

  return {
    ...ast,
    span: { ...ast.span },
    kernel: {
      ...ast.kernel,
      span: { ...ast.kernel.span },
      config: ast.kernel.config ? { ...ast.kernel.config, span: { ...ast.kernel.config.span } } : undefined,
      directives: ast.kernel.directives.map((d) => ({ ...d, span: { ...d.span } })),
      pragmas: [...ast.kernel.pragmas],
      cycles: ast.kernel.cycles.map((cycle) => ({
        ...cycle,
        span: { ...cycle.span },
        statements: cycle.statements.map((stmt) => {
          if (stmt.kind === 'at') {
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

function isIdentifier(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token.trim());
}

function isRawAddress(expr: string): boolean {
  return /^\[(.+)\]$/s.test(expr.trim());
}

function isArrayAddress(expr: string): boolean {
  const compact = expr.replace(/\s+/g, '');
  return /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]+\])+$/.test(compact);
}

function isMemoryReference(expr: string): boolean {
  return isRawAddress(expr) || isArrayAddress(expr);
}

function toAddressOperand(memExpr: string): string {
  const trimmed = memExpr.trim();
  const raw = trimmed.match(/^\[(.+)\]$/s);
  return raw ? raw[1].trim() : trimmed;
}

function splitAssignment(text: string): { lhs: string; rhs: string } | null {
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (ch !== '=' || paren !== 0 || bracket !== 0) continue;

    const prev = text[i - 1] ?? '';
    const next = text[i + 1] ?? '';
    const isComparison = prev === '=' || prev === '!' || prev === '<' || prev === '>' || next === '=';
    if (isComparison) continue;

    return {
      lhs: text.slice(0, i).trim(),
      rhs: text.slice(i + 1).trim()
    };
  }

  return null;
}

function splitTopLevelBinary(rhs: string): { left: string; op: string; right: string } | null {
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i < rhs.length; i++) {
    const ch = rhs[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (paren !== 0 || bracket !== 0) continue;

    const two = rhs.slice(i, i + 2);
    if (two === '<<' || two === '>>') {
      return {
        left: rhs.slice(0, i).trim(),
        op: two,
        right: rhs.slice(i + 2).trim()
      };
    }

    if (['+', '-', '*', '&', '|', '^'].includes(ch)) {
      if (i === 0 && ch === '-') continue;
      return {
        left: rhs.slice(0, i).trim(),
        op: ch,
        right: rhs.slice(i + 1).trim()
      };
    }
  }

  return null;
}

function transformInstructions(
  ast: AstProgram,
  transformer: (instruction: InstructionAst, diagnostics: Diagnostic[]) => InstructionAst
): { output: AstProgram; diagnostics: Diagnostic[] } {
  const out = cloneAst(ast);
  if (!out.kernel) return { output: out, diagnostics: [] };

  const diagnostics: Diagnostic[] = [];

  for (const cycle of out.kernel.cycles) {
    for (const stmt of cycle.statements) {
      if (stmt.kind === 'row') {
        stmt.instructions = stmt.instructions.map((inst) => transformer(inst, diagnostics));
        continue;
      }

      stmt.instruction = transformer(stmt.instruction, diagnostics);
    }
  }

  return { output: out, diagnostics };
}

export const desugarMemoryPass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-memory',
  run(input) {
    const { output, diagnostics } = transformInstructions(input, (instruction, passDiagnostics) => {
      if (instruction.opcode) return instruction;

      const assignment = splitAssignment(instruction.text);
      if (!assignment) return instruction;

      const lhs = assignment.lhs.trim();
      const rhs = assignment.rhs.trim();
      const lhsMem = isMemoryReference(lhs);
      const rhsMem = isMemoryReference(rhs);

      if (!lhsMem && !rhsMem) return instruction;

      if (lhsMem && rhsMem) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.InvalidAssignment,
          'error',
          instruction.span,
          'Memory-to-memory assignment is not supported in v2.',
          'Use a temporary register: R0 = src[i]; dst[i] = R0;'
        ));
        return instruction;
      }

      if (lhsMem) {
        if (!isIdentifier(rhs)) {
          passDiagnostics.push(makeDiagnostic(
            ErrorCodes.Semantic.InvalidAssignment,
            'error',
            instruction.span,
            `Store source must be a register-like identifier, got '${rhs}'.`,
            'Valid form: A[i] = R3; or [addr] = R3;'
          ));
          return instruction;
        }

        return {
          ...instruction,
          opcode: 'SWI',
          operands: [rhs, toAddressOperand(lhs)],
          text: `SWI ${rhs}, ${toAddressOperand(lhs)}`
        };
      }

      if (!isIdentifier(lhs)) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.InvalidAssignment,
          'error',
          instruction.span,
          `Load destination must be a register-like identifier, got '${lhs}'.`,
          'Valid form: R3 = A[i]; or R3 = [addr];'
        ));
        return instruction;
      }

      return {
        ...instruction,
        opcode: 'LWI',
        operands: [lhs, toAddressOperand(rhs)],
        text: `LWI ${lhs}, ${toAddressOperand(rhs)}`
      };
    });

    return { output, diagnostics };
  }
};

export const desugarExpressionsPass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-expressions',
  run(input) {
    const { output, diagnostics } = transformInstructions(input, (instruction, passDiagnostics) => {
      if (instruction.opcode) return instruction;

      const assignment = splitAssignment(instruction.text);
      if (!assignment) return instruction;

      const lhs = assignment.lhs.trim();
      const rhs = assignment.rhs.trim();

      if (isMemoryReference(lhs) || isMemoryReference(rhs)) {
        return instruction;
      }

      if (!isIdentifier(lhs)) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.InvalidAssignment,
          'error',
          instruction.span,
          `Invalid assignment destination '${lhs}'.`,
          'Expected a register-like identifier at the left-hand side.'
        ));
        return instruction;
      }

      const binary = splitTopLevelBinary(rhs);
      if (!binary) {
        return {
          ...instruction,
          opcode: 'SADD',
          operands: [lhs, rhs, 'ZERO'],
          text: `SADD ${lhs}, ${rhs}, ZERO`
        };
      }

      if (!binary.left || !binary.right) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.UnsupportedOperation,
          'error',
          instruction.span,
          `Unsupported expression '${instruction.text}'.`,
          'Expected binary form: dst = a OP b.'
        ));
        return instruction;
      }

      const opcode = BINARY_OPCODES[binary.op];
      if (!opcode) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.UnsupportedOperation,
          'error',
          instruction.span,
          `Unsupported operator '${binary.op}'.`,
          'Supported operators: + - * & | ^ << >>'
        ));
        return instruction;
      }

      return {
        ...instruction,
        opcode,
        operands: [lhs, binary.left, binary.right],
        text: `${opcode} ${lhs}, ${binary.left}, ${binary.right}`
      };
    });

    return { output, diagnostics };
  }
};

export const desugarAutoCyclePass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-auto-cycle',
  run(input) {
    return { output: cloneAst(input), diagnostics: [] };
  }
};

export const expandPragmasPass: CompilerPass<AstProgram, AstProgram> = {
  name: 'expand-pragmas',
  run(input) {
    return { output: cloneAst(input), diagnostics: [] };
  }
};

function addOperation(
  operations: HirOperation[],
  occupied: Set<string>,
  cycleIndex: number,
  row: number,
  col: number,
  instruction: InstructionAst,
  grid: GridSpec,
  diagnostics: Diagnostic[]
): void {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      instruction.span,
      `Coordinate @${row},${col} is out of bounds for ${grid.rows}x${grid.cols}.`,
      'Adjust the coordinate or change grid size in CompileOptions.'
    ));
    return;
  }

  const key = `${cycleIndex}:${row}:${col}`;
  if (occupied.has(key)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.Collision,
      'error',
      instruction.span,
      `Multiple instructions target @${row},${col} in cycle ${cycleIndex}.`,
      'Split these writes into different cycles or coordinates.'
    ));
    return;
  }

  if (!instruction.opcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidAssignment,
      'error',
      instruction.span,
      `Could not lower instruction '${instruction.text}'.`,
      'Only ISA instructions or supported assignment sugars can be compiled.'
    ));
    return;
  }

  const opcode = instruction.opcode.toUpperCase();
  if (!VALID_OPCODES.has(opcode)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnknownOpcode,
      'error',
      instruction.span,
      `Unknown opcode '${instruction.opcode}'.`,
      'Check the instruction set catalog in @openedge/lang-spec.'
    ));
    return;
  }

  occupied.add(key);
  operations.push({
    row,
    col,
    opcode,
    operands: [...instruction.operands],
    span: { ...instruction.span }
  });
}

export function createResolveSymbolsPass(targetProfileId: string, grid: GridSpec): CompilerPass<AstProgram, HirProgram> {
  return {
    name: 'resolve-symbols',
    run(input) {
      const diagnostics: Diagnostic[] = [];

      const kernel = input.kernel;
      const cycles: HirCycle[] = [];
      if (!kernel) {
        return {
          output: {
            targetProfileId,
            grid,
            cycles: []
          },
          diagnostics
        };
      }

      for (const cycle of kernel.cycles) {
        const operations: HirOperation[] = [];
        const occupied = new Set<string>();

        for (const stmt of cycle.statements) {
          if (stmt.kind === 'at') {
            addOperation(operations, occupied, cycle.index, stmt.row, stmt.col, stmt.instruction, grid, diagnostics);
            continue;
          }

          if (stmt.kind === 'row') {
            if (stmt.row < 0 || stmt.row >= grid.rows) {
              diagnostics.push(makeDiagnostic(
                ErrorCodes.Semantic.CoordinateOutOfBounds,
                'error',
                stmt.span,
                `Row ${stmt.row} is out of bounds for ${grid.rows}x${grid.cols}.`,
                'Adjust row value or change grid size in CompileOptions.'
              ));
              continue;
            }

            if (stmt.instructions.length === 0) continue;

            if (stmt.instructions.length === 1) {
              for (let col = 0; col < grid.cols; col++) {
                addOperation(operations, occupied, cycle.index, stmt.row, col, stmt.instructions[0], grid, diagnostics);
              }
              continue;
            }

            if (stmt.instructions.length > grid.cols) {
              diagnostics.push(makeDiagnostic(
                ErrorCodes.Semantic.CoordinateOutOfBounds,
                'error',
                stmt.span,
                `Row ${stmt.row} defines ${stmt.instructions.length} columns, grid has ${grid.cols}.`,
                'Reduce row segments or increase grid columns.'
              ));
            }

            const max = Math.min(stmt.instructions.length, grid.cols);
            for (let col = 0; col < max; col++) {
              addOperation(operations, occupied, cycle.index, stmt.row, col, stmt.instructions[col], grid, diagnostics);
            }

            for (let col = max; col < grid.cols; col++) {
              addOperation(operations, occupied, cycle.index, stmt.row, col, {
                text: 'NOP',
                opcode: 'NOP',
                operands: [],
                span: { ...stmt.span }
              }, grid, diagnostics);
            }
            continue;
          }

          if (stmt.kind === 'col') {
            if (stmt.col < 0 || stmt.col >= grid.cols) {
              diagnostics.push(makeDiagnostic(
                ErrorCodes.Semantic.CoordinateOutOfBounds,
                'error',
                stmt.span,
                `Column ${stmt.col} is out of bounds for ${grid.rows}x${grid.cols}.`,
                'Adjust column value or change grid size in CompileOptions.'
              ));
              continue;
            }

            for (let row = 0; row < grid.rows; row++) {
              addOperation(operations, occupied, cycle.index, row, stmt.col, stmt.instruction, grid, diagnostics);
            }
            continue;
          }

          for (let row = 0; row < grid.rows; row++) {
            for (let col = 0; col < grid.cols; col++) {
              addOperation(operations, occupied, cycle.index, row, col, stmt.instruction, grid, diagnostics);
            }
          }
        }

        cycles.push({
          index: cycle.index,
          operations,
          span: { ...cycle.span }
        });
      }

      return {
        output: {
          targetProfileId,
          grid,
          cycles
        },
        diagnostics
      };
    }
  };
}

export function createValidateGridPass(grid: GridSpec): CompilerPass<HirProgram, HirProgram> {
  return {
    name: 'validate-grid',
    run(input) {
      const diagnostics: Diagnostic[] = [];

      for (const cycle of input.cycles) {
        const seen = new Set<string>();
        for (const op of cycle.operations) {
          if (op.row < 0 || op.row >= grid.rows || op.col < 0 || op.col >= grid.cols) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.CoordinateOutOfBounds,
              'error',
              op.span,
              `Operation at @${op.row},${op.col} is out of bounds for ${grid.rows}x${grid.cols}.`
            ));
          }

          const key = `${cycle.index}:${op.row}:${op.col}`;
          if (seen.has(key)) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.Collision,
              'error',
              op.span,
              `Duplicate operation at @${op.row},${op.col} in cycle ${cycle.index}.`
            ));
          }
          seen.add(key);
        }
      }

      return { output: input, diagnostics };
    }
  };
}

export const lowerToMirPass: CompilerPass<HirProgram, MirProgram> = {
  name: 'lower-to-mir',
  run(input) {
    const diagnostics: Diagnostic[] = [];

    const output: MirProgram = {
      targetProfileId: input.targetProfileId,
      grid: input.grid,
      cycles: input.cycles.map((cycle) => ({
        index: cycle.index,
        slots: [...cycle.operations]
          .sort((a, b) => (a.row - b.row) || (a.col - b.col))
          .map((op) => ({
            row: op.row,
            col: op.col,
            instruction: {
              opcode: op.opcode,
              operands: [...op.operands],
              span: { ...op.span }
            }
          }))
      }))
    };

    return { output, diagnostics };
  }
};
