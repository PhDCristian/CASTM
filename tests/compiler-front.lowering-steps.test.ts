import { describe, expect, it } from 'vitest';
import { ErrorCodes, spanAt } from '@castm/compiler-ir';
import {
  tryExpandNestedForLoopStep,
  tryExpandSingleCycleStatementStep,
  tryExpandSpatialAtBlockStep
} from '../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js';
import { tryExpandCycleStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-cycle.js';

function inst(opcode: string, operands: string[] = []) {
  return {
    text: operands.length ? `${opcode} ${operands.join(', ')}` : opcode,
    opcode,
    operands,
    span: spanAt(1, 1, 1)
  };
}

function entry(lineNo: number, cleanLine: string) {
  return {
    lineNo,
    rawLine: cleanLine,
    cleanLine
  };
}

describe('compiler-front lowering cycle/function step handlers', () => {
  it('handles nested for-loop step paths (no-match, control/modifier errors, unterminated, expanded)', () => {
    const noMatch = tryExpandNestedForLoopStep(
      {
        body: [entry(1, 'noop')],
        index: 0,
        entry: entry(1, 'noop'),
        clean: 'noop',
        raw: 'noop',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: []
      },
      () => []
    );
    expect(noMatch).toMatchObject({ handled: false, nextIndex: 0, shouldBreak: false });

    const controlDiagnostics: any[] = [];
    const controlResult = tryExpandNestedForLoopStep(
      {
        body: [entry(2, 'for i in range(0, 2) at @0,0 {')],
        index: 0,
        entry: entry(2, 'for i in range(0, 2) at @0,0 {'),
        clean: 'for i in range(0, 2) at @0,0 {',
        raw: 'for i in range(0, 2) at @0,0 {',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: controlDiagnostics
      },
      () => []
    );
    expect(controlResult.handled).toBe(true);
    expect(controlDiagnostics[0].code).toBe(ErrorCodes.Parse.InvalidSyntax);
    expect(controlDiagnostics[0].message).toContain('Control location @row,col is not supported');

    const unrollDiagnostics: any[] = [];
    const unrollResult = tryExpandNestedForLoopStep(
      {
        body: [entry(2, 'for i in range(0, 4) unroll(2) {')],
        index: 0,
        entry: entry(2, 'for i in range(0, 4) unroll(2) {'),
        clean: 'for i in range(0, 4) unroll(2) {',
        raw: 'for i in range(0, 4) unroll(2) {',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: unrollDiagnostics
      },
      () => []
    );
    expect(unrollResult.handled).toBe(true);
    expect(unrollDiagnostics[0].code).toBe(ErrorCodes.Parse.InvalidSyntax);
    expect(unrollDiagnostics[0].message).toContain('unroll(k) is not supported');

    const unterminatedDiagnostics: any[] = [];
    const unterminated = tryExpandNestedForLoopStep(
      {
        body: [entry(3, 'for i in range(0, 3) {'), entry(4, '@0,i: NOP;')],
        index: 0,
        entry: entry(3, 'for i in range(0, 3) {'),
        clean: 'for i in range(0, 3) {',
        raw: 'for i in range(0, 3) {',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: unterminatedDiagnostics
      },
      () => []
    );
    expect(unterminated).toMatchObject({ handled: true, shouldBreak: true });
    expect(unterminatedDiagnostics[0].message).toContain('Unterminated for loop');

    const expandedDiagnostics: any[] = [];
    const expanded = tryExpandNestedForLoopStep(
      {
        body: [entry(5, 'for i in range(3, 0, -1) {'), entry(6, '@0,i: NOP;'), entry(7, '}')],
        index: 0,
        entry: entry(5, 'for i in range(3, 0, -1) {'),
        clean: 'for i in range(3, 0, -1) {',
        raw: 'for i in range(3, 0, -1) {',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: expandedDiagnostics
      },
      (_nestedBody, _constants, bindings) => [
        {
          kind: 'at' as const,
          row: 0,
          col: bindings.get('i') ?? -1,
          instruction: inst('NOP'),
          span: spanAt(6, 1, 1)
        }
      ]
    );
    expect(expandedDiagnostics).toHaveLength(0);
    expect(expanded.handled).toBe(true);
    expect(expanded.nextIndex).toBe(2);
    expect(expanded.statements.map((s: any) => s.col)).toEqual([3, 2, 1]);
  });

  it('handles spatial-at block step paths (no-match, invalid coords, unterminated, expanded)', () => {
    const noMatch = tryExpandSpatialAtBlockStep(
      {
        body: [entry(1, '@0,0: NOP;')],
        index: 0,
        entry: entry(1, '@0,0: NOP;'),
        clean: '@0,0: NOP;',
        raw: '@0,0: NOP;',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: []
      }
    );
    expect(noMatch.handled).toBe(false);

    const invalidDiagnostics: any[] = [];
    const invalid = tryExpandSpatialAtBlockStep(
      {
        body: [entry(2, 'at @x,1 {')],
        index: 0,
        entry: entry(2, 'at @x,1 {'),
        clean: 'at @x,1 {',
        raw: 'at @x,1 {',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: invalidDiagnostics
      }
    );
    expect(invalid.handled).toBe(true);
    expect(invalid.statements).toHaveLength(0);
    expect(invalidDiagnostics[0].code).toBe(ErrorCodes.Parse.InvalidSyntax);

    const unterminatedDiagnostics: any[] = [];
    const unterminated = tryExpandSpatialAtBlockStep(
      {
        body: [entry(3, 'at @0,1 {'), entry(4, 'NOP;')],
        index: 0,
        entry: entry(3, 'at @0,1 {'),
        clean: 'at @0,1 {',
        raw: 'at @0,1 {',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: unterminatedDiagnostics
      }
    );
    expect(unterminated.handled).toBe(true);
    expect(unterminated.shouldBreak).toBe(true);
    expect(unterminatedDiagnostics[0].message).toContain('Unterminated spatial at-block');

    const okDiagnostics: any[] = [];
    const ok = tryExpandSpatialAtBlockStep(
      {
        body: [entry(5, 'at @0,2 {'), entry(6, 'SADD R1, R2, R3; NOP;'), entry(7, '}')],
        index: 0,
        entry: entry(5, 'at @0,2 {'),
        clean: 'at @0,2 {',
        raw: 'at @0,2 {',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: okDiagnostics
      }
    );
    expect(okDiagnostics).toHaveLength(0);
    expect(ok.handled).toBe(true);
    expect(ok.nextIndex).toBe(2);
    expect(ok.statements).toHaveLength(2);
    expect((ok.statements[0] as any).col).toBe(2);
  });

  it('handles single cycle statement step errors and valid statement parse', () => {
    const closeDiagnostics: any[] = [];
    const close = tryExpandSingleCycleStatementStep(
      {
        body: [entry(1, '}')],
        index: 0,
        entry: entry(1, '}'),
        clean: '}',
        raw: '}',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: closeDiagnostics
      }
    );
    expect(close.handled).toBe(true);
    expect(closeDiagnostics[0].message).toContain('Unexpected closing brace');

    const invalidDiagnostics: any[] = [];
    const invalid = tryExpandSingleCycleStatementStep(
      {
        body: [entry(2, 'bad statement')],
        index: 0,
        entry: entry(2, 'bad statement'),
        clean: 'bad statement',
        raw: 'bad statement',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: invalidDiagnostics
      }
    );
    expect(invalid.handled).toBe(true);
    expect(invalid.statements).toHaveLength(0);
    expect(invalidDiagnostics[0].message).toContain('Invalid cycle statement');

    const okDiagnostics: any[] = [];
    const ok = tryExpandSingleCycleStatementStep(
      {
        body: [entry(3, '@0,0: NOP;')],
        index: 0,
        entry: entry(3, '@0,0: NOP;'),
        clean: '@0,0: NOP;',
        raw: '@0,0: NOP;',
        constants: new Map(),
        bindings: new Map(),
        diagnostics: okDiagnostics
      }
    );
    expect(okDiagnostics).toHaveLength(0);
    expect(ok.statements).toHaveLength(1);
    expect((ok.statements[0] as any).kind).toBe('at');
  });

  it('handles function cycle expansion branches', () => {
    const makeInput = (body: Array<{ lineNo: number; cleanLine: string }>, index = 0) => {
      const kernel: any = {
        name: 'k',
        config: undefined,
        directives: [],
        pragmas: [],
        cycles: [],
        span: spanAt(1, 1, 1)
      };
      const entryObj = {
        lineNo: body[index].lineNo,
        cleanLine: body[index].cleanLine,
        rawLine: body[index].cleanLine
      };
      return {
        input: {
          body: body.map((x) => ({ ...x, rawLine: x.cleanLine })),
          index,
          entry: entryObj,
          clean: entryObj.cleanLine,
          kernel,
          functions: new Map(),
          constants: new Map(),
          diagnostics: [] as any[],
          cycleCounter: { value: 0 },
          callStack: [],
          expansionCounter: { value: 0 },
          controlFlowCounter: { value: 0 },
          expandBody: () => {}
        },
        kernel
      };
    };

    const inlineLabeled = makeInput([{ lineNo: 1, cleanLine: 'L0: bundle { @0,0: NOP; }' }]);
    const inlineLabeledResult = tryExpandCycleStatement(inlineLabeled.input as any);
    expect(inlineLabeledResult.handled).toBe(true);
    expect(inlineLabeled.kernel.cycles).toHaveLength(1);
    expect(inlineLabeled.kernel.cycles[0].label).toBe('L0');

    const labeledUnterminated = makeInput([{ lineNo: 2, cleanLine: 'L1: bundle {' }]);
    const labeledUnterminatedResult = tryExpandCycleStatement(labeledUnterminated.input as any);
    expect(labeledUnterminatedResult.shouldBreak).toBe(true);
    expect(labeledUnterminated.input.diagnostics[0].message).toContain('Unterminated labeled bundle');

    const labeledBlock = makeInput([
      { lineNo: 3, cleanLine: 'L2: bundle {' },
      { lineNo: 4, cleanLine: '@0,0: NOP;' },
      { lineNo: 5, cleanLine: '}' }
    ]);
    const labeledBlockResult = tryExpandCycleStatement(labeledBlock.input as any);
    expect(labeledBlockResult.handled).toBe(true);
    expect(labeledBlockResult.nextIndex).toBe(2);
    expect(labeledBlock.kernel.cycles).toHaveLength(1);
    expect(labeledBlock.kernel.cycles[0].label).toBe('L2');

    const inlineCycle = makeInput([{ lineNo: 6, cleanLine: 'bundle { @0,0: NOP; }' }]);
    const inlineCycleResult = tryExpandCycleStatement(inlineCycle.input as any);
    expect(inlineCycleResult.handled).toBe(true);
    expect(inlineCycle.kernel.cycles).toHaveLength(1);
    expect(inlineCycle.kernel.cycles[0].label).toBeUndefined();

    const nonCycle = makeInput([{ lineNo: 7, cleanLine: 'foo();' }]);
    const nonCycleResult = tryExpandCycleStatement(nonCycle.input as any);
    expect(nonCycleResult).toMatchObject({ handled: false, shouldBreak: false });

    const cycleUnterminated = makeInput([{ lineNo: 8, cleanLine: 'bundle {' }]);
    const cycleUnterminatedResult = tryExpandCycleStatement(cycleUnterminated.input as any);
    expect(cycleUnterminatedResult.handled).toBe(true);
    expect(cycleUnterminatedResult.shouldBreak).toBe(true);
    expect(cycleUnterminated.input.diagnostics[0].message).toContain('Unterminated bundle block');
  });
});
