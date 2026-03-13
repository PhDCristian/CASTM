import { afterEach, describe, expect, it, vi } from 'vitest';
import { spanAt } from '@castm/compiler-ir';
import { parseIntegerLiteral } from '../packages/compiler-api/src/passes-shared/pragma-args-utils.js';
import { parseRoutePragmaArgs } from '../packages/compiler-api/src/passes-shared/route-args.js';
import {
  parseBroadcastPragmaArgs,
  parseGatherPragmaArgs,
  parseStencilPragmaArgs
} from '../packages/compiler-api/src/passes-shared/advanced-args.js';
import { parseForHeader } from '../packages/compiler-front/src/structured-core/lowering/control-flow-for.js';
import {
  buildRuntimeNoUnrollAggressivePlan,
  chooseJumpColumn
} from '../packages/compiler-front/src/structured-core/lowering/for-expand-helpers/runtime-plan.js';
import { buildWhileFusionPlan } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/while-fusion.js';
import { bindFunctionCallArgs } from '../packages/compiler-front/src/structured-core/lowering/functions/bind.js';
import { parseFunctionCall } from '../packages/compiler-front/src/structured-core/statements/matchers.js';

const span = spanAt(1, 1, 1);

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('branch coverage round 11', () => {
  it('covers parseIntegerLiteral both ternary arms for hex sign/raw', () => {
    expect(parseIntegerLiteral('0x10')).toBe(16);
    expect(parseIntegerLiteral('-0x10')).toBe(-16);
  });

  it('covers route custom-op empty-operand guard branch via controlled split mock', async () => {
    vi.doMock('../packages/compiler-api/src/passes-shared/pragma-args-utils.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/pragma-args-utils.js');
      return {
        ...actual,
        splitPositionalArgs: () => ['R1', ' ', 'R2']
      };
    });

    const routeArgs = await import('../packages/compiler-api/src/passes-shared/route-args.js');
    const parsed = routeArgs.parseRoutePragmaArgs('route(@0,0 -> @0,1, payload=R0, dest=R1, op=ADD(R1,R2,R3))');
    expect(parsed).toBeNull();
  });

  it('covers broadcast fallback short-circuit branches and invalid identifier path', async () => {
    vi.doMock('../packages/compiler-api/src/passes-shared/route-args.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/route-args.js');
      return {
        ...actual,
        parseCoordinateLiteral: () => ({ row: 0, col: 0 })
      };
    });
    const { parseBroadcastPragmaArgs: parseBroadcastFallback } = await import('../packages/compiler-api/src/passes-shared/advanced-args/broadcast.js');

    expect(parseBroadcastFallback('broadcast(from=(0,0), to=row)')).toBeNull();
    expect(parseBroadcastFallback('broadcast(from=(0,0), value=1, to=row)')).toBeNull();

    expect(parseBroadcastFallback('broadcast(from=(0,0), value=R1, to=column)')).toMatchObject({ scope: 'column' });
    expect(parseBroadcastFallback('broadcast(from=(0,0), value=R1, to=all)')).toMatchObject({ scope: 'all' });
    expect(parseBroadcastFallback('broadcast(from=(0,0), value=R1, to=diag)')).toBeNull();
  });

  it('covers collectives fallback and ternary/default branches', () => {
    expect(parseStencilPragmaArgs('stencil(cross, R0, R1)')).toMatchObject({ operation: 'sum', srcReg: 'R0', destReg: 'R1' });

    expect(parseGatherPragmaArgs('gather(dest=@0,0,destreg=R1,op=add)')).toBeNull();
    expect(parseGatherPragmaArgs('gather(dest=@0,0,src=R0,destreg=R1,op=1)')).toBeNull();
  });

  it('covers gather fallback missing-op and invalid-op identifier branches via coordinate parser mock', async () => {
    vi.doMock('../packages/compiler-api/src/passes-shared/route-args.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/route-args.js');
      return {
        ...actual,
        parseCoordinateLiteral: () => ({ row: 0, col: 0 })
      };
    });
    const collectives = await import('../packages/compiler-api/src/passes-shared/advanced-args/collectives.js');

    expect(collectives.parseGatherPragmaArgs('gather(src=R0,dest=@0,destreg=R1)')).toBeNull();
    expect(collectives.parseGatherPragmaArgs('gather(src=R0,dest=@0,destreg=R1,op=1)')).toBeNull();
  });

  it('covers parseForHeader nullish control-location branches via custom match payloads', () => {
    const diagnostics: any[] = [];

    const fakeRowMissing: any = {
      length: 30,
      match: () => ['for ...', 'i', '0,2', undefined, '1', undefined]
    };
    expect(parseForHeader(fakeRowMissing as any, 1, new Map(), new Map(), diagnostics)).toBeNull();

    const fakeColMissing: any = {
      length: 30,
      match: () => ['for ...', 'i', '0,2', '0', undefined, undefined]
    };
    expect(parseForHeader(fakeColMissing as any, 2, new Map(), new Map(), diagnostics)).toBeNull();

    expect(diagnostics.some((d: any) => d.message.includes("Invalid control location '@,1'"))).toBe(true);
    expect(diagnostics.some((d: any) => d.message.includes("Invalid control location '@0,'"))).toBe(true);
  });

  it('covers chooseJumpColumn fallback-return branch by temporarily emptying array iteration', () => {
    const originalIterator = Array.prototype[Symbol.iterator];
    try {
      // Force no loop iterations inside chooseJumpColumn(...) once.
      (Array.prototype as any)[Symbol.iterator] = function* () {
        if (Array.isArray(this) && this.length === 3 && this[0] === 1 && this[1] === 2 && this[2] === 3) {
          return;
        }
        yield* originalIterator.call(this);
      };

      expect(chooseJumpColumn(0, 1)).toBe(0);
    } finally {
      (Array.prototype as any)[Symbol.iterator] = originalIterator;
    }
  });

  it('covers runtime-plan and while-fusion remaining local-direction branches', () => {
    const parseInst = (text: string) => ({ text, opcode: text.split(' ')[0], operands: [], span } as any);

    const sameRowLeft: any = {
      index: 0,
      label: undefined,
      span,
      statements: [{ kind: 'at', row: 0, col: 3, instruction: parseInst('SADD R1, R0, IMM(1)'), span }]
    };
    const p = buildRuntimeNoUnrollAggressivePlan([sameRowLeft], 'R0', 0, 0, () => false, parseInst);
    expect(p?.incomingRegister).toBe('RCR');

    const sameRowNoNeighbor: any = {
      index: 0,
      label: undefined,
      span,
      statements: [{ kind: 'at', row: 0, col: 2, instruction: parseInst('SADD R1, R1, R0'), span }]
    };
    expect(buildWhileFusionPlan([sameRowNoNeighbor], 0, 0)).toBeNull();
  });

  it('covers bind usagePreview true arm and matcher empty-args arm', () => {
    const diagnosticsMany: any[] = [];
    expect(bindFunctionCallArgs({ name: 'f', params: ['a', 'b'] }, ['a: 1', '2'], 1, diagnosticsMany)).toBeNull();
    expect(diagnosticsMany.some((d: any) => String(d.hint).includes('f(a, b: value)'))).toBe(true);

    const diagnosticsOne: any[] = [];
    expect(bindFunctionCallArgs({ name: 'g', params: ['x'] }, ['x: 1', '2'], 1, diagnosticsOne)).toBeNull();
    expect(diagnosticsOne.some((d: any) => String(d.hint).includes('g(x: value)'))).toBe(true);

    expect(parseFunctionCall('foo()')?.args).toEqual([]);
  });

  it('keeps route parser direct path reachable sanity check', () => {
    expect(parseRoutePragmaArgs('route(@0,0 -> @0,1, payload=R0, accum=R1)')).toMatchObject({ payload: 'R0' });
  });
});
