import { afterEach, describe, expect, it, vi } from 'vitest';
import { AstProgram, ErrorCodes, spanAt } from '@castm/compiler-ir';
import { parseStructuredProgramFromSource } from '../packages/compiler-front/src/structured-core/parse-source.js';
import { buildMulaccChainCycles } from '../packages/compiler-api/src/passes-shared/collective/mulacc-chain.js';
import { buildAccumulateCycles } from '../packages/compiler-api/src/passes-shared/collective/accumulate.js';
import {
  parseAccumulatePragmaArgs,
  parseCollectPragmaArgs,
  parseMulaccChainPragmaArgs
} from '../packages/compiler-api/src/passes-shared/advanced-args/collectives.js';
import { pruneNoopCyclesPass } from '../packages/compiler-api/src/passes-shared/desugar/prune-noop-cycles-pass.js';
import { collectDirectiveArtifacts } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/directives.js';
import { createEmptySymbolCollections } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/symbols.js';
import { desugarGotoPass } from '../packages/compiler-api/src/passes-shared/desugar/goto-pass.js';
import { resolveLabelOperand } from '../packages/compiler-api/src/passes-shared/lowering/resolve-symbols/labels.js';
import { parseNumericList } from '../packages/compiler-api/src/compiler-driver/numbers.js';
import {
  createFunctionExpansionContext,
  finalizeJumpReuseFunctions,
  resolveJumpReuseCall
} from '../packages/compiler-front/src/structured-core/lowering/function-expand-context.js';
import { consumeFunctionPreludeStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-prelude.js';
import { tryExpandFunctionCall } from '../packages/compiler-front/src/structured-core/lowering/function-expand-call.js';
import { tryExpandForStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-for.js';
import { tryExpandIfStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-if.js';
import { tryExpandWhileStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-while.js';
import { parseStructuredStatements } from '../packages/compiler-front/src/structured-core/statements.js';
import {
  lowerStructuredProgramToAstDetailed,
  toStructuredProgramAst
} from '../packages/compiler-front/src/structured-core/conversion.js';
import { buildCollectCycles } from '../packages/compiler-api/src/passes-shared/collective/collect.js';
import { analyze } from '../packages/compiler-api/src/compiler-driver/analyze-driver.js';
import { cloneAst } from '../packages/compiler-api/src/passes-shared/ast-utils.js';
import {
  __slotPackTestUtils,
  createSlotPackPass
} from '../packages/compiler-api/src/passes-shared/desugar/slot-pack-pass.js';
import { expandStaticForLoop } from '../packages/compiler-front/src/structured-core/lowering/for-expand-static.js';

const span = spanAt(1, 1, 1);
const grid = { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' } as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

function kernelAst(cycles: any[] = [], extra: Partial<any> = {}): AstProgram {
  return {
    targetProfileId: 'uma-cgra-base',
    target: { id: 'base', raw: 'base', span },
    span,
    kernel: {
      name: 'k',
      config: undefined,
      directives: [],
      pragmas: [],
      runtime: [],
      cycles,
      span,
      ...extra
    }
  } as any;
}

describe('branch coverage round 12 - parse-source and collectives', () => {
  it('covers parse-source build/runtime/legacy diagnostics branches', () => {
    const parsed = parseStructuredProgramFromSource(`
target base;
build {
  scheduler_window -1;
  jump_reuse_depth 2;
  grid 0x0;
  unknown_setting on;
}
kernel "k" {
  io.load();
  assert(reg=R1, equals=1);
  assert(at=@0,0, badtoken, reg=R1, equals=1);
  .io_load(0);
  bundle { @0,0: NOP; }
}
`);

    const messages = parsed.diagnostics.map((d) => d.message);
    expect(messages.some((m) => m.includes('Invalid scheduler_window value'))).toBe(true);
    expect(messages.some((m) => m.includes('Invalid jump_reuse_depth value'))).toBe(true);
    expect(messages.some((m) => m.includes('Invalid grid dimensions'))).toBe(true);
    expect(messages.some((m) => m.includes('Unknown build setting'))).toBe(true);
    expect(messages.some((m) => m.includes('Invalid io.load statement'))).toBe(true);
    expect(messages.some((m) => m.includes('Invalid assert statement'))).toBe(true);
    expect(messages.some((m) => m.includes('Legacy runtime directive'))).toBe(true);
  });

  it('covers parse-source valid jump_reuse_depth and remaining legacy runtime hint branches', () => {
    const parsed = parseStructuredProgramFromSource(`
target base;
build {
  ;
  jump_reuse_depth 1;
}
kernel "k" {
  .io_store(0);
  .limit(10);
  .assert(at=@0,0, reg=R1, equals=1);
}
`);
    expect(parsed.program.build?.jumpReuseDepth).toBe(1);
    expect(parsed.diagnostics.some((d) => d.message.includes("'.io_store'"))).toBe(true);
    expect(parsed.diagnostics.some((d) => d.message.includes("'.limit'"))).toBe(true);
    expect(parsed.diagnostics.some((d) => d.message.includes("'.assert'"))).toBe(true);
  });

  it('covers parse-source no-kernel return with optional build spread', () => {
    const parsed = parseStructuredProgramFromSource(`
target base;
build { optimize O1; }
`);
    expect(parsed.program.kernel).toBeNull();
    expect(parsed.program.build?.optimize).toBe('O1');
  });

  it('covers parse-source assert runtime optional cycle branches', () => {
    const parsed = parseStructuredProgramFromSource(`
target base;
kernel "k" {
  assert(at=@0,0, reg=R1, equals=1);
  assert(at=@0,0, reg=R1, equals=2, cycle=7);
}
`);
    const runtime = parsed.program.kernel?.runtime ?? [];
    expect(runtime.some((stmt: any) => stmt.kind === 'assert' && stmt.cycle === undefined)).toBe(true);
    expect(runtime.some((stmt: any) => stmt.kind === 'assert' && stmt.cycle === '7')).toBe(true);
  });

  it('covers duplicate/unterminated build handling and invalid kernel declaration', () => {
    const duplicate = parseStructuredProgramFromSource(`
target base;
build { optimize O2; }
build { optimize O1; }
kernel "k" { bundle { @0,0: NOP; } }
`);
    expect(duplicate.diagnostics.some((d) => d.message.includes('Duplicate build block'))).toBe(true);

    const unterminated = parseStructuredProgramFromSource(`
target base;
build {
  optimize O2;
kernel "k" {
  bundle { @0,0: NOP; }
}
`);
    expect(unterminated.diagnostics.some((d) => d.message.includes('Unterminated build block'))).toBe(true);

    const invalidKernel = parseStructuredProgramFromSource(`
target base;
kernel bad {
  bundle { @0,0: NOP; }
}
`);
    expect(invalidKernel.program.kernel).toBeNull();
  });

  it('covers invalid-kernel declaration branch via mocked token header extraction', async () => {
    vi.doMock('../packages/compiler-front/src/structured-core/token-stream.js', () => ({
      parseProgramHeadersFromTokens: () => ({
        targetLine: null,
        kernelHeaderLine: 4,
        kernelName: null
      })
    }));

    const mod = await import('../packages/compiler-front/src/structured-core/parse-source.js');
    const parsed = mod.parseStructuredProgramFromSource(`
target base;
build { optimize O2; }
kernel bad {
  bundle { @0,0: NOP; }
}
`);
    expect(parsed.diagnostics.some((d) => d.message.includes('Invalid kernel declaration'))).toBe(true);
    expect(parsed.program.build?.optimize).toBe('O2');
  });

  it('covers collectives parser edge branches for new path/max_hops and scope parsing', () => {
    expect(parseCollectPragmaArgs('collect(from=row(1), to=row(0), via=RCT, local=R1, into=R2, path=bad)')).toBeNull();
    expect(parseCollectPragmaArgs('collect(from=row(1), to=row(0), via=RCT, local=R1, into=R2, path=multi_hop, max_hops=0)')).toBeNull();

    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R1, accum=R2, out=R3, scope=row(x))')).toBeNull();

    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, out=R3, target=row(x), width=16, dir=right)')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, out=R3, target=col(x), width=16, dir=down)')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, out=R3, target=all, width=16, dir=right, bad=1)')).toBeNull();

    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, out=R3, target=row(0), width=x, dir=right)')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, out=R3, target=row(0), width=16, mask=x, dir=right)')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, out=R3, target=row(0), width=16, lanes=x, dir=right)')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, out=R3, target=all, width=16, dir=right)')).toMatchObject({
      target: { kind: 'all' }
    });
    expect(parseMulaccChainPragmaArgs('bad')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, target=row(0), width=16, dir=right)')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R2, out=1, target=row(0), width=16, dir=right)')).toBeNull();
  });

  it('covers mulacc_chain row/col/all diagnostics and both direction families', () => {
    const diagnostics: any[] = [];

    const allHorizontal = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'all' }, lanes: 2, width: 16, mask: 0xffff, direction: 'left'
      },
      0,
      grid,
      span,
      diagnostics
    );
    expect(allHorizontal).toHaveLength(4);

    const allVertical = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'all' }, lanes: 2, width: 16, mask: 0xffff, direction: 'up'
      },
      10,
      grid,
      span,
      diagnostics
    );
    expect(allVertical).toHaveLength(4);

    const rowOut = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'row', index: 99 }, width: 16, mask: 0xffff, direction: 'right'
      },
      20,
      grid,
      span,
      diagnostics
    );
    expect(rowOut).toEqual([]);

    const rowDir = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'row', index: 1 }, width: 16, mask: 0xffff, direction: 'up'
      },
      30,
      grid,
      span,
      diagnostics
    );
    expect(rowDir).toEqual([]);

    const rowLanes = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'row', index: 1 }, lanes: 0, width: 16, mask: 0xffff, direction: 'right'
      },
      40,
      grid,
      span,
      diagnostics
    );
    expect(rowLanes).toEqual([]);

    const colOut = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'col', index: 99 }, width: 16, mask: 0xffff, direction: 'down'
      },
      50,
      grid,
      span,
      diagnostics
    );
    expect(colOut).toEqual([]);

    const colDir = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'col', index: 1 }, width: 16, mask: 0xffff, direction: 'left'
      },
      60,
      grid,
      span,
      diagnostics
    );
    expect(colDir).toEqual([]);

    const colLanes = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'col', index: 1 }, lanes: 9, width: 16, mask: 0xffff, direction: 'down'
      },
      70,
      grid,
      span,
      diagnostics
    );
    expect(colLanes).toEqual([]);

    const allHInvalidLanes = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'all' }, lanes: 9, width: 16, mask: 0xffff, direction: 'right'
      },
      80,
      grid,
      span,
      diagnostics
    );
    expect(allHInvalidLanes).toEqual([]);

    const allVInvalidLanes = buildMulaccChainCycles(
      {
        srcReg: 'R0', coeffReg: 'R1', accReg: 'R2', outReg: 'R3',
        target: { kind: 'all' }, lanes: 9, width: 16, mask: 0xffff, direction: 'down'
      },
      90,
      grid,
      span,
      diagnostics
    );
    expect(allVInvalidLanes).toEqual([]);

    expect(diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('covers mulacc_chain lane default branch (requested undefined)', () => {
    const diagnostics: any[] = [];
    const out = buildMulaccChainCycles(
      {
        srcReg: 'R0',
        coeffReg: 'R1',
        accReg: 'R2',
        outReg: 'R3',
        target: { kind: 'all' },
        width: 16,
        mask: 0xffff,
        direction: 'right'
      },
      0,
      grid,
      span,
      diagnostics
    );
    expect(out).toHaveLength(4);
    expect(diagnostics).toHaveLength(0);
  });

  it('covers accumulate scope/steps/pattern diagnostics and anti_diagonal path', () => {
    const diagnostics: any[] = [];

    const antiDiag = buildAccumulateCycles(
      {
        pattern: 'anti_diagonal',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'all' }
      },
      0,
      grid,
      span,
      diagnostics
    );
    expect(antiDiag.length).toBeGreaterThan(0);

    expect(buildAccumulateCycles(
      {
        pattern: 'col',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'col', index: 99 }
      },
      10,
      grid,
      span,
      diagnostics
    )).toEqual([]);

    expect(buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'col', index: 1 }
      },
      20,
      grid,
      span,
      diagnostics
    )).toEqual([]);

    expect(buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 0 as any,
        scope: { kind: 'all' }
      },
      30,
      grid,
      span,
      diagnostics
    )).toEqual([]);

    expect(buildAccumulateCycles(
      {
        pattern: 'diag' as any,
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'all' }
      },
      40,
      grid,
      span,
      diagnostics
    )).toEqual([]);
  });

  it('covers accumulate empty-scope fallback boundary branches', () => {
    const diagnostics: any[] = [];
    const zeroGrid = { rows: 0, cols: 0, topology: 'mesh', wrapPolicy: 'clamp' } as any;
    expect(buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'all' }
      },
      0,
      zeroGrid,
      span,
      diagnostics
    ).length).toBeGreaterThan(0);
    expect(buildAccumulateCycles(
      {
        pattern: 'col',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'all' }
      },
      0,
      zeroGrid,
      span,
      diagnostics
    ).length).toBeGreaterThan(0);
    expect(buildAccumulateCycles(
      {
        pattern: 'anti_diagonal',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'all' }
      },
      0,
      zeroGrid,
      span,
      diagnostics
    ).length).toBeGreaterThan(0);
  });

  it('covers collect multi-hop direction helpers for row/col/self', () => {
    const diagnostics: any[] = [];

    expect(buildCollectCycles(
      {
        from: { axis: 'row', index: 0 },
        to: { axis: 'row', index: 2 },
        viaReg: 'RCT',
        localReg: 'R1',
        destReg: 'R2',
        combine: 'add',
        path: 'multi_hop'
      },
      0,
      grid,
      span,
      diagnostics
    ).length).toBeGreaterThan(0);

    expect(buildCollectCycles(
      {
        from: { axis: 'row', index: 2 },
        to: { axis: 'row', index: 0 },
        viaReg: 'RCB',
        localReg: 'R1',
        destReg: 'R2',
        combine: 'add',
        path: 'multi_hop'
      },
      10,
      grid,
      span,
      diagnostics
    ).length).toBeGreaterThan(0);

    expect(buildCollectCycles(
      {
        from: { axis: 'col', index: 0 },
        to: { axis: 'col', index: 2 },
        viaReg: 'RCL',
        localReg: 'R1',
        destReg: 'R2',
        combine: 'add',
        path: 'multi_hop'
      },
      20,
      grid,
      span,
      diagnostics
    ).length).toBeGreaterThan(0);

    expect(buildCollectCycles(
      {
        from: { axis: 'col', index: 2 },
        to: { axis: 'col', index: 0 },
        viaReg: 'RCR',
        localReg: 'R1',
        destReg: 'R2',
        combine: 'add',
        path: 'multi_hop'
      },
      30,
      grid,
      span,
      diagnostics
    ).length).toBeGreaterThan(0);

    expect(buildCollectCycles(
      {
        from: { axis: 'row', index: 1 },
        to: { axis: 'row', index: 1 },
        viaReg: 'SELF',
        localReg: 'R1',
        destReg: 'R2',
        combine: 'copy',
        path: 'multi_hop'
      },
      40,
      grid,
      span,
      diagnostics
    ).length).toBeGreaterThan(0);
  });
});

