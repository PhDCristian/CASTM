import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildWhileFusionPlan } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/while-fusion.js';
import { parseInstruction } from '../packages/compiler-front/src/structured-core/lowering/instructions.js';
import { collectBlockFromSource } from '../packages/compiler-front/src/structured-core/parser-utils/blocks.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('branch coverage round 8', () => {
  it('covers compile-driver optional artifact/fallback branches with mocks', async () => {
    const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };
    const parseErrorAst: any = { targetProfileId: null, span, kernel: null };

    vi.doMock('../packages/compiler-api/src/compiler-driver/parse-driver.js', () => ({
      parse: () => ({
        success: false,
        diagnostics: [{ severity: 'error' }],
        ast: parseErrorAst,
        structuredAst: undefined
      })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/runtime-artifacts.js', () => ({
      collectRuntimeArtifacts: () => ({
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        cycleLimit: undefined,
        assertions: [],
        symbols: { constants: {}, aliases: {}, labels: {} }
      }),
      createEmptyRuntimeArtifacts: () => ({
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        cycleLimit: undefined,
        assertions: [],
        symbols: { constants: {}, aliases: {}, labels: {} }
      })
    }));
    const modA = await import('../packages/compiler-api/src/compiler-driver/compile-driver.js');
    const resultA = modA.compile('kernel "k" {}', { emitArtifacts: [] as any });
    expect(resultA.artifacts.ast).toBeUndefined();
    expect(resultA.artifacts.structuredAst).toBeUndefined();
    expect(resultA.stats.cycles).toBe(0);

    vi.resetModules();
    vi.doMock('../packages/compiler-api/src/compiler-driver/parse-driver.js', () => ({
      parse: () => ({
        success: true,
        diagnostics: [],
        ast: { targetProfileId: null, span, kernel: null },
        structuredAst: undefined
      })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/analyze-driver.js', () => ({
      analyze: () => ({
        diagnostics: [],
        ast: { targetProfileId: null, span, kernel: null },
        hir: undefined,
        mir: undefined,
        lir: undefined,
        memoryRegions: undefined,
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        cycleLimit: undefined,
        assertions: [],
        symbols: { constants: {}, aliases: {}, labels: {} },
        loweredPasses: []
      })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/runtime-artifacts.js', () => ({
      collectRuntimeArtifacts: () => ({
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        cycleLimit: undefined,
        assertions: [],
        symbols: { constants: {}, aliases: {}, labels: {} }
      }),
      createEmptyRuntimeArtifacts: () => ({
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        cycleLimit: undefined,
        assertions: [],
        symbols: { constants: {}, aliases: {}, labels: {} }
      })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/emit-driver.js', () => ({
      emit: () => ({ csv: '', diagnostics: [] })
    }));
    const modB = await import('../packages/compiler-api/src/compiler-driver/compile-driver.js');
    const resultB = modB.compile('kernel "k" {}', { emitArtifacts: ['hir'] as any });
    expect(resultB.artifacts.ast).toBeUndefined();
    expect(resultB.artifacts.memoryRegions).toEqual([]);
    expect(resultB.stats.cycles).toBe(0);
  });

  it('covers collectives gather fallback-return branch via parser mocks', async () => {
    vi.doMock('../packages/compiler-api/src/passes-shared/pragma-args-utils.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/pragma-args-utils.js');
      return {
        ...actual,
        parseKeyValueArgs: () => new Map([
          ['src', 'R0'],
          ['dest', '@1,2'],
          ['destreg', 'R1'],
          ['op', 'xor']
        ])
      };
    });
    vi.doMock('../packages/compiler-api/src/passes-shared/route-args.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/route-args.js');
      return {
        ...actual,
        parseCoordinateLiteral: () => ({ row: 1, col: 2 })
      };
    });
    const collectives = await import('../packages/compiler-api/src/passes-shared/advanced-args/collectives.js');
    const parsed = collectives.parseGatherPragmaArgs('gather(anything)');
    expect(parsed).toMatchObject({
      srcReg: 'R0',
      destReg: 'R1',
      operation: 'xor'
    });
  });

  it('covers while-fusion primary horizontal branch and block depth bootstrap branch', () => {
    const cycle: any = {
      index: 0,
      label: undefined,
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
      statements: [{
        kind: 'at',
        row: 0,
        col: 1,
        instruction: parseInstruction('SADD R1, R1, R0', 1, 1),
        span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
      }]
    };
    const plan = buildWhileFusionPlan([cycle], 0, 0);
    expect(plan?.incomingRegister).toBe('RCR');

    const block = collectBlockFromSource(['header-without-brace', 'body', '}'], 0);
    expect(block.endIndex).toBe(2);
  });
});
