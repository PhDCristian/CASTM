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
  SourceSpan,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { isNumericLiteralToken } from '../pragma-args-utils.js';

const VALID_OPCODES = new Set(getInstructionSet().map((x) => x.opcode));
const BRANCH_LABEL_OPERAND_INDEX: Readonly<Record<string, number>> = {
  BEQ: 2,
  BNE: 2,
  BLT: 2,
  BGE: 2,
  JUMP: 0
};

function resolveLabelOperand(
  opcode: string,
  operands: string[],
  labels: ReadonlyMap<string, number>,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): string[] {
  const index = BRANCH_LABEL_OPERAND_INDEX[opcode];
  if (index === undefined || index < 0 || index >= operands.length) {
    return [...operands];
  }

  const token = operands[index].trim();
  if (!token || isNumericLiteralToken(token)) {
    return [...operands];
  }

  const targetCycle = labels.get(token);
  if (targetCycle === undefined) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnknownLabel,
      'error',
      span,
      `Unknown branch label '${token}'.`,
      'Declare the label with syntax: labelName: cycle { ... }'
    ));
    return [...operands];
  }

  const resolved = [...operands];
  resolved[index] = String(targetCycle);
  return resolved;
}

function addOperation(
  operations: HirOperation[],
  occupied: Set<string>,
  cycleIndex: number,
  row: number,
  col: number,
  instruction: InstructionAst,
  grid: GridSpec,
  labels: ReadonlyMap<string, number>,
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
  const resolvedOperands = resolveLabelOperand(opcode, instruction.operands, labels, instruction.span, diagnostics);
  operations.push({
    row,
    col,
    opcode,
    operands: resolvedOperands,
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

      const labels = new Map<string, number>();
      for (const cycle of kernel.cycles) {
        if (!cycle.label) continue;
        if (labels.has(cycle.label)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Semantic.DuplicateLabel,
            'error',
            cycle.span,
            `Duplicate cycle label '${cycle.label}'.`,
            'Use unique labels for each labeled cycle.'
          ));
          continue;
        }
        labels.set(cycle.label, cycle.index);
      }

      for (const cycle of kernel.cycles) {
        const operations: HirOperation[] = [];
        const occupied = new Set<string>();

        for (const stmt of cycle.statements) {
          if (stmt.kind === 'at') {
            addOperation(operations, occupied, cycle.index, stmt.row, stmt.col, stmt.instruction, grid, labels, diagnostics);
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
                addOperation(operations, occupied, cycle.index, stmt.row, col, stmt.instructions[0], grid, labels, diagnostics);
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
              addOperation(operations, occupied, cycle.index, stmt.row, col, stmt.instructions[col], grid, labels, diagnostics);
            }

            for (let col = max; col < grid.cols; col++) {
              addOperation(operations, occupied, cycle.index, stmt.row, col, {
                text: 'NOP',
                opcode: 'NOP',
                operands: [],
                span: { ...stmt.span }
              }, grid, labels, diagnostics);
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
              addOperation(operations, occupied, cycle.index, row, stmt.col, stmt.instruction, grid, labels, diagnostics);
            }
            continue;
          }

          for (let row = 0; row < grid.rows; row++) {
            for (let col = 0; col < grid.cols; col++) {
              addOperation(operations, occupied, cycle.index, row, col, stmt.instruction, grid, labels, diagnostics);
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
