import { afterEach, describe, expect, it, vi } from 'vitest';
import { Diagnostic, ErrorCodes, spanAt } from '@castm/compiler-ir';
import { parseAssertionDirectiveValue } from '../packages/compiler-api/src/compiler-driver/assertions.js';
import { collectDirectiveArtifacts } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/directives.js';
import { parseRotateShiftPragmaArgs } from '../packages/compiler-api/src/passes-shared/advanced-args/rotate-shift.js';
import { parseStreamLoadPragmaArgs, parseStreamStorePragmaArgs } from '../packages/compiler-api/src/passes-shared/advanced-args/stream.js';
import { isStep, getIncomingRegister } from '../packages/compiler-api/src/passes-shared/grid-utils.js';
import { instantiateEntriesWithBindings } from '../packages/compiler-front/src/structured-core/lowering/for-expand-helpers/bindings.js';
import { buildWhileFusionPlan } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/while-fusion.js';
import { parseInstruction } from '../packages/compiler-front/src/structured-core/lowering/instructions.js';
import { expandFunctionBodyIntoKernel } from '../packages/compiler-front/src/structured-core/lowering/function-expand.js';
import { tryExpandWhileStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-while.js';
import { tryParseControlStatement } from '../packages/compiler-front/src/structured-core/statements/control-handler.js';
import {
  collectBlockFromEntries,
  collectBlockAfterOpenFromEntries
} from '../packages/compiler-front/src/structured-core/parser-utils/blocks.js';
import { parseStructuredProgramFromSource } from '../packages/compiler-front/src/structured-core/parse-source.js';

const span = spanAt(1, 1, 1);

function entry(lineNo: number, cleanLine: string, rawLine = cleanLine) {
  return { lineNo, cleanLine, rawLine };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('branch coverage round 4', () => {
  it('covers assertion parser object syntax and failures', () => {
    const ast: any = {
      target: { id: 'uma-cgra-base', raw: 'uma-cgra-base', span },
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: {
        name: 'k',
        config: undefined,
        directives: [],
        runtime: [],
        pragmas: [],
        cycles: [{ index: 7, statements: [], span }],
        span
      }
    };
    const ok = parseAssertionDirectiveValue(ast, span, 'assert(at=@0,1, reg=R1, equals=42)');
    expect('message' in ok).toBe(false);
    expect((ok as any).cycle).toBe(7);

    expect(parseAssertionDirectiveValue(ast, span, 'assert(bad payload)')).toMatchObject({
      message: expect.stringContaining('Invalid assert(...) payload')
    });
    expect(parseAssertionDirectiveValue(ast, span, 'assert(at=@-1,0, reg=R1, equals=1, cycle=0)')).toMatchObject({
      message: expect.stringContaining('Invalid assert row')
    });
    expect(parseAssertionDirectiveValue(ast, span, 'assert(at=@0,-1, reg=R1, equals=1, cycle=0)')).toMatchObject({
      message: expect.stringContaining('Invalid assert column')
    });
    expect(parseAssertionDirectiveValue(ast, span, 'assert(at=@0,0, reg=R1, equals=1, cycle=-1)')).toMatchObject({
      message: expect.stringContaining('Invalid assert cycle')
    });
    expect(parseAssertionDirectiveValue(ast, span, 'assert(at=@0,0, reg=R1, equals=nope, cycle=0)')).toMatchObject({
      message: expect.stringContaining('Invalid assert value')
    });
  });

  it('covers runtime directive artifact failures for io/assert/limit', () => {
    const diagnostics: Diagnostic[] = [];
    const ast: any = {
      target: { id: 'uma-cgra-base', raw: 'uma-cgra-base', span },
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: {
        name: 'k',
        config: undefined,
        cycles: [],
        pragmas: [],
        directives: [],
        runtime: [
          { kind: 'io_load', addresses: ['nope'], raw: 'io.load(nope)', span },
          { kind: 'io_store', addresses: [], raw: 'io.store()', span },
          { kind: 'io_store', addresses: ['-1'], raw: 'io.store(-1)', span },
          { kind: 'assert', at: { row: 'x', col: '0' }, reg: 'R1', equals: '1', raw: 'assert(at=@x,0, reg=R1, equals=1)', span },
          { kind: 'limit', value: 'nope', raw: 'limit(nope)', span }
        ],
        span
      }
    };
    const symbols: any = { constants: {}, aliases: {}, labels: {} };
    const artifacts = collectDirectiveArtifacts(ast, diagnostics, symbols);
    expect(artifacts.ioConfig.loadAddrs).toEqual([]);
    expect(artifacts.ioConfig.storeAddrs).toEqual([]);
    expect(artifacts.assertions).toEqual([]);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('covers rotate/shift and stream parser invalid branches', () => {
    expect(parseRotateShiftPragmaArgs('rotate(reg=R0, direction=up)', 'rotate')).toBeNull();
    expect(parseRotateShiftPragmaArgs('shift(reg=R0, direction=left, distance=1, fill=x)', 'shift')).toBeNull();

    expect(parseStreamLoadPragmaArgs('stream_load(dest=1, row=0, count=1)')).toBeNull();
    expect(parseStreamStorePragmaArgs('stream_store(src=1, row=0, count=1)')).toBeNull();
  });

  it('covers grid-utils non-step/unknown incoming paths', () => {
    const grid: any = { rows: 4, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' };
    expect(isStep({ row: 0, col: 0 }, { row: 1, col: 1 }, 0, 1, grid)).toBe(false);
    expect(getIncomingRegister({ row: 0, col: 0 }, { row: 1, col: 1 }, grid)).toBeNull();
  });

  it('covers empty-bindings clone path for loop entry instantiation', () => {
    const body = [entry(1, 'R1 = i;', 'R1 = i;')];
    const cloned = instantiateEntriesWithBindings(body, new Map());
    expect(cloned).toEqual(body);
    expect(cloned).not.toBe(body);
  });

  it('covers while-fusion vertical and invalid-plan branches', () => {
    const verticalCycle: any = {
      index: 0,
      span,
      statements: [{
        kind: 'at',
        row: 1,
        col: 0,
        instruction: parseInstruction('SADD R1, R1, R0', 1, 1),
        span
      }]
    };
    const down = buildWhileFusionPlan([verticalCycle], 0, 0);
    expect(down?.incomingRegister).toBe('RCB');

    const up = buildWhileFusionPlan([{ ...verticalCycle, statements: [{ ...verticalCycle.statements[0], row: -1 }] }], 0, 0);
    expect(up?.incomingRegister).toBe('RCT');

    const invalid = buildWhileFusionPlan([{ ...verticalCycle, statements: [{ ...verticalCycle.statements[0], col: 2 }] }], 0, 0);
    expect(invalid).toBeNull();
  });

  it('covers parseInstruction single-token opcode path', () => {
    const jump = parseInstruction('JUMP', 1, 1);
    expect(jump.opcode).toBe('JUMP');
    expect(jump.operands).toEqual([]);
  });

  it('covers expandFunctionBody break on handled+shouldBreak and skip empty lines', () => {
    const diagnostics: Diagnostic[] = [];
    const k: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    expandFunctionBodyIntoKernel(
      [
        entry(1, ''),
        entry(2, 'for i in range(0, 2) {')
      ],
      k,
      new Map(),
      new Map(),
      diagnostics,
      { value: 0 },
      [],
      { value: 0 },
      { value: 0 }
    );
    expect(diagnostics.some((d) => d.message.includes('Unterminated for block'))).toBe(true);
  });

  it('covers while expansion branchCondition fallback (no fusion plan)', () => {
    const diagnostics: Diagnostic[] = [];
    const outKernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    const result = tryExpandWhileStatement({
      body: [
        entry(1, 'while (R0 < IMM(3)) at @0,0 {'),
        entry(2, 'bundle { @0,0: NOP; }'),
        entry(3, '}')
      ],
      index: 0,
      entry: entry(1, 'while (R0 < IMM(3)) at @0,0 {'),
      clean: 'while (R0 < IMM(3)) at @0,0 {',
      kernel: outKernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: (_body, kernel) => {
        kernel.cycles.push({ index: 0, span, statements: [] });
        kernel.cycles.push({ index: 1, span, statements: [] });
      }
    } as any);
    expect(result.handled).toBe(true);
    expect(outKernel.cycles.length).toBeGreaterThan(0);
  });

  it('covers control-handler unterminated if branch and block utility edge branches', () => {
    const diagnostics: Diagnostic[] = [];
    const parseNested = () => [];
    const ifUnterminated = tryParseControlStatement(
      [entry(1, 'if (R0 == IMM(0)) at @0,0 {')],
      0,
      'if (R0 == IMM(0)) at @0,0 {',
      1,
      { value: 0 },
      diagnostics,
      parseNested
    );
    expect(ifUnterminated.stop).toBe(true);

    const block = collectBlockFromEntries(
      [entry(1, 'for i in range(0,2) {'), entry(2, 'x }')],
      0
    );
    expect(block.endIndex).toBe(1);

    const afterOpen = collectBlockAfterOpenFromEntries(
      [entry(1, 'x }')],
      0
    );
    expect(afterOpen.endIndex).toBe(0);
  });

  it('covers parse-source compute span edge and invalid config numeric fallback', () => {
    const empty = parseStructuredProgramFromSource('');
    expect(empty.program.span.endColumn).toBe(1);

    const parsed = parseStructuredProgramFromSource(`
target "uma-cgra-base";
kernel "k" {
  config(foo, bar);
}
`);
    expect(parsed.program.kernel?.config).toMatchObject({ mask: 0, startAddr: 0 });
  });
});
