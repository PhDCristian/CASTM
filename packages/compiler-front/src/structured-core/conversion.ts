import {
  AstProgram,
  CycleAst,
  CycleStatementAst,
  Diagnostic,
  ExpansionMode,
  KernelAst,
  PragmaAst,
  StructuredKernelStmtAst,
  StructuredProgramAst
} from '@castm/compiler-ir';
import { cloneAstProgram } from './utils.js';
import { SourceLineEntry } from './parser-utils/blocks.js';
import { buildConstantMap } from './lowering/top-level-scope/constants.js';
import { expandFunctionBodyIntoKernel } from './lowering/function-expand.js';
import { createFunctionExpansionContext } from './lowering/function-expand-context.js';

export interface LowerStructuredProgramResult {
  ast: AstProgram;
  diagnostics: Diagnostic[];
}

export interface LowerStructuredProgramOptions {
  expansionMode?: ExpansionMode;
  jumpReuseDepth?: number;
}

function resolveExpansionMode(
  structured: StructuredProgramAst,
  options?: LowerStructuredProgramOptions
): ExpansionMode {
  if (structured.build?.expansionMode) return structured.build.expansionMode;
  if (options?.expansionMode) return options.expansionMode;
  return 'full-unroll';
}

function resolveJumpReuseDepth(
  structured: StructuredProgramAst,
  options?: LowerStructuredProgramOptions
): number {
  if (structured.build?.jumpReuseDepth !== undefined) return structured.build.jumpReuseDepth;
  if (options?.jumpReuseDepth !== undefined) return options.jumpReuseDepth;
  return 0;
}

function renderCycleStatement(statement: CycleStatementAst): string {
  if (statement.kind === 'at') {
    return `@${statement.row},${statement.col}: ${statement.instruction.text};`;
  }
  if (statement.kind === 'at-expr') {
    return `@${statement.rowExpr},${statement.colExpr}: ${statement.instruction.text};`;
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
      const labelPrefix = stmt.label ? `${stmt.label}: ` : '';
      if (stmt.sourceForm === 'qualified' || stmt.namespace === 'std') {
        pushLine(`${labelPrefix}std::${stmt.name}(${stmt.args});`);
      } else {
        pushLine(`${labelPrefix}${stmt.text};`);
      }
      continue;
    }

    if (stmt.kind === 'cycle') {
      const prefix = stmt.cycle.label ? `${stmt.cycle.label}: ` : '';
      pushLine(`${prefix}bundle {`);
      for (const cycleStmt of stmt.cycle.statements) {
        pushLine(renderCycleStatement(cycleStmt));
      }
      pushLine('}');
      continue;
    }

    if (stmt.kind === 'for') {
      const labelPrefix = stmt.label ? `${stmt.label}: ` : '';
      pushLine(`${labelPrefix}${stmt.header} {`);
      emitStructuredBodyAsEntries(stmt.body, entries);
      pushLine('}');
      continue;
    }

    if (stmt.kind === 'if') {
      const labelPrefix = stmt.label ? `${stmt.label}: ` : '';
      pushLine(`${labelPrefix}if (${stmt.condition}) at @${stmt.control.row},${stmt.control.col} {`);
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
      const labelPrefix = stmt.label ? `${stmt.label}: ` : '';
      pushLine(`${labelPrefix}while (${stmt.condition}) at @${stmt.control.row},${stmt.control.col} {`);
      emitStructuredBodyAsEntries(stmt.body, entries);
      pushLine('}');
      continue;
    }

    if (stmt.kind === 'break') {
      pushLine(`break${stmt.targetLabel ? ` ${stmt.targetLabel}` : ''};`);
      continue;
    }

    if (stmt.kind === 'continue') {
      pushLine(`continue${stmt.targetLabel ? ` ${stmt.targetLabel}` : ''};`);
      continue;
    }

    const fnLabelPrefix = stmt.label ? `${stmt.label}: ` : '';
    pushLine(`${fnLabelPrefix}${stmt.name}(${stmt.args.join(', ')});`);
  }
}

// ── NOP landing-pad elimination ──────────────────────────────────────
// After jump-reuse expansion each call emits:
//   CALL cycle  (SADD + JUMP)
//   NOP cycle   (labeled with __ret_label_N)
//
// By forwarding the NOP's label to the next non-NOP cycle we save one
// cycle per call and remove scheduler barriers.

function isNopText(text: string): boolean {
  const t = text.trim();
  return t === '' || t.toUpperCase() === 'NOP' || t === '_';
}

function cycleIsNoopOnly(cycle: CycleAst): boolean {
  if (cycle.statements.length === 0) return true;
  return cycle.statements.every((s: CycleStatementAst) => {
    if (s.kind === 'row') {
      return s.instructions.every((i) => isNopText(i.text));
    }
    return isNopText(s.instruction.text);
  });
}

