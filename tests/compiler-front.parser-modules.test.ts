import { describe, expect, it } from 'vitest';
import {
  buildFalseBranchInstruction,
  parseControlHeader,
  parseForHeader
} from '../packages/compiler-front/src/parser-core/control-flow.js';
import {
  expandLoopBody,
  parseInlineCycleStatements,
  parseLabeledCycleLine
} from '../packages/compiler-front/src/parser-core/cycle-expand.js';
import { consumeCycleScopeStatement } from '../packages/compiler-front/src/parser-core/cycle-scope.js';
import { consumeKernelCycleBlockStatement } from '../packages/compiler-front/src/parser-core/kernel-cycle-block-scope.js';
import { consumeKernelControlFlowStatement } from '../packages/compiler-front/src/parser-core/kernel-control-scope.js';
import { consumeKernelDirectivesStatement } from '../packages/compiler-front/src/parser-core/kernel-directives-scope.js';
import { consumeKernelForStatement } from '../packages/compiler-front/src/parser-core/kernel-for-scope.js';
import { consumeKernelFunctionCallStatement } from '../packages/compiler-front/src/parser-core/kernel-function-call-scope.js';
import { consumeKernelScopeStatement } from '../packages/compiler-front/src/parser-core/kernel-scope.js';
import { consumeTopLevelScopeStatement } from '../packages/compiler-front/src/parser-core/top-level-scope.js';
import {
  instantiateFunctionBody,
  makeControlCycle
} from '../packages/compiler-front/src/parser-core/function-expand.js';
import { parseDirective } from '../packages/compiler-front/src/parser-core/declarations.js';
import {
  bindFunctionCallArgs,
  parseFunctionCallLine,
  parseFunctionHeader,
  parseFunctionParams
} from '../packages/compiler-front/src/parser-core/functions.js';
import { parseInstruction } from '../packages/compiler-front/src/parser-core/instructions.js';
import { parseAdvancedStatementAsPragma, parseCycleStatement } from '../packages/compiler-front/src/parser-core/statements.js';
import { collectBlockFromEntries } from '../packages/compiler-front/src/parser-utils/blocks.js';
import { evaluateNumericExpression } from '../packages/compiler-front/src/parser-utils/numbers.js';
import { splitTopLevel } from '../packages/compiler-front/src/parser-utils/strings.js';

