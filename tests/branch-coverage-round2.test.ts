import { afterEach, describe, expect, it, vi } from 'vitest';
import { Diagnostic, ErrorCodes, spanAt } from '@castm/compiler-ir';
import {
  getReduceOpcode,
  getScanIdentity,
  getScanIncomingRegister,
  getScanOpcode,
  pickScratchRegisters
} from '../packages/compiler-api/src/passes-shared/collective-scan-reduce-helpers.js';
import {
  parseGatherPragmaArgs,
  parseStencilPragmaArgs,
  parseTransposePragmaArgs
} from '../packages/compiler-api/src/passes-shared/advanced-args/collectives.js';
import {
  parseData2dDirectiveValue,
  parseDataDirectiveValue
} from '../packages/compiler-api/src/compiler-driver/data-regions/parse.js';
import { collectDataRegions } from '../packages/compiler-api/src/compiler-driver/data-regions/collect.js';
import { parseDirective } from '../packages/compiler-front/src/structured-core/lowering/declarations.js';
import { cycleHasControlFlow, cloneCycle } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/cycle.js';
import { consumeFunctionPreludeStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-prelude.js';
import { tryExpandKnownFunctionStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-dispatch.js';
import { tryExpandForStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-for.js';
import { enumerateForValues } from '../packages/compiler-front/src/structured-core/lowering/for-expand-helpers/enumerate.js';
import {
  collectBlockAfterOpenFromEntries,
  collectBlockAfterOpenFromSource
} from '../packages/compiler-front/src/structured-core/parser-utils/blocks.js';
import { parseStructuredProgramFromSource } from '../packages/compiler-front/src/structured-core/parse-source.js';

const span = spanAt(1, 1, 1);

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('branch coverage round 2', () => {
  it('covers collective helper switch branches', () => {
    expect(getScanIncomingRegister('right')).toBe('RCL');
    expect(getScanIncomingRegister('left')).toBe('RCR');
    expect(getScanIncomingRegister('down')).toBe('RCT');
    expect(getScanIncomingRegister('up')).toBe('RCB');

    expect(getScanIdentity('add')).toBe('0');
    expect(getScanIdentity('or')).toBe('0');
    expect(getScanIdentity('xor')).toBe('0');
    expect(getScanIdentity('and')).toBe('4294967295');
    expect(getScanIdentity('max')).toBe('-2147483648');
    expect(getScanIdentity('min')).toBe('2147483647');
    expect(getScanIdentity('unknown')).toBe('0');

    expect(getScanOpcode('add')).toBe('SADD');
    expect(getScanOpcode('and')).toBe('LAND');
    expect(getScanOpcode('or')).toBe('LOR');
    expect(getScanOpcode('xor')).toBe('LXOR');
    expect(getScanOpcode('unknown')).toBeNull();

    expect(getReduceOpcode('sum')).toBe('SADD');
    expect(getReduceOpcode('add')).toBe('SADD');
    expect(getReduceOpcode('and')).toBe('LAND');
    expect(getReduceOpcode('or')).toBe('LOR');
    expect(getReduceOpcode('xor')).toBe('LXOR');
    expect(getReduceOpcode('mul')).toBe('SMUL');
    expect(getReduceOpcode('unknown')).toBeNull();

    expect(pickScratchRegisters(['R0', 'R1'])).toEqual(['R3', 'R2']);
    expect(pickScratchRegisters(['R0', 'R1', 'R2', 'R3'])).toBeNull();
  });

  it('covers collectives arg parser negative branches', () => {
    expect(parseStencilPragmaArgs('stencil(cross, add, R0, R1)')).toMatchObject({
      pattern: 'cross',
      operation: 'add'
    });
    expect(parseStencilPragmaArgs('stencil(diagonal, add, R0, R1)')).toBeNull();
    expect(parseStencilPragmaArgs('stencil(cross, add)')).toBeNull();
    expect(parseStencilPragmaArgs('stencil(cross, add, R0, 1)')).toBeNull();

    expect(parseTransposePragmaArgs('transpose(reg=R1)')).toEqual({ reg: 'R1' });
    expect(parseTransposePragmaArgs('transpose(reg=R1, extra=R2)')).toBeNull();
    expect(parseTransposePragmaArgs('transpose(reg=1)')).toBeNull();

    expect(parseGatherPragmaArgs('gather(src=R0, dest=@1,1, destreg=R1, op=add)')).toMatchObject({
      srcReg: 'R0',
      operation: 'add'
    });
    expect(parseGatherPragmaArgs('gather(src=R0, dest=@1,1, destreg=R1, op=1bad)')).toBeNull();
    expect(parseGatherPragmaArgs('gather(src=R0, dest=@1,1, bad=R1, op=add)')).toBeNull();
    expect(parseGatherPragmaArgs('gather(src=R0, dest=@bad, destreg=R1, op=add)')).toBeNull();
  });

  it('covers data region parsers and collection failures', () => {
    expect(parseDataDirectiveValue('{ }')).toEqual({ values: [] });
    expect(parseDataDirectiveValue('0x100 { 1, 2 }')).toEqual({ explicitStart: 256, values: [1, 2] });
    expect(parseDataDirectiveValue('{ 1, bad }')).toBeNull();
    expect(parseDataDirectiveValue('invalid')).toBeNull();

    expect(parseData2dDirectiveValue('[9]')).toEqual({
      rows: 3,
      cols: 3,
      values: new Array(9).fill(0)
    });
    expect(parseData2dDirectiveValue('[5]')).toEqual({
      rows: 1,
      cols: 5,
      values: new Array(5).fill(0)
    });
    expect(parseData2dDirectiveValue('[2][2] {1,2,3}')).toBeNull();
    expect(parseData2dDirectiveValue('[2][x] {1,2,3,4}')).toBeNull();

    const diagnostics: Diagnostic[] = [];
    const ast: any = {
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: {
        name: 'k',
        config: undefined,
        span,
        pragmas: [],
        cycles: [],
        directives: [
          { kind: 'data', name: 'A', value: '{1,bad}', span },
          { kind: 'data2d', name: 'B', value: '[2][2] {1,2,3}', span },
          { kind: 'data', name: 'C', value: '{1,2}', span }
        ]
      }
    };
    const result = collectDataRegions(ast, diagnostics);
    expect(result.regions).toHaveLength(1);
    expect(result.symbolsByName.has('C')).toBe(true);
    expect(diagnostics.length).toBe(2);
  });

  it('covers declaration parsing variants and misses', () => {
    expect(parseDirective('let M[2][2] = {1,2,3,4};', 1)).toMatchObject({ kind: 'data2d', name: 'M' });
    expect(parseDirective('let V[8];', 2)).toMatchObject({ kind: 'data2d', name: 'V', value: '[8]' });
    expect(parseDirective('let A @100 = {1,2};', 3)).toMatchObject({ kind: 'data' });
    expect(parseDirective('let D = {1,2};', 4)).toMatchObject({ kind: 'data' });
    expect(parseDirective('let acc = R1;', 5)).toMatchObject({ kind: 'alias' });
    expect(parseDirective('let MASK = 0xFF;', 6)).toMatchObject({ kind: 'const' });
    expect(parseDirective('.io_load 100, 104', 7)).toBeNull();
    expect(parseDirective('not a directive', 8)).toBeNull();
  });

  it('covers cycle helper detection/cloning across statement kinds', () => {
    const cycle: any = {
      index: 0,
      label: undefined,
      span,
      statements: [
        { kind: 'at', row: 0, col: 0, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span },
        { kind: 'at-expr', rowExpr: 'i/4', colExpr: 'i%4', instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span },
        { kind: 'row', row: 1, instructions: [{ text: 'BNE R0, R1, L', opcode: 'BNE', operands: [], span }], span },
        { kind: 'col', col: 2, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span },
        { kind: 'all', instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }
      ]
    };
    expect(cycleHasControlFlow(cycle)).toBe(true);
    expect(cycleHasControlFlow({ ...cycle, label: 'L0', statements: [] })).toBe(true);

    const cloned = cloneCycle(cycle, 3);
    expect(cloned.index).toBe(3);
    expect((cloned.statements[1] as any).kind).toBe('at-expr');
    expect((cloned.statements[3] as any).kind).toBe('col');
    expect((cloned.statements[4] as any).kind).toBe('all');
  });

  it('covers function prelude and dispatch fallback', () => {
    const kernel: any = { pragmas: [] };
    const diagnostics: Diagnostic[] = [];

    const pragmaHandled = consumeFunctionPreludeStatement(
      { lineNo: 1, cleanLine: '#pragma route', rawLine: '#pragma route' },
      '#pragma route',
      kernel,
      diagnostics
    );
    expect(pragmaHandled).toBe(true);
    expect(diagnostics.at(-1)?.message).toContain('Non-canonical pragma syntax');

    const advancedHandled = consumeFunctionPreludeStatement(
      { lineNo: 2, cleanLine: 'route(@0,1 -> @0,0, payload=R1, accum=R0);', rawLine: 'route(@0,1 -> @0,0, payload=R1, accum=R0);' },
      'route(@0,1 -> @0,0, payload=R1, accum=R0);',
      kernel,
      diagnostics
    );
    expect(advancedHandled).toBe(true);
    expect(kernel.pragmas).toHaveLength(1);

    const badNamespaceHandled = consumeFunctionPreludeStatement(
      {
        lineNo: 2,
        cleanLine: 'vendor::route(@0,1 -> @0,0, payload=R1, accum=R0);',
        rawLine: 'vendor::route(@0,1 -> @0,0, payload=R1, accum=R0);'
      },
      'vendor::route(@0,1 -> @0,0, payload=R1, accum=R0);',
      kernel,
      diagnostics
    );
    expect(badNamespaceHandled).toBe(true);
    expect(diagnostics.some((d) => d.message.includes('Unsupported advanced namespace'))).toBe(true);

    const ignored = consumeFunctionPreludeStatement(
      { lineNo: 3, cleanLine: 'not advanced', rawLine: 'not advanced' },
      'not advanced',
      kernel,
      diagnostics
    );
    expect(ignored).toBe(false);

    const dispatch = tryExpandKnownFunctionStatement({
      body: [],
      index: 0,
      entry: { lineNo: 4, cleanLine: 'garbage', rawLine: 'garbage' },
      clean: 'garbage',
      kernel: { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span },
      functions: new Map(),
      constants: new Map(),
      diagnostics: [],
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {}
    });
    expect(dispatch).toEqual({ handled: false, nextIndex: 0, shouldBreak: false });
  });

  it('covers for-step and enumerate boundary paths', () => {
    const diagnostics: Diagnostic[] = [];
    const notFor = tryExpandForStatement({
      body: [],
      index: 0,
      entry: { lineNo: 1, cleanLine: 'noop', rawLine: 'noop' },
      clean: 'noop',
      kernel: { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span },
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {}
    });
    expect(notFor.handled).toBe(false);

    const unterminatedFor = tryExpandForStatement({
      body: [{ lineNo: 1, cleanLine: 'for i in range(0, 3) {', rawLine: 'for i in range(0, 3) {' }],
      index: 0,
      entry: { lineNo: 1, cleanLine: 'for i in range(0, 3) {', rawLine: 'for i in range(0, 3) {' },
      clean: 'for i in range(0, 3) {',
      kernel: { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span },
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {}
    });
    expect(unterminatedFor.handled).toBe(true);
    expect(unterminatedFor.shouldBreak).toBe(true);

    const descending = enumerateForValues(
      { variable: 'i', start: 3, end: -1, step: -1 },
      1,
      30,
      []
    );
    expect(descending).toEqual([3, 2, 1, 0]);

    const tooManyDiagnostics: Diagnostic[] = [];
    const tooMany = enumerateForValues(
      { variable: 'i', start: 0, end: 100_001, step: 1 },
      1,
      30,
      tooManyDiagnostics
    );
    expect(tooMany).toBeNull();
    expect(tooManyDiagnostics.at(-1)?.message).toContain('max supported iterations');
  });

  it('covers block parsers after-open branches', () => {
    const sourceRes = collectBlockAfterOpenFromSource([
      'line1',
      '} trailing',
      'line3'
    ], 1);
    expect(sourceRes.endIndex).toBe(1);
    expect(sourceRes.trailingAfterClose).toBe('trailing');

    const sourceResUnclosed = collectBlockAfterOpenFromSource(['a', 'b'], 0);
    expect(sourceResUnclosed.endIndex).toBeNull();

    const entries = [
      { lineNo: 1, rawLine: 'x', cleanLine: 'x' },
      { lineNo: 2, rawLine: '}', cleanLine: '}' }
    ];
    const entryRes = collectBlockAfterOpenFromEntries(entries, 1);
    expect(entryRes.endIndex).toBe(1);
  });

  it('covers parse-source config extraction and mocked invalid kernel header', async () => {
    const withConfig = parseStructuredProgramFromSource(`
target "uma-cgra-base";
kernel "k" {
  config(0xF, 32);
  bundle { @0,0: NOP; }
}
`);
    expect(withConfig.program.kernel?.config).toMatchObject({ mask: 15, startAddr: 32 });

    vi.doMock('../packages/compiler-front/src/structured-core/token-stream.js', () => ({
      parseProgramHeadersFromTokens: () => ({
        targetProfileId: 'uma-cgra-base',
        kernelName: null,
        kernelHeaderLine: 2
      })
    }));
    const { parseStructuredProgramFromSource: mockedParse } = await import('../packages/compiler-front/src/structured-core/parse-source.js');
    const invalidKernel = mockedParse(`
target "uma-cgra-base";
kernel bad {
}
`);
    expect(invalidKernel.diagnostics.some((d) => d.message.includes('Invalid kernel declaration'))).toBe(true);
  });

  it('covers runtime for early-return branches and route-transfer exceptional branches via mocks', async () => {
    const noRuntimeInput: any = {
      header: { variable: 'i', start: 0, end: 2, step: 1, runtime: false },
      lineNo: 1,
      lineLength: 20,
      diagnostics: []
    };
    const { expandRuntimeForLoop } = await import('../packages/compiler-front/src/structured-core/lowering/for-expand-runtime.js');
    expect(expandRuntimeForLoop(noRuntimeInput)).toBe(false);

    const invalidRuntimeInput: any = {
      ...noRuntimeInput,
      header: { variable: 'i', start: 0, end: 2, step: 1, runtime: true }
    };
    expect(expandRuntimeForLoop(invalidRuntimeInput)).toBe(true);
    expect(invalidRuntimeInput.diagnostics.at(-1).code).toBe(ErrorCodes.Parse.InvalidSyntax);

    vi.doMock('../packages/compiler-api/src/passes-shared/grid-utils.js', () => ({
      computeRoutePath: () => [],
      getIncomingRegister: () => null
    }));
    const { buildRouteTransferCycles } = await import('../packages/compiler-api/src/passes-shared/route-transfer.js');
    const diagnostics: Diagnostic[] = [];
    const cycles = buildRouteTransferCycles(
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      'R0',
      'R1',
      0,
      { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' },
      span,
      diagnostics
    );
    expect(cycles).toEqual([]);
  });
});
