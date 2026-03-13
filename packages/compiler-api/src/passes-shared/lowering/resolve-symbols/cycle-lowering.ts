import {
  CycleStatementAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  HirOperation,
  makeDiagnostic
} from '@castm/compiler-ir';
import { addOperation } from './operations.js';

export function lowerCycleStatements(
  cycleIndex: number,
  statements: CycleStatementAst[],
  grid: GridSpec,
  labels: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): HirOperation[] {
  const operations: HirOperation[] = [];
  const occupied = new Set<string>();

  for (const stmt of statements) {
    if (stmt.kind === 'at-expr') {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnresolvedCoordinateExpression,
        'error',
        stmt.span,
        `Unresolved spatial coordinate expression '@${stmt.rowExpr},${stmt.colExpr}'.`,
        'Bind coordinate expressions via for-loop expansion or use explicit numeric coordinates.'
      ));
      continue;
    }

    if (stmt.kind === 'at') {
      addOperation(operations, occupied, cycleIndex, stmt.row, stmt.col, stmt.instruction, grid, labels, diagnostics);
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
          addOperation(operations, occupied, cycleIndex, stmt.row, col, stmt.instructions[0], grid, labels, diagnostics);
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
        addOperation(operations, occupied, cycleIndex, stmt.row, col, stmt.instructions[col], grid, labels, diagnostics);
      }

      for (let col = max; col < grid.cols; col++) {
        addOperation(operations, occupied, cycleIndex, stmt.row, col, {
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
        addOperation(operations, occupied, cycleIndex, row, stmt.col, stmt.instruction, grid, labels, diagnostics);
      }
      continue;
    }

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        addOperation(operations, occupied, cycleIndex, row, col, stmt.instruction, grid, labels, diagnostics);
      }
    }
  }

  return operations;
}