describe('compiler-front parser module contracts', () => {
  it('splits top-level lists while preserving nested delimiters', () => {
    const parts = splitTopLevel('R1, IMM(4, 5), A[i, j], foo({x:1, y:2})', ',');
    expect(parts).toEqual(['R1', 'IMM(4, 5)', 'A[i, j]', 'foo({x:1, y:2})']);
  });

  it('evaluates numeric expressions with constants and bindings', () => {
    const constants = new Map<string, number>([['BASE', 100], ['STRIDE', 4]]);
    const bindings = new Map<string, number>([['i', 3]]);
    expect(evaluateNumericExpression('BASE + i * STRIDE', constants, bindings)).toBe(112);
    expect(evaluateNumericExpression('BASE + unknown', constants, bindings)).toBeNull();
  });

  it('parses instruction forms for assignment and ISA opcodes', () => {
    const assign = parseInstruction('R1 = R2 + R3', 3, 5);
    const opcode = parseInstruction('SADD R1, R2, R3', 4, 1);
    expect(assign.opcode).toBeNull();
    expect(assign.text).toBe('R1 = R2 + R3');
    expect(opcode.opcode).toBe('SADD');
    expect(opcode.operands).toEqual(['R1', 'R2', 'R3']);
  });

  it('parses advanced statements and cycle placements', () => {
    expect(parseAdvancedStatementAsPragma('route(@0,1 -> @0,0, payload=R3, accum=R1);')).toBe(
      'route(@0,1 -> @0,0, payload=R3, accum=R1)'
    );

    const cycleStmt = parseCycleStatement(
      'at @0,1: SADD R1, R2, R3;',
      7,
      'at @0,1: SADD R1, R2, R3;',
      new Map(),
      new Map()
    );
    expect(cycleStmt).toMatchObject({
      kind: 'at',
      row: 0,
      col: 1
    });
  });

  it('parses canonical let declarations into directive AST nodes', () => {
    expect(parseDirective('let K = 42;', 1)).toMatchObject({ kind: 'const', name: 'K', value: '42' });
    expect(parseDirective('let acc = R1;', 2)).toMatchObject({ kind: 'alias', name: 'acc', value: 'R1' });
    expect(parseDirective('let A = { 1, 2, 3 };', 3)).toMatchObject({ kind: 'data', name: 'A' });
    expect(parseDirective('let M[2][2] = { 1, 2, 3, 4 };', 4)).toMatchObject({ kind: 'data2d', name: 'M' });
  });

  it('collects block bodies and trailing else markers from entries', () => {
    const entries = [
      { lineNo: 1, rawLine: 'if (R0 == IMM(0)) at @0,0 {', cleanLine: 'if (R0 == IMM(0)) at @0,0 {' },
      { lineNo: 2, rawLine: 'cycle { @0,0: NOP; }', cleanLine: 'cycle { @0,0: NOP; }' },
      { lineNo: 3, rawLine: '} else {', cleanLine: '} else {' },
      { lineNo: 4, rawLine: 'cycle { @0,0: NOP; }', cleanLine: 'cycle { @0,0: NOP; }' },
      { lineNo: 5, rawLine: '}', cleanLine: '}' }
    ];

    const block = collectBlockFromEntries(entries, 0);
    expect(block.endIndex).toBe(2);
    expect(block.trailingAfterClose).toBe('else {');
    expect(block.body).toHaveLength(1);
  });

  it('parses canonical for header and if/while control headers', () => {
    const diags: any[] = [];
    const forHeader = parseForHeader(
      'for R0 in range(0, N, 2) at @1,2 runtime {',
      10,
      new Map([['N', 8]]),
      new Map(),
      diags
    );
    const ifHeader = parseControlHeader(
      'if (R1 < IMM(10)) at @0,3 {',
      'if',
      11,
      new Map(),
      diags
    );

    expect(forHeader).toMatchObject({
      variable: 'R0',
      start: 0,
      end: 8,
      step: 2,
      runtime: true,
      control: { row: 1, col: 2 }
    });
    expect(ifHeader).toMatchObject({
      condition: { lhs: 'R1', operator: '<', rhs: 'IMM(10)' },
      row: 0,
      col: 3
    });
  });

  it('builds false branch instructions for control conditions', () => {
    expect(buildFalseBranchInstruction({ lhs: 'R0', operator: '==', rhs: 'IMM(0)' }, 'L1')).toBe('BNE R0, IMM(0), L1');
    expect(buildFalseBranchInstruction({ lhs: 'R0', operator: '<=', rhs: 'R1' }, 'L2')).toBe('BLT R1, R0, L2');
  });

  it('parses and binds canonical function headers and calls', () => {
    const diagnostics: any[] = [];
    const header = parseFunctionHeader('function mix(dst, src) {');
    const params = parseFunctionParams(header?.paramsText ?? '', 1, diagnostics);
    const call = parseFunctionCallLine('mix(R1, src: R2);');
    const bound = bindFunctionCallArgs(
      { name: 'mix', params: params ?? [] },
      call?.args ?? [],
      2,
      diagnostics
    );

    expect(header?.name).toBe('mix');
    expect(params).toEqual(['dst', 'src']);
    expect(call).toEqual({ name: 'mix', args: ['R1', 'src: R2'] });
    expect(bound?.get('dst')).toBe('R1');
    expect(bound?.get('src')).toBe('R2');
  });

  it('parses labeled/inline cycle forms in cycle expand helpers', () => {
    const labeled = parseLabeledCycleLine('L0: cycle { @0,0: NOP; }');
    expect(labeled?.label).toBe('L0');
    expect(labeled?.inlinePayload?.trim()).toBe('@0,0: NOP;');

    const diagnostics: any[] = [];
    const inline = parseInlineCycleStatements('@0,0: NOP; at row 1: NOP | NOP;', 20, new Map(), diagnostics);
    expect(inline).toHaveLength(2);
    expect(diagnostics).toHaveLength(0);
  });

  it('expands compile-time for loops inside cycle bodies', () => {
    const diagnostics: any[] = [];
    const body = [
      { lineNo: 1, rawLine: 'for i in range(0, 2) {', cleanLine: 'for i in range(0, 2) {' },
      { lineNo: 2, rawLine: '@0,0: NOP;', cleanLine: '@0,0: NOP;' },
      { lineNo: 3, rawLine: '}', cleanLine: '}' }
    ];
    const expanded = expandLoopBody(body, new Map(), new Map(), diagnostics);
    expect(expanded).toHaveLength(2);
    expect(expanded.every((stmt) => stmt.kind === 'at')).toBe(true);
    expect(diagnostics).toHaveLength(0);
  });

  it('instantiates function bodies with argument substitution and stable control cycles', () => {
    const diagnostics: any[] = [];
    const instantiated = instantiateFunctionBody(
      {
        name: 'mix',
        params: ['dst', 'src'],
        body: [{ lineNo: 1, rawLine: 'cycle { @0,0: dst = src; }', cleanLine: 'cycle { @0,0: dst = src; }' }],
        span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 }
      },
      ['R1', 'R2'],
      10,
      diagnostics,
      { value: 0 }
    );

    expect(instantiated?.[0].cleanLine).toContain('R1');
    expect(instantiated?.[0].cleanLine).toContain('R2');
    expect(diagnostics).toHaveLength(0);

    const ctrl = makeControlCycle(3, 12, 0, 1, 'NOP', 'L0');
    expect(ctrl.index).toBe(3);
    expect(ctrl.label).toBe('L0');
    expect(ctrl.statements[0].kind).toBe('at');
  });

  it('consumes cycle-scope statements and appends parsed operations', () => {
    const diagnostics: any[] = [];
    const currentCycle: any = {
      index: 0,
      statements: [],
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    };

    const consumed = consumeCycleScopeStatement({
      lines: ['@0,0: NOP;'],
      index: 0,
      lineNo: 1,
      rawLine: '@0,0: NOP;',
      clean: '@0,0: NOP;',
      cycleConstants: new Map(),
      diagnostics,
      currentCycle
    });

    expect(consumed.shouldBreak).toBe(false);
    expect(consumed.nextIndex).toBe(0);
    expect(consumed.currentCycle?.statements).toHaveLength(1);
    expect(diagnostics).toHaveLength(0);
  });

  it('consumes kernel-scope statements and can enter cycle mode', () => {
    const diagnostics: any[] = [];
    const kernel: any = {
      name: 'k',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    };

    const cfg = consumeKernelScopeStatement({
      lines: ['config(0xF, 0);'],
      index: 0,
      lineNo: 1,
      clean: 'config(0xF, 0);',
      kernel,
      functions: new Map(),
      kernelConstants: new Map(),
      diagnostics,
      cycleIndex: 0,
      functionExpansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 }
    });
    expect(cfg.enterCycle).toBe(false);
    expect(kernel.config?.mask).toBe(0xf);

    const enter = consumeKernelScopeStatement({
      lines: ['cycle {'],
      index: 0,
      lineNo: 2,
      clean: 'cycle {',
      kernel,
      functions: new Map(),
      kernelConstants: cfg.kernelConstants,
      diagnostics,
      cycleIndex: cfg.cycleIndex,
      functionExpansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 }
    });
    expect(enter.enterCycle).toBe(true);
    expect(enter.currentCycle?.index).toBe(0);
    expect(diagnostics).toHaveLength(0);
  });

  it('consumes kernel control-flow statements for if/else and while', () => {
    const diagnostics: any[] = [];
    const kernel: any = {
      name: 'k',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    };

    const ifLines = [
      'if (R0 == IMM(0)) at @0,0 {',
      'cycle { @0,0: NOP; }',
      '} else {',
      'cycle { @0,0: NOP; }',
      '}'
    ];
    const ifResult = consumeKernelControlFlowStatement({
      lines: ifLines,
      index: 0,
      lineNo: 1,
      clean: ifLines[0],
      kernel,
      functions: new Map(),
      kernelConstants: new Map(),
      diagnostics,
      cycleIndex: 0,
      functionExpansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 }
    });
    expect(ifResult.handled).toBe(true);
    expect(ifResult.shouldBreak).toBe(false);
    expect(ifResult.nextIndex).toBe(4);
    expect(ifResult.cycleIndex).toBeGreaterThan(0);

    const whileLines = [
      'while (R0 != ZERO) at @0,0 {',
      'cycle { @0,0: NOP; }',
      '}'
    ];
    const whileResult = consumeKernelControlFlowStatement({
      lines: whileLines,
      index: 0,
      lineNo: 1,
      clean: whileLines[0],
      kernel,
      functions: new Map(),
      kernelConstants: new Map(),
      diagnostics,
      cycleIndex: ifResult.cycleIndex,
      functionExpansionCounter: { value: 0 },
      controlFlowCounter: { value: 1 }
    });
    expect(whileResult.handled).toBe(true);
    expect(whileResult.shouldBreak).toBe(false);
    expect(whileResult.nextIndex).toBe(2);
    expect(whileResult.cycleIndex).toBeGreaterThan(ifResult.cycleIndex);
    expect(diagnostics).toHaveLength(0);
  });

  it('consumes kernel directive/config statements in isolation', () => {
    const diagnostics: any[] = [];
    const kernel: any = {
      name: 'k',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    };
    const constants = new Map<string, number>();

    const config = consumeKernelDirectivesStatement({
      lineNo: 1,
      clean: 'config(0xF, 64);',
      kernel,
      kernelConstants: constants,
      diagnostics
    });
    expect(config.handled).toBe(true);
    expect(kernel.config).toMatchObject({ mask: 0xf, startAddr: 64 });

    const constant = consumeKernelDirectivesStatement({
      lineNo: 2,
      clean: 'let K = 42;',
      kernel,
      kernelConstants: constants,
      diagnostics
    });
    expect(constant.handled).toBe(true);
    expect(constants.get('K')).toBe(42);

    const legacy = consumeKernelDirectivesStatement({
      lineNo: 3,
      clean: '#pragma route @0,1 -> @0,0 payload(R1)',
      kernel,
      kernelConstants: constants,
      diagnostics
    });
    expect(legacy.handled).toBe(true);
    expect(diagnostics.some((d) => /Legacy pragma syntax/.test(d.message))).toBe(true);
  });

  it('consumes kernel for-loop statements in isolation', () => {
    const diagnostics: any[] = [];
    const kernel: any = {
      name: 'k',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    };
    const lines = [
      'for i in range(0, 2) {',
      'cycle { @0,0: NOP; }',
      '}'
    ];

    const result = consumeKernelForStatement({
      lines,
      index: 0,
      lineNo: 1,
      clean: lines[0],
      kernel,
      functions: new Map(),
      kernelConstants: new Map(),
      diagnostics,
      cycleIndex: 0,
      functionExpansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 }
    });

    expect(result.handled).toBe(true);
    expect(result.shouldBreak).toBe(false);
    expect(result.nextIndex).toBe(2);
    expect(result.cycleIndex).toBeGreaterThan(0);
    expect(diagnostics).toHaveLength(0);
  });

  it('consumes kernel cycle block statements in isolation', () => {
    const diagnostics: any[] = [];
    const kernel: any = {
      name: 'k',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    };
    const constants = new Map<string, number>();

    const inline = consumeKernelCycleBlockStatement({
      lines: ['cycle { @0,0: NOP; }'],
      index: 0,
      lineNo: 1,
      clean: 'cycle { @0,0: NOP; }',
      kernel,
      kernelConstants: constants,
      diagnostics,
      cycleIndex: 0
    });
    expect(inline.handled).toBe(true);
    expect(inline.enterCycle).toBe(false);
    expect(inline.cycleIndex).toBe(1);

    const open = consumeKernelCycleBlockStatement({
      lines: ['cycle {'],
      index: 0,
      lineNo: 2,
      clean: 'cycle {',
      kernel,
      kernelConstants: constants,
      diagnostics,
      cycleIndex: inline.cycleIndex
    });
    expect(open.handled).toBe(true);
    expect(open.enterCycle).toBe(true);
    expect(open.currentCycle?.index).toBe(1);
    expect(diagnostics).toHaveLength(0);
  });

  it('consumes kernel function-call statements in isolation', () => {
    const diagnostics: any[] = [];
    const kernel: any = {
      name: 'k',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    };
    const functions = new Map<string, any>([
      [
        'mix',
        {
          name: 'mix',
          params: ['dst', 'src'],
          body: [{ lineNo: 1, rawLine: 'cycle { @0,0: dst = src; }', cleanLine: 'cycle { @0,0: dst = src; }' }],
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 }
        }
      ]
    ]);

    const result = consumeKernelFunctionCallStatement({
      lineNo: 1,
      clean: 'mix(R1, R2);',
      kernel,
      functions,
      kernelConstants: new Map(),
      diagnostics,
      cycleIndex: 0,
      functionExpansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 }
    });

    expect(result.handled).toBe(true);
    expect(result.cycleIndex).toBeGreaterThan(0);
    expect(diagnostics).toHaveLength(0);
  });

  it('consumes top-level scope statements for target/function/kernel', () => {
    const diagnostics: any[] = [];
    const ast: any = {
      targetProfileId: null,
      kernel: null,
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    };
    const pendingDirectives: any[] = [];
    const functions = new Map<string, any>();

    const target = consumeTopLevelScopeStatement({
      lines: ['target "uma-cgra-base";'],
      index: 0,
      lineNo: 1,
      clean: 'target "uma-cgra-base";',
      ast,
      kernel: null,
      kernelConstants: new Map(),
      pendingDirectives,
      functions,
      diagnostics
    });
    expect(ast.targetProfileId).toBe('uma-cgra-base');
    expect(target.inKernel).toBe(false);

    const fnLines = ['function f(x) {', 'cycle { @0,0: NOP; }', '}'];
    const fn = consumeTopLevelScopeStatement({
      lines: fnLines,
      index: 0,
      lineNo: 1,
      clean: 'function f(x) {',
      ast,
      kernel: null,
      kernelConstants: new Map(),
      pendingDirectives,
      functions,
      diagnostics
    });
    expect(functions.has('f')).toBe(true);
    expect(fn.nextIndex).toBe(2);

    const openKernel = consumeTopLevelScopeStatement({
      lines: ['kernel "k" {'],
      index: 0,
      lineNo: 1,
      clean: 'kernel "k" {',
      ast,
      kernel: null,
      kernelConstants: new Map(),
      pendingDirectives,
      functions,
      diagnostics
    });
    expect(openKernel.inKernel).toBe(true);
    expect(openKernel.kernel?.name).toBe('k');
    expect(diagnostics).toHaveLength(0);
  });
});
