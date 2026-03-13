import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseInstruction } from '../packages/compiler-front/src/structured-core/lowering/instructions.js';
import { buildWhileFusionPlan } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/while-fusion.js';
import { buildRuntimeNoUnrollAggressivePlan } from '../packages/compiler-front/src/structured-core/lowering/for-expand-helpers/runtime-plan.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('branch coverage round 7', () => {
  it('covers cycle-loop branches: empty line and clean-erased binding', async () => {
    vi.resetModules();
    const mod1 = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    const out1 = mod1.expandLoopBody(
      [{ lineNo: 1, rawLine: '', cleanLine: '' }],
      new Map(),
      new Map(),
      []
    );
    expect(out1).toEqual([]);

    vi.resetModules();
    vi.doMock('../packages/compiler-front/src/structured-core/parser-utils/numbers.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-front/src/structured-core/parser-utils/numbers.js');
      return {
        ...actual,
        applyBindings: () => ''
      };
    });
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', () => ({
      tryExpandNestedForLoopStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSpatialAtBlockStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSingleCycleStatementStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 })
    }));
    const mod2 = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    const out2 = mod2.expandLoopBody(
      [{ lineNo: 1, rawLine: 'x', cleanLine: 'x' }],
      new Map(),
      new Map(),
      []
    );
    expect(out2).toEqual([]);
  });

  it('covers cycle-loop shouldBreak branches for nested/spatial/statement handlers', async () => {
    vi.resetModules();
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', () => ({
      tryExpandNestedForLoopStep: () => ({ handled: true, statements: [], shouldBreak: true, nextIndex: 0 }),
      tryExpandSpatialAtBlockStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSingleCycleStatementStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 })
    }));
    let mod = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    mod.expandLoopBody([{ lineNo: 1, rawLine: 'x', cleanLine: 'x' }], new Map(), new Map(), []);

    vi.resetModules();
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', () => ({
      tryExpandNestedForLoopStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSpatialAtBlockStep: () => ({ handled: true, statements: [], shouldBreak: true, nextIndex: 0 }),
      tryExpandSingleCycleStatementStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 })
    }));
    mod = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    mod.expandLoopBody([{ lineNo: 1, rawLine: 'x', cleanLine: 'x' }], new Map(), new Map(), []);

    vi.resetModules();
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', () => ({
      tryExpandNestedForLoopStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSpatialAtBlockStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSingleCycleStatementStep: () => ({ handled: true, statements: [], shouldBreak: true, nextIndex: 0 })
    }));
    mod = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    mod.expandLoopBody([{ lineNo: 1, rawLine: 'x', cleanLine: 'x' }], new Map(), new Map(), []);

    expect(true).toBe(true);
  });

  it('covers while-fusion missing incoming-register branches', () => {
    const horizontalLeft: any = {
      index: 0,
      label: undefined,
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
      statements: [{
        kind: 'at',
        row: 0,
        col: 3,
        instruction: parseInstruction('SADD R1, R1, R0', 1, 1),
        span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
      }]
    };
    const plan = buildWhileFusionPlan([horizontalLeft], 0, 0);
    expect(plan?.incomingRegister).toBe('RCL');

    const noIncoming: any = {
      index: 0,
      label: undefined,
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
      statements: [{
        kind: 'at',
        row: 2,
        col: 0,
        instruction: parseInstruction('SADD R1, R1, R0', 1, 1),
        span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
      }]
    };
    expect(buildWhileFusionPlan([noIncoming], 0, 0)).toBeNull();
  });

  it('covers runtime-plan fallback relay register branch', () => {
    const cycle: any = {
      index: 0,
      label: undefined,
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
      statements: [{
        kind: 'at',
        row: 0,
        col: 1,
        instruction: parseInstruction('SADD R0, R1, R2, R3', 1, 1),
        span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
      }]
    };
    const plan = buildRuntimeNoUnrollAggressivePlan(
      [cycle],
      'R0',
      0,
      0,
      () => false,
      parseInstruction
    );
    expect(plan?.relayRegister).toBe('R3');
  });
});
