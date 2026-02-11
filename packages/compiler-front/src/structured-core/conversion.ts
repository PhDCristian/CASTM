import {
  AstProgram,
  CycleStatementAst,
  Diagnostic,
  KernelAst,
  StructuredKernelStmtAst,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import { cloneAstProgram } from './utils.js';
import { SourceLineEntry } from '../parser-utils/blocks.js';
import { buildConstantMap } from '../parser-core/top-level-scope/constants.js';
import { expandFunctionBodyIntoKernel } from '../parser-core/function-expand.js';

function renderCycleStatement(statement: CycleStatementAst): string {
  if (statement.kind === 'at') {
    return `@${statement.row},${statement.col}: ${statement.instruction.text};`;
  }
  if (statement.kind === 'row') {
    return `at row ${statement.row}: ${statement.instructions.map((instruction) => instruction.text).join(' | ')};`;
  }
  if (statement.kind === 'col') {
    return `at col ${statement.col}: ${statement.instruction.text};`;
  }
  return `at all: ${statement.instruction.text};`;
}

function emitStructuredBodyAsEntries(
  body: StructuredKernelStmtAst[],
  entries: SourceLineEntry[]
): void {
  const pushLine = (text: string) => {
    entries.push({
      lineNo: entries.length + 1,
      rawLine: text,
      cleanLine: text.trim()
    });
  };

  for (const stmt of body) {
    if (stmt.kind === 'advanced') {
      pushLine(`${stmt.text};`);
      continue;
    }

    if (stmt.kind === 'cycle') {
      pushLine('cycle {');
      for (const cycleStmt of stmt.cycle.statements) {
        pushLine(renderCycleStatement(cycleStmt));
      }
      pushLine('}');
      continue;
    }

    if (stmt.kind === 'for') {
      pushLine(`${stmt.header} {`);
      emitStructuredBodyAsEntries(stmt.body, entries);
      pushLine('}');
      continue;
    }

    if (stmt.kind === 'if') {
      pushLine(`if (${stmt.condition}) at @${stmt.control.row},${stmt.control.col} {`);
      emitStructuredBodyAsEntries(stmt.thenBody, entries);
      pushLine('}');
      if (stmt.elseBody && stmt.elseBody.length > 0) {
        pushLine('else {');
        emitStructuredBodyAsEntries(stmt.elseBody, entries);
        pushLine('}');
      }
      continue;
    }

    if (stmt.kind === 'while') {
      pushLine(`while (${stmt.condition}) at @${stmt.control.row},${stmt.control.col} {`);
      emitStructuredBodyAsEntries(stmt.body, entries);
      pushLine('}');
      continue;
    }

    pushLine(`${stmt.name}(${stmt.args.join(', ')});`);
  }
}

function lowerStructuredBodyWithExpansionKernel(structured: StructuredProgramAst): KernelAst {
  const kernel = structured.kernel!;
  const loweredKernel: KernelAst = {
    name: kernel.name,
    config: kernel.config,
    directives: kernel.directives,
    pragmas: [],
    cycles: [],
    span: kernel.span
  };
  const entries: SourceLineEntry[] = [];
  emitStructuredBodyAsEntries(kernel.body, entries);

  const diagnostics: Diagnostic[] = [];
  const constants = buildConstantMap(loweredKernel.directives, diagnostics);
  const cycleCounter = { value: 0 };
  expandFunctionBodyIntoKernel(
    entries,
    loweredKernel,
    new Map(),
    constants,
    diagnostics,
    cycleCounter,
    [],
    { value: 0 },
    { value: 0 }
  );

  loweredKernel.cycles = loweredKernel.cycles.map((cycle, index) => ({ ...cycle, index }));
  return loweredKernel;
}

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
    const open = pragma.text.indexOf('(');
    const close = pragma.text.lastIndexOf(')');
    const name = open > 0 ? pragma.text.slice(0, open).trim() : pragma.text.trim();
    const args = open >= 0 && close > open ? pragma.text.slice(open + 1, close).trim() : '';
    body.push({
      kind: 'advanced',
      name,
      args,
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

  const loweredKernel = lowerStructuredBodyWithExpansionKernel(structured);

  return {
    targetProfileId: structured.targetProfileId,
    kernel: loweredKernel,
    span: structured.span
  };
}