function eliminateNoopLandingPads(cycles: CycleAst[], pragmas: PragmaAst[]): CycleAst[] {
  const result: CycleAst[] = [];
  let pendingLabel: string | undefined;

  // Track old-index → new-index mapping so we can fix pragma anchors.
  // -1 = removed (will be patched to the forwarded target afterwards).
  const newIndexOf: number[] = new Array(cycles.length).fill(-1);

  for (let origIdx = 0; origIdx < cycles.length; origIdx++) {
    const cycle = cycles[origIdx];
    const noop = cycleIsNoopOnly(cycle);

    // 1. Apply any pending label from a previously-skipped NOP.
    if (pendingLabel) {
      if (!cycle.label) {
        cycle.label = pendingLabel;
        pendingLabel = undefined;
      } else {
        // Both pending and current have labels — emit a bare labeled
        // cycle to preserve the pending label (rare edge-case).
        result.push({
          index: 0,
          label: pendingLabel,
          statements: [],
          span: cycle.span
        });
        pendingLabel = undefined;
      }
    }

    // 2. Labeled NOP: defer the label to the next useful cycle.
    if (noop && cycle.label) {
      pendingLabel = cycle.label;
      // newIndexOf[origIdx] stays -1 (removed)
      continue;
    }

    // 3. Keep everything else.
    newIndexOf[origIdx] = result.length;
    result.push(cycle);
  }

  // Trailing pending label — emit a final labeled empty cycle.
  if (pendingLabel) {
    // pendingLabel can only exist if at least one cycle was visited.
    const lastSpan = cycles[cycles.length - 1].span;
    result.push({
      index: 0,
      label: pendingLabel,
      statements: [],
      span: lastSpan
    });
  }

  // Fix up removed-cycle mappings: point to the next kept cycle
  // (where the label was forwarded).
  for (let i = newIndexOf.length - 1; i >= 0; i--) {
    if (newIndexOf[i] === -1) {
      const next = i + 1 < newIndexOf.length ? newIndexOf[i + 1] : result.length;
      newIndexOf[i] = next;
    }
  }

  // Re-map pragma anchor indices so they stay consistent.
  for (const pragma of pragmas) {
    if (pragma.anchorCycleIndex !== undefined && pragma.anchorCycleIndex < newIndexOf.length) {
      pragma.anchorCycleIndex = newIndexOf[pragma.anchorCycleIndex];
    }
  }

  return result;
}

// ── End NOP elimination ──────────────────────────────────────────────

function lowerStructuredBodyWithExpansionKernel(
  structured: StructuredProgramAst,
  options?: LowerStructuredProgramOptions
): { kernel: KernelAst; diagnostics: Diagnostic[] } {
  const kernel = structured.kernel!;
  const loweredKernel: KernelAst = {
    name: kernel.name,
    config: kernel.config,
    directives: kernel.directives,
    runtime: kernel.runtime ?? [],
    pragmas: [],
    cycles: [],
    span: kernel.span
  };
  const entries: SourceLineEntry[] = [];
  emitStructuredBodyAsEntries(kernel.body, entries);

  const diagnostics: Diagnostic[] = [];
  const constants = buildConstantMap(loweredKernel.directives, diagnostics);
  const cycleCounter = { value: 0 };
  const expansionContext = createFunctionExpansionContext(
    resolveExpansionMode(structured, options),
    resolveJumpReuseDepth(structured, options)
  );
  const functions = new Map(
    structured.functions.map((fn) => {
      const fnEntries: SourceLineEntry[] = [];
      emitStructuredBodyAsEntries(fn.body, fnEntries);
      return [
        fn.name,
        {
          name: fn.name,
          params: fn.params,
          body: fnEntries,
          span: fn.span,
          ...(fn.isMacro ? { isMacro: true } : {})
        }
      ] as const;
    })
  );
  expandFunctionBodyIntoKernel(
    entries,
    loweredKernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    [],
    { value: 1 },
    { value: 0 },
    expansionContext
  );

  // Eliminate NOP-only landing pads by forwarding their labels to the
  // next non-NOP cycle.  This removes the 1-cycle overhead per
  // jump-reuse call and allows downstream passes (latency-hide,
  // scheduler) to work with fewer barrier points.
  loweredKernel.cycles = eliminateNoopLandingPads(loweredKernel.cycles, loweredKernel.pragmas);

  loweredKernel.cycles = loweredKernel.cycles.map((cycle, index) => ({ ...cycle, index }));
  return {
    kernel: loweredKernel,
    diagnostics
  };
}

export function toStructuredProgramAst(ast: AstProgram): StructuredProgramAst {
  const cloned = cloneAstProgram(ast);
  if (!cloned.kernel) {
    return {
      targetProfileId: cloned.targetProfileId,
      target: cloned.target,
      ...(cloned.build ? { build: cloned.build } : {}),
      kernel: null,
      functions: [],
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
    target: cloned.target,
    ...(cloned.build ? { build: cloned.build } : {}),
    kernel: {
      name: cloned.kernel.name,
      config: cloned.kernel.config,
      directives: cloned.kernel.directives,
      runtime: cloned.kernel.runtime ?? [],
      body,
      span: cloned.kernel.span
    },
    functions: [],
    span: cloned.span
  };
}

export function lowerStructuredProgramToAst(structured: StructuredProgramAst): AstProgram {
  return lowerStructuredProgramToAstDetailed(structured).ast;
}

export function lowerStructuredProgramToAstDetailed(
  structured: StructuredProgramAst,
  options?: LowerStructuredProgramOptions
): LowerStructuredProgramResult {
  if (!structured.kernel) {
    return {
      ast: {
        targetProfileId: structured.targetProfileId,
        target: structured.target,
        ...(structured.build ? { build: structured.build } : {}),
        kernel: null,
        span: structured.span
      },
      diagnostics: []
    };
  }

  const lowered = lowerStructuredBodyWithExpansionKernel(structured, options);

  return {
    ast: {
      targetProfileId: structured.targetProfileId,
      target: structured.target,
      ...(structured.build ? { build: structured.build } : {}),
      kernel: lowered.kernel,
      span: structured.span
    },
    diagnostics: lowered.diagnostics
  };
}