describe('branch coverage round 12 - passes and lowering edges', () => {
  it('covers prune-noop-cycles row-empty and numeric-branch early-return branches', () => {
    const withNumericBranch = kernelAst([
      {
        index: 0,
        span,
        statements: [{
          kind: 'at',
          row: 0,
          col: 0,
          instruction: { text: 'BEQ R0, R1, 2', opcode: '', operands: [], span },
          span
        }]
      },
      {
        index: 1,
        span,
        statements: [{ kind: 'row', row: 0, instructions: [], span }]
      }
    ]);
    const guarded = pruneNoopCyclesPass.run(withNumericBranch);
    expect(guarded.output.kernel?.cycles).toHaveLength(2);

    const noBranch = kernelAst([
      {
        index: 0,
        span,
        statements: [{ kind: 'at', row: 0, col: 0, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }]
      },
      {
        index: 1,
        span,
        label: 'L1',
        statements: [{ kind: 'at', row: 0, col: 0, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }]
      }
    ]);
    const pruned = pruneNoopCyclesPass.run(noBranch);
    expect(pruned.output.kernel?.cycles).toHaveLength(1);
    expect(pruned.output.kernel?.cycles[0].label).toBe('L1');

    const rowNoop = kernelAst([{
      index: 0,
      span,
      statements: [{ kind: 'row', row: 0, instructions: [{ text: 'NOP', opcode: 'NOP', operands: [], span }], span }]
    }]);
    const rowPruned = pruneNoopCyclesPass.run(rowNoop);
    expect(rowPruned.output.kernel?.cycles).toEqual([]);
  });

  it('covers runtime directive artifact assert validation branches', () => {
    const ast = kernelAst([], {
      runtime: [
        { kind: 'assert', at: { row: '0', col: '-1' }, reg: 'R1', equals: '1', raw: 'a', span },
        { kind: 'assert', at: { row: '0', col: '0' }, reg: 'BAD', equals: '1', raw: 'b', span },
        { kind: 'assert', at: { row: '0', col: '0' }, reg: 'R1', equals: 'oops', raw: 'c', span }
      ]
    });

    const diagnostics: any[] = [];
    const artifacts = collectDirectiveArtifacts(ast, diagnostics, createEmptySymbolCollections());
    expect(artifacts.assertions).toEqual([]);
    expect(diagnostics.some((d) => d.message.includes('Invalid assert col'))).toBe(true);
    expect(diagnostics.some((d) => d.message.includes('Invalid assert register'))).toBe(true);
    expect(diagnostics.some((d) => d.message.includes('Invalid assert equals value'))).toBe(true);
  });

  it('covers runtime artifact io.store invalid-address and empty-address branches', () => {
    const ast = kernelAst([], {
      runtime: [
        { kind: 'io_store', addresses: ['oops'], raw: 'io.store(oops)', span },
        { kind: 'io_store', addresses: [], raw: 'io.store()', span },
        { kind: 'assert', at: { row: '0', col: '0' }, reg: 'R1', equals: '1', raw: 'assert', span }
      ]
    });
    const diagnostics: any[] = [];
    const artifacts = collectDirectiveArtifacts(ast, diagnostics, createEmptySymbolCollections());
    expect(artifacts.assertions).toHaveLength(1);
    expect(diagnostics.some((d) => d.message.includes('Invalid io.store address'))).toBe(true);
    expect(diagnostics.some((d) => d.message.includes('Invalid io.store statement'))).toBe(true);
  });

  it('covers runtime artifact io.load empty-address branch', () => {
    const ast = kernelAst([], {
      runtime: [
        { kind: 'io_load', addresses: [], raw: 'io.load()', span }
      ]
    });
    const diagnostics: any[] = [];
    collectDirectiveArtifacts(ast, diagnostics, createEmptySymbolCollections());
    expect(diagnostics.some((d) => d.message.includes('Invalid io.load statement'))).toBe(true);
  });

  it('covers goto desugar for GOTO/JUMP sugar and leaves explicit JUMP untouched', () => {
    const ast = kernelAst([
      {
        index: 0,
        span,
        statements: [
          {
            kind: 'at',
            row: 0,
            col: 0,
            instruction: { text: 'GOTO L0', opcode: 'GOTO', operands: ['L0'], span },
            span
          },
          {
            kind: 'at',
            row: 0,
            col: 1,
            instruction: { text: 'JUMP L1', opcode: 'JUMP', operands: ['L1'], span },
            span
          },
          {
            kind: 'at',
            row: 0,
            col: 2,
            instruction: { text: 'JUMP ZERO, L2', opcode: 'JUMP', operands: ['ZERO', 'L2'], span },
            span
          }
        ]
      }
    ]);

    const out = desugarGotoPass.run(ast).output.kernel!.cycles[0].statements as any[];
    expect(out[0].instruction.operands).toEqual(['ZERO', 'L0']);
    expect(out[1].instruction.operands).toEqual(['ZERO', 'L1']);
    expect(out[2].instruction.operands).toEqual(['ZERO', 'L2']);
  });

  it('covers __body label fallback in resolveLabelOperand', () => {
    const diagnostics: any[] = [];
    const resolved = resolveLabelOperand('JUMP', ['ZERO', 'dispatch'], new Map([['dispatch__body', 9]]), span, diagnostics);
    expect(resolved).toEqual(['ZERO', '9']);
    expect(diagnostics).toHaveLength(0);
  });

  it('covers parseNumericList positive return path', () => {
    expect(parseNumericList('{ 1, 2, -3 }')).toEqual([1, 2, -3]);
  });

  it('covers cloneAst branch for no-kernel programs with build.grid', () => {
    const cloned = cloneAst({
      targetProfileId: 'uma-cgra-base',
      target: { id: 'base', raw: 'base', span },
      build: {
        optimize: 'O2',
        grid: { rows: 4, cols: 4, topology: 'mesh' },
        span
      },
      kernel: null,
      span
    } as any);
    expect(cloned.build?.grid?.rows).toBe(4);
    const withoutGrid = cloneAst({
      targetProfileId: 'uma-cgra-base',
      target: { id: 'base', raw: 'base', span },
      build: { optimize: 'O1', span },
      kernel: null,
      span
    } as any);
    expect(withoutGrid.build?.optimize).toBe('O1');
  });

  it('covers assertion parser split/depth branches and invalid tokenization branches', async () => {
    const mod = await import('../packages/compiler-api/src/compiler-driver/assertions.js');
    const ast = kernelAst([]);
    const badCall = mod.parseAssertionDirectiveValue(ast, span, 'not_assert(at=@0,0)');
    expect('message' in badCall).toBe(true);

    const noKv = mod.parseAssertionDirectiveValue(ast, span, 'assert(at=@0,0)');
    expect('message' in noKv).toBe(true);

    const badPair = mod.parseAssertionDirectiveValue(ast, span, 'assert(at=@0,0, reg=R1, equals=1, badtoken)');
    expect('message' in badPair).toBe(true);

    const nested = mod.parseAssertionDirectiveValue(ast, span, 'assert(at=@0,0, reg=R1, equals={1,[2,(3)]})');
    expect('message' in nested).toBe(true);
  });

  it('covers function-expand-context pragma-only and empty-body finalization branches', () => {
    const def = {
      name: 'callee',
      params: ['x'],
      body: [],
      span
    } as any;

    const kernelPragma: any = {
      name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span
    };
    const ctxPragma = createFunctionExpansionContext('jump-reuse', 1);
    resolveJumpReuseCall(ctxPragma, 'callee', ['R0'], def, 0, 10, { value: 1 });
    finalizeJumpReuseFunctions({
      context: ctxPragma,
      kernel: kernelPragma,
      functions: new Map([['callee', def]]),
      constants: new Map(),
      diagnostics: [],
      cycleCounter: { value: 0 },
      expansionCounter: { value: 2 },
      controlFlowCounter: { value: 0 },
      loopControlStack: [],
      expandBody: (_body, k) => {
        k.pragmas.push({ text: 'std::extract_bytes(src=R0, from=0, to=7, into=R1)', anchorCycleIndex: 0, span });
      }
    });
    expect(kernelPragma.pragmas[0].label).toContain('__fn_entry_callee_');

    const kernelEmpty: any = {
      name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span
    };
    const ctxEmpty = createFunctionExpansionContext('jump-reuse', 1);
    resolveJumpReuseCall(ctxEmpty, 'callee', ['R0'], def, 0, 10, { value: 1 });
    finalizeJumpReuseFunctions({
      context: ctxEmpty,
      kernel: kernelEmpty,
      functions: new Map([['callee', def]]),
      constants: new Map(),
      diagnostics: [],
      cycleCounter: { value: 0 },
      expansionCounter: { value: 2 },
      controlFlowCounter: { value: 0 },
      loopControlStack: [],
      expandBody: () => {}
    });
    expect(kernelEmpty.cycles[0].label).toContain('__fn_entry_callee_');
    expect(kernelEmpty.cycles[0].statements[0].instruction.text).toBe('NOP');
  });

  it('covers function-expand-context missing spec/instantiate-null/linkPe-fallback branches', () => {
    const def = { name: 'callee', params: ['x'], body: [], span } as any;
    const kernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    const ctx = createFunctionExpansionContext('jump-reuse', 10);
    ctx.jumpReuseOrder.push('missing-spec-key');

    resolveJumpReuseCall(ctx, 'callee', [], def, 1, 10, { value: 1 }); // instantiate should fail
    resolveJumpReuseCall(ctx, 'callee', ['R0'], def, 9, 10, { value: 100 }); // linkPe fallback

    finalizeJumpReuseFunctions({
      context: ctx,
      kernel,
      functions: new Map([['callee', def]]),
      constants: new Map(),
      diagnostics: [],
      cycleCounter: { value: 0 },
      expansionCounter: { value: 200 },
      controlFlowCounter: { value: 0 },
      loopControlStack: [],
      expandBody: () => {}
    });

    expect(kernel.cycles.some((c: any) => String(c.label).includes('__fn_entry_callee_'))).toBe(true);
  });

  it('covers prelude/function-call/control stripLabelPrefix reserved and :: guard branches', () => {
    const diagnostics: any[] = [];
    const kernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };

    const preludeHandled = consumeFunctionPreludeStatement(
      { lineNo: 1, rawLine: 'if: std::extract_bytes(...)', cleanLine: 'if: std::extract_bytes(...)' } as any,
      'if: std::extract_bytes(src=R0, from=0, to=7, into=R1);',
      kernel,
      diagnostics
    );
    expect(preludeHandled).toBe(false);

    const baseInput = {
      body: [{ lineNo: 1, rawLine: '', cleanLine: '' }],
      index: 0,
      entry: { lineNo: 1, rawLine: '', cleanLine: '' },
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 1 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {},
      expansionContext: undefined,
      loopControlStack: []
    } as any;

    expect(tryExpandForStatement({ ...baseInput, clean: 'for: for i in [0,1] at @0,0 {' }).handled).toBe(false);
    expect(tryExpandForStatement({ ...baseInput, clean: 'lbl:: for i in [0,1] at @0,0 {' }).handled).toBe(false);

    expect(tryExpandIfStatement({ ...baseInput, clean: 'if: if (R0) at @0,0 {' }).handled).toBe(false);
    expect(tryExpandIfStatement({ ...baseInput, clean: 'lbl:: if (R0) at @0,0 {' }).handled).toBe(false);

    expect(tryExpandWhileStatement({ ...baseInput, clean: 'while: while (R0) at @0,0 {' }).handled).toBe(false);
    expect(tryExpandWhileStatement({ ...baseInput, clean: 'lbl:: while (R0) at @0,0 {' }).handled).toBe(false);

    expect(tryExpandFunctionCall({ ...baseInput, clean: 'if: foo();' }).handled).toBe(false);
    expect(tryExpandFunctionCall({ ...baseInput, clean: 'lbl:: foo();' }).handled).toBe(false);
  });

  it('covers function-expand-call jump-reuse inline fallback and pragma-label branch', () => {
    const diagnostics: any[] = [];
    const kernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    const def = { name: 'foo', params: ['x'], body: [], span };

    const jumpReuse = createFunctionExpansionContext('jump-reuse', 0);
    const tooDeep = tryExpandFunctionCall({
      body: [],
      index: 0,
      entry: { lineNo: 1, rawLine: 'foo();', cleanLine: 'foo();' },
      clean: 'foo();',
      kernel,
      functions: new Map([['foo', def as any]]),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: ['caller'],
      expansionCounter: { value: 1 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {
        throw new Error('should not expand when instantiate fails');
      },
      expansionContext: jumpReuse,
      loopControlStack: []
    } as any);
    expect(tooDeep.handled).toBe(true);

    const pragmaOnlyKernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    const pragmaOnly = tryExpandFunctionCall({
      body: [],
      index: 0,
      entry: { lineNo: 1, rawLine: 'lab: foo(R0);', cleanLine: 'lab: foo(R0);' },
      clean: 'lab: foo(R0);',
      kernel: pragmaOnlyKernel,
      functions: new Map([['foo', def as any]]),
      constants: new Map(),
      diagnostics: [],
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 1 },
      controlFlowCounter: { value: 0 },
      expandBody: (_entries: any, k: any) => {
        k.pragmas.push({ text: 'route(@0,0 -> @0,1, payload=R0, accum=R1)', anchorCycleIndex: 0, span });
      },
      expansionContext: undefined,
      loopControlStack: []
    } as any);
    expect(pragmaOnly.handled).toBe(true);
    expect(pragmaOnlyKernel.pragmas[0].label).toBe('lab');
  });

  it('covers function-expand-call jump-reuse link PE fallback branch', () => {
    const diagnostics: any[] = [];
    const kernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    const def = { name: 'foo', params: ['x'], body: [], span };
    const jumpReuse = createFunctionExpansionContext('jump-reuse', 5);

    const out = tryExpandFunctionCall({
      body: [],
      index: 0,
      entry: { lineNo: 1, rawLine: 'foo(R0);', cleanLine: 'foo(R0);' },
      clean: 'foo(R0);',
      kernel,
      functions: new Map([['foo', def as any]]),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: ['a', 'b', 'c'], // depth=3 > linkPeByDepth.length
      expansionCounter: { value: 1 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {},
      expansionContext: jumpReuse,
      loopControlStack: []
    } as any);
    expect(out.handled).toBe(true);
    expect(kernel.cycles.length).toBeGreaterThan(0);
  });

  it('covers labeled for pragma-only branch and undefined loopControlStack fallback', async () => {
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/for-expand.js', () => ({
      expandForLoopIntoKernel: (
        _header: any,
        _loopLabel: string | undefined,
        _loopBody: any,
        _lineNo: number,
        _lineLength: number,
        kernel: any
      ) => {
        kernel.pragmas.push({
          text: 'std::extract_bytes(src=R0, from=0, to=7, into=R1)',
          anchorCycleIndex: 0,
          span
        });
      }
    }));
    const mod = await import('../packages/compiler-front/src/structured-core/lowering/function-expand-for.js');

    const diagnostics: any[] = [];
    const kernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    const body = [
      { lineNo: 1, rawLine: 'LFOR: for i in range(0,1) at @0,0 {', cleanLine: 'LFOR: for i in range(0,1) at @0,0 {' },
      { lineNo: 2, rawLine: '}', cleanLine: '}' }
    ];

    const out = mod.tryExpandForStatement({
      body,
      index: 0,
      entry: body[0],
      clean: body[0].cleanLine,
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 1 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {},
      expansionContext: undefined
    } as any);
    expect(out.handled).toBe(true);
    expect(kernel.pragmas[0].label).toBe('LFOR');
  });

  it('covers real static-for expansion with undefined loopControlStack fallback', () => {
    const diagnostics: any[] = [];
    const kernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    const body = [
      { lineNo: 1, rawLine: 'for i in range(0,1) at @0,0 {', cleanLine: 'for i in range(0,1) at @0,0 {' },
      { lineNo: 2, rawLine: 'bundle { @0,0: NOP; }', cleanLine: 'bundle { @0,0: NOP; }' },
      { lineNo: 3, rawLine: '}', cleanLine: '}' }
    ];

    const out = tryExpandForStatement({
      body,
      index: 0,
      entry: body[0],
      clean: body[0].cleanLine,
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 1 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {},
      expansionContext: undefined
    } as any);
    expect(out.handled).toBe(true);
  });

  it('covers labeled cycle block path and labeled-control stop branch in statements parser', () => {
    const diagnostics: any[] = [];
    const cycleEntries = [
      { lineNo: 1, rawLine: 'L0: bundle {', cleanLine: 'L0: bundle {' },
      { lineNo: 2, rawLine: '@0,0: NOP;', cleanLine: '@0,0: NOP;' },
      { lineNo: 3, rawLine: '}', cleanLine: '}' }
    ] as any;
    const parsedCycle = parseStructuredStatements(cycleEntries, { value: 0 }, diagnostics);
    expect(parsedCycle[0]).toMatchObject({ kind: 'cycle', cycle: { label: 'L0' } });

    const stopEntries = [
      { lineNo: 1, rawLine: 'lbl: if (R0) at @0,0 {', cleanLine: 'lbl: if (R0) at @0,0 {' }
    ] as any;
    const stopped = parseStructuredStatements(stopEntries, { value: 0 }, diagnostics);
    expect(stopped).toEqual([]);

    const labeledNoise = parseStructuredStatements([
      { lineNo: 1, rawLine: 'if: ???', cleanLine: 'if: ???' },
      { lineNo: 2, rawLine: 'lbl:: ???', cleanLine: 'lbl:: ???' }
    ] as any, { value: 0 }, diagnostics);
    expect(labeledNoise).toEqual([]);

    const unterminatedLabeledCycle = parseStructuredStatements([
      { lineNo: 1, rawLine: 'LC: bundle {', cleanLine: 'LC: bundle {' }
    ] as any, { value: 0 }, diagnostics);
    expect(unterminatedLabeledCycle).toHaveLength(1);
  });

  it('covers conversion option precedence branches and optional-build spread branches', () => {
    const structuredNoKernel: any = {
      targetProfileId: 'uma-cgra-base',
      target: { id: 'base', raw: 'base', span },
      build: { optimize: 'O2', span },
      kernel: null,
      functions: [],
      span
    };
    const loweredNoKernel = lowerStructuredProgramToAstDetailed(structuredNoKernel);
    expect(loweredNoKernel.ast.kernel).toBeNull();

    const astNoBuild = toStructuredProgramAst({
      targetProfileId: 'uma-cgra-base',
      target: { id: 'base', raw: 'base', span },
      kernel: {
        name: 'k',
        config: undefined,
        directives: [],
        pragmas: [],
        cycles: [],
        runtime: [],
        span
      },
      span
    } as any);
    expect(astNoBuild.build).toBeUndefined();

    const astWithBuild = toStructuredProgramAst({
      targetProfileId: 'uma-cgra-base',
      target: { id: 'base', raw: 'base', span },
      build: { optimize: 'O3', span },
      kernel: {
        name: 'k',
        config: undefined,
        directives: [],
        pragmas: [],
        cycles: [],
        runtime: [],
        span
      },
      span
    } as any);
    expect(astWithBuild.build?.optimize).toBe('O3');

    const astNoKernelWithBuild = toStructuredProgramAst({
      targetProfileId: 'uma-cgra-base',
      target: { id: 'base', raw: 'base', span },
      build: { optimize: 'O0', span },
      kernel: null,
      span
    } as any);
    expect(astNoKernelWithBuild.build?.optimize).toBe('O0');

    const structuredWithKernel: any = {
      targetProfileId: 'uma-cgra-base',
      target: { id: 'base', raw: 'base', span },
      build: { expansionMode: 'full-unroll', jumpReuseDepth: 0, span },
      kernel: {
        name: 'k',
        directives: [],
        runtime: undefined,
        config: undefined,
        body: [],
        span
      },
      functions: [],
      span
    };
    const lowered = lowerStructuredProgramToAstDetailed(structuredWithKernel, {
      expansionMode: 'jump-reuse',
      jumpReuseDepth: 1
    });
    expect(lowered.ast.kernel?.runtime).toEqual([]);

    const structuredOptionsOnly: any = {
      targetProfileId: 'uma-cgra-base',
      target: { id: 'base', raw: 'base', span },
      kernel: {
        name: 'k',
        directives: [],
        runtime: [],
        config: undefined,
        body: [],
        span
      },
      functions: [],
      span
    };
    const loweredOptionsOnly = lowerStructuredProgramToAstDetailed(structuredOptionsOnly, {
      expansionMode: 'jump-reuse',
      jumpReuseDepth: 2
    });
    expect(loweredOptionsOnly.ast.kernel?.name).toBe('k');
  });

  it('covers analyze scheduler window normalization edge branches', () => {
    const inf = analyze({
      ...kernelAst([]),
      build: { schedulerWindow: Number.POSITIVE_INFINITY, span }
    } as any, { strictUnsupported: false });
    expect(inf.success).toBe(true);

    const neg = analyze({
      ...kernelAst([]),
      build: { schedulerWindow: -5, span }
    } as any, { strictUnsupported: false });
    expect(neg.success).toBe(true);
  });

  it('covers resolveGrid profile-missing branch via mocked lang-spec', async () => {
    vi.doMock('@castm/lang-spec', () => ({
      resolveTargetProfileId: () => 'uma-cgra-base',
      getTargetProfile: () => null
    }));
    const mod = await import('../packages/compiler-api/src/compiler-driver/grid-resolver.js');

    const diagnostics: any[] = [];
    const out = mod.resolveGrid(
      {
        targetProfileId: 'uma-cgra-base',
        target: { id: 'base', raw: 'base', span },
        kernel: null,
        span
      } as any,
      diagnostics
    );

    expect(out).toBeNull();
    expect(diagnostics.some((d) => d.message.includes('Unknown target profile'))).toBe(true);
  });

  it('covers resolveGrid missing-target and invalid-grid fallback-span branches', async () => {
    vi.unmock('@castm/lang-spec');
    vi.resetModules();
    const mod = await import('../packages/compiler-api/src/compiler-driver/grid-resolver.js');
    const d1: any[] = [];
    expect(mod.resolveGrid({ span, kernel: null } as any, d1)).toBeNull();
    expect(d1.some((d) => d.code === ErrorCodes.Parse.MissingTarget)).toBe(true);

    const d2: any[] = [];
    expect(mod.resolveGrid({
      target: { id: 'uma-cgra-base', raw: 'uma-cgra-base', span },
      targetProfileId: 'uma-cgra-base',
      build: { grid: { rows: 0, cols: 1 }, span },
      kernel: null,
      span
    } as any, d2)).toBeNull();
    expect(d2.length).toBeGreaterThan(0);
  });

  it('covers resolveGrid invalid-profile-grid branch with fallback build span', async () => {
    vi.doMock('@castm/lang-spec', () => ({
      resolveTargetProfileId: () => 'uma-cgra-base',
      getTargetProfile: () => ({ grid: { rows: 0, cols: 1, topology: 'mesh' } })
    }));
    const mod = await import('../packages/compiler-api/src/compiler-driver/grid-resolver.js');
    const diagnostics: any[] = [];
    const out = mod.resolveGrid({
      target: { id: 'uma-cgra-base', raw: 'uma-cgra-base', span },
      targetProfileId: 'uma-cgra-base',
      kernel: null,
      span
    } as any, diagnostics);
    expect(out).toBeNull();
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('covers grid-resolver unknown-target branch fallback span', async () => {
    vi.doMock('@castm/lang-spec', () => ({
      resolveTargetProfileId: () => null,
      getTargetProfile: () => null
    }));
    vi.resetModules();
    const mod = await import('../packages/compiler-api/src/compiler-driver/grid-resolver.js');
    const diagnostics: any[] = [];
    expect(mod.resolveGrid({
      targetProfileId: 'unknown-profile',
      kernel: null,
      span
    } as any, diagnostics)).toBeNull();
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('covers prune-noop branch helper edge cases', () => {
    const noKernel = pruneNoopCyclesPass.run({ targetProfileId: 'uma-cgra-base', span, kernel: null } as any);
    expect(noKernel.output.kernel).toBeNull();

    const rowBranchAst = kernelAst([{
      index: 0,
      span,
      statements: [{ kind: 'row', row: 0, instructions: [{ text: 'BRA 1', opcode: '', operands: [], span }], span }]
    }]);
    const guarded = pruneNoopCyclesPass.run(rowBranchAst);
    expect(guarded.output.kernel?.cycles).toHaveLength(1);

    const missingTargetAst = kernelAst([{
      index: 0,
      span,
      statements: [{ kind: 'at', row: 0, col: 0, instruction: { text: 'BRA', opcode: 'BRA', operands: [], span }, span }]
    }]);
    const missingTarget = pruneNoopCyclesPass.run(missingTargetAst);
    expect(missingTarget.output.kernel?.cycles).toHaveLength(1);

    const opcodeFromTextAst = kernelAst([{
      index: 0,
      span,
      statements: [{ kind: 'at', row: 0, col: 0, instruction: { text: 'NOP', opcode: '', operands: [], span }, span }]
    }]);
    const opcodeFromText = pruneNoopCyclesPass.run(opcodeFromTextAst);
    expect(opcodeFromText.output.kernel?.cycles).toEqual([]);
  });

  it('covers parse-source grid topology and assert-empty-args branches', () => {
    const parsed = parseStructuredProgramFromSource(`
target base;
build {
  
  grid 2x2;
  grid 2x2 mesh;
}
kernel "k" {
  assert(at=@0,0);
}
`);
    expect(parsed.program.build?.grid?.topology).toBe('mesh');
    expect(parsed.diagnostics.some((d) => d.message.includes('Invalid assert statement'))).toBe(true);
  });

  it('covers for-expand-static loopControlStack undefined fallback directly', () => {
    const diagnostics: any[] = [];
    const kernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    let observedLoopStack: any[] | undefined;
    expandStaticForLoop({
      header: { variable: 'i', start: 0, end: 1, step: 1 },
      loopBody: [],
      lineNo: 1,
      lineLength: 10,
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: {
        cycleHasControlFlow: () => false,
        cloneCycle: (cycle: any) => cycle,
        parseInstruction: () => ({ text: 'NOP', opcode: 'NOP', operands: [], span }),
        makeControlCycle: (_idx, _lineNo, _row, _col, _text, label) => ({ index: 0, label, statements: [], span }),
        expandFunctionBodyIntoKernel: (
          _body: any,
          _kernel: any,
          _functions: any,
          _constants: any,
          _diagnostics: any,
          _cycleCounter: any,
          _callStack: any,
          _expansionCounter: any,
          _controlFlowCounter: any,
          _expansionContext: any,
          _isRoot: any,
          loopControlStack: any
        ) => {
          observedLoopStack = loopControlStack;
        }
      }
    } as any);
    expect(observedLoopStack?.length).toBe(1);
    expect(observedLoopStack?.[0]?.kind).toBe('for-static');
  });

  it('covers slot-pack internal helper branches and remap edge paths', () => {
    const utils = __slotPackTestUtils as any;
    expect(utils.normalizeOpcode({ text: 'nop', opcode: '', operands: [], span })).toBe('NOP');
    expect(utils.normalizeOpcode({ text: 'ignored', opcode: 'sadd', operands: [], span })).toBe('SADD');

    expect(utils.normalizedOperands({ text: 'JUMP 0x2', opcode: 'JUMP', operands: [], span })).toEqual(['0x2']);
    expect(utils.normalizedOperands({ text: 'JUMP', opcode: 'JUMP', operands: ['R0', ' R1 '], span })).toEqual(['R0', 'R1']);

    expect(utils.extractMemoryAddressKey({ text: 'LWD R0', opcode: 'LWD', operands: ['R0'], span })).toBeNull();
    expect(utils.extractMemoryAddressKey({ text: 'LWI R0', opcode: 'LWI', operands: ['R0'], span })).toBeNull();
    expect(utils.extractMemoryAddressKey({ text: 'LWI R0, 0x10', opcode: 'LWI', operands: ['R0', '0x10'], span })).toBe('0X10');

    expect(utils.expandStatement({ kind: 'at', row: -1, col: 0, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }, grid)).toBeNull();
    expect(utils.expandStatement({ kind: 'at', row: 0, col: -1, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }, grid)).toBeNull();
    expect(utils.expandStatement({ kind: 'row', row: -1, instructions: [], span }, grid)).toBeNull();
    expect(utils.expandStatement({ kind: 'row', row: 0, instructions: [], span }, grid)).toEqual([]);
    expect(utils.expandStatement({ kind: 'col', col: -1, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }, grid)).toBeNull();

    expect(utils.parseIntegerLiteral('')).toBeNull();
    expect(utils.parseIntegerLiteral('12')).toBe(12);
    expect(utils.parseIntegerLiteral('-0x2')).toBe(-2);
    expect(utils.parseIntegerLiteral('oops')).toBeNull();
    const parseIntSpy = vi.spyOn(Number, 'parseInt').mockReturnValueOnce(Number.POSITIVE_INFINITY as any);
    expect(utils.parseIntegerLiteral('12')).toBeNull();
    parseIntSpy.mockRestore();
    const parseIntHexSpy = vi.spyOn(Number, 'parseInt').mockReturnValueOnce(Number.POSITIVE_INFINITY as any);
    expect(utils.parseIntegerLiteral('0x2')).toBeNull();
    parseIntHexSpy.mockRestore();

    expect(utils.formatIntegerLike('0x2', 1)).toBe('0x1');
    expect(utils.formatIntegerLike('0x2', -1)).toBe('-0x1');
    expect(utils.formatIntegerLike('2', 3)).toBe('3');

    expect(utils.resolveRemappedCycleTarget(Number.NaN, [0], 1)).toBeNaN();
    expect(utils.resolveRemappedCycleTarget(-1, [0], 1)).toBe(-1);
    expect(utils.resolveRemappedCycleTarget(99, [0], 1)).toBe(99);
    expect(utils.resolveRemappedCycleTarget(2, [0, -1, -1], 1)).toBe(1);

    const cycleBuckets = [
      {
        label: undefined,
        span,
        barrier: false,
        placements: [
          { id: 1, row: 0, col: 0, instruction: { text: 'JUMP 0x2', opcode: 'JUMP', operands: ['0x2'], span }, originOrder: 0, hasControl: false, hasMemory: false, memoryAddressKey: null, routeSensitive: false, readsIncoming: false, writesRoute: false, isNoop: false, span },
          { id: 2, row: 0, col: 1, instruction: { text: 'JUMP', opcode: 'JUMP', operands: [], span }, originOrder: 1, hasControl: false, hasMemory: false, memoryAddressKey: null, routeSensitive: false, readsIncoming: false, writesRoute: false, isNoop: false, span }
        ]
      }
    ];
    utils.remapNumericBranchTargets(cycleBuckets, [0, -1, -1], 1);
    expect(cycleBuckets[0].placements[0].instruction.operands[0]).toBe('0x1');

    expect(utils.canPlacementMove({ hasControl: true, readsIncoming: false, hasMemory: false, isNoop: false }, { barrier: false }, 'strict')).toBe(false);
    expect(utils.maxPreviousCycleOnSamePe({ row: 0, col: 0, originOrder: 0 }, new Map(), new Map())).toBe(-1);

    const p = { id: 1, row: 0, col: 0, originOrder: 0, writesRoute: true, readsIncoming: false };
    const cycles = [{ barrier: false, placements: [p] }, { barrier: false, placements: [] }];
    const map = new Map([[1, 1]]);
    const coords = new Map([['0,0', [p]]]);
    expect(utils.canMovePlacementToCycle(p, 1, -1, cycles, map, coords, 'strict')).toBe(false);
    expect(utils.canMovePlacementToCycle(p, 1, 0, [{ barrier: true, placements: [p] }, { barrier: false, placements: [p] }], map, coords, 'strict')).toBe(false);
    const p2 = { id: 2, row: 0, col: 0, originOrder: 1, writesRoute: true, readsIncoming: false };
    const okCycles = [{ barrier: false, placements: [] }, { barrier: false, placements: [p2] }];
    const okMap = new Map([[2, 1]]);
    const okCoords = new Map([['0,0', [p2]]]);
    expect(utils.canMovePlacementToCycle(p2, 1, 0, okCycles, okMap, okCoords, 'strict')).toBe(true);

    expect(utils.normalizeWindow(Number.POSITIVE_INFINITY)).toBe(0);
    expect(utils.normalizeWindow(-3)).toBe(0);
    expect(utils.normalizeWindow(2.7)).toBe(2);
  });

  it('covers slot-pack run path for window normalization and row-fill/remap branches', () => {
    const ast = kernelAst([
      {
        index: 0,
        span,
        statements: [{ kind: 'row', row: 0, instructions: [{ text: 'JUMP 0x2', opcode: '', operands: [], span }, { text: 'NOP', opcode: 'NOP', operands: [], span }], span }]
      },
      {
        index: 1,
        span,
        statements: [{ kind: 'at', row: 0, col: 0, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }]
      },
      {
        index: 2,
        span,
        statements: [{ kind: 'at', row: 0, col: 0, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }]
      }
    ]);

    const passNeg = createSlotPackPass(grid, { window: -5, memoryReorderPolicy: 'strict' });
    const outNeg = passNeg.run(ast as any).output;
    expect(outNeg.kernel?.cycles.length).toBeGreaterThan(0);

    const passInf = createSlotPackPass(grid, { window: Number.POSITIVE_INFINITY, memoryReorderPolicy: 'strict' });
    const outInf = passInf.run(ast as any).output;
    expect(outInf.kernel?.cycles.length).toBeGreaterThan(0);
  });
});
