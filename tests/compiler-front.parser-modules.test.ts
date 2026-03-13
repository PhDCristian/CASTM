import { describe, expect, it } from 'vitest';
import {
  buildFalseBranchInstruction,
  parseControlHeader,
  parseForHeader
} from '../packages/compiler-front/src/structured-core/lowering/control-flow.js';
import {
  expandLoopBody,
  parseInlineCycleStatements,
  parseLabeledCycleLine
} from '../packages/compiler-front/src/structured-core/lowering/cycle-expand.js';
import {
  instantiateFunctionBody,
  makeControlCycle
} from '../packages/compiler-front/src/structured-core/lowering/function-expand.js';
import { parseDirective } from '../packages/compiler-front/src/structured-core/lowering/declarations.js';
import {
  bindFunctionCallArgs,
  parseFunctionCallLine,
  parseFunctionHeader,
  parseFunctionParams
} from '../packages/compiler-front/src/structured-core/lowering/functions.js';
import { parseInstruction } from '../packages/compiler-front/src/structured-core/lowering/instructions.js';
import {
  parseAdvancedNamespaceIssue,
  parseAdvancedStatementAsPragma,
  parseCycleStatement,
  parseStandardAdvancedCall
} from '../packages/compiler-front/src/structured-core/lowering/statements.js';
import { collectBlockFromEntries } from '../packages/compiler-front/src/structured-core/parser-utils/blocks.js';
import { evaluateNumericExpression } from '../packages/compiler-front/src/structured-core/parser-utils/numbers.js';
import { splitTopLevel } from '../packages/compiler-front/src/structured-core/parser-utils/strings.js';
import { buildConstantMap } from '../packages/compiler-front/src/structured-core/lowering/top-level-scope/constants.js';
import { parsePipelineCallSequence } from '../packages/compiler-front/src/structured-core/statements/matchers.js';

describe('compiler-front lowering module contracts', () => {
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
    expect(parseAdvancedStatementAsPragma('triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);')).toBe(
      'triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1)'
    );
    expect(parseAdvancedStatementAsPragma('guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);')).toBe(
      'guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1)'
    );
    expect(parseAdvancedStatementAsPragma('accumulate(pattern=row, products=R2, accum=R3, out=ROUT);')).toBe(
      'accumulate(pattern=row, products=R2, accum=R3, out=ROUT)'
    );
    expect(parseAdvancedStatementAsPragma('mulacc_chain(src=R0, coeff=R1, acc=R3, out=R0, target=row(0), width=16, dir=right);')).toBe(
      'mulacc_chain(src=R0, coeff=R1, acc=R3, out=R0, target=row(0), width=16, dir=right)'
    );
    expect(parseAdvancedStatementAsPragma('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0);')).toBe(
      'carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0)'
    );
    expect(parseAdvancedStatementAsPragma('conditional_sub(value=R0, sub=R1, dest=R2, target=row(1));')).toBe(
      'conditional_sub(value=R0, sub=R1, dest=R2, target=row(1))'
    );
    expect(parseAdvancedStatementAsPragma('collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);')).toBe(
      'collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add)'
    );
    expect(parseAdvancedStatementAsPragma('stash(action=save, reg=R0, addr=L[0], target=point(3,0));')).toBe(
      'stash(action=save, reg=R0, addr=L[0], target=point(3,0))'
    );
    expect(parseAdvancedStatementAsPragma('normalize(reg=R3, carry=R1, width=16, lane=0);')).toBe(
      'normalize(reg=R3, carry=R1, width=16, lane=0)'
    );
    expect(parseAdvancedStatementAsPragma('extract_bytes(src=R0, dest=R1, axis=col);')).toBe(
      'extract_bytes(src=R0, dest=R1, axis=col)'
    );
    expect(parseAdvancedStatementAsPragma('latency_hide(window=1, mode=conservative);')).toBe(
      'latency_hide(window=1, mode=conservative)'
    );
    expect(parseAdvancedStatementAsPragma('foo();')).toBeNull();
    expect(parseStandardAdvancedCall('std::unknown(x);')).toBeNull();
    expect(parseAdvancedNamespaceIssue('vendor::unknown(x);')).toBeNull();
    expect(parseAdvancedNamespaceIssue('vendor::route(@0,1 -> @0,0, payload=R3, accum=R1);')).toMatchObject({
      namespace: 'vendor',
      name: 'route'
    });

    const cycleStmt = parseCycleStatement(
      'at @0,1: SADD R1, R2, R3;',
      7,
      'at @0,1: SADD R1, R2, R3;',
      new Map(),
      new Map()
    );
    expect(cycleStmt).toHaveLength(1);
    expect(cycleStmt?.[0]).toMatchObject({
      kind: 'at',
      row: 0,
      col: 1
    });

    expect(parsePipelineCallSequence('pipeline(stepA(), stepB(R0), stepC(out_addr));')).toEqual([
      { name: 'stepA', args: [] },
      { name: 'stepB', args: ['R0'] },
      { name: 'stepC', args: ['out_addr'] }
    ]);
    expect(parsePipelineCallSequence('pipeline();')).toBeNull();
    expect(parsePipelineCallSequence('pipeline(,);')).toBeNull();
    expect(parsePipelineCallSequence('pipeline(route(@0,1 -> @0,0, payload=R3, accum=R1));')).toBeNull();
    expect(parsePipelineCallSequence('pipeline(stepA, stepB());')).toBeNull();
    expect(parsePipelineCallSequence('foo(stepA(), stepB());')).toBeUndefined();
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
      { lineNo: 2, rawLine: 'bundle { @0,0: NOP; }', cleanLine: 'bundle { @0,0: NOP; }' },
      { lineNo: 3, rawLine: '} else {', cleanLine: '} else {' },
      { lineNo: 4, rawLine: 'bundle { @0,0: NOP; }', cleanLine: 'bundle { @0,0: NOP; }' },
      { lineNo: 5, rawLine: '}', cleanLine: '}' }
    ];

    const block = collectBlockFromEntries(entries, 0);
    expect(block.endIndex).toBe(2);
    expect(block.trailingAfterClose).toBe('else {');
    expect(block.body).toHaveLength(1);
  });

  it('parses canonical for header and if control headers', () => {
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
    expect(ifHeader).toMatchObject({ row: 0, col: 3 });
    expect(diags).toHaveLength(0);
  });

  it('builds false-branch instructions from parsed conditions', () => {
    expect(buildFalseBranchInstruction({ lhs: 'R1', operator: '==', rhs: 'IMM(0)' }, 'L1')).toBe('BNE R1, IMM(0), L1');
    expect(buildFalseBranchInstruction({ lhs: 'R2', operator: '<', rhs: 'IMM(8)' }, 'L2')).toBe('BGE R2, IMM(8), L2');
  });

  it('parses and expands inline/labeled cycle statements', () => {
    const diagnostics: any[] = [];
    const inline = parseInlineCycleStatements('@0,0: NOP; at row 1: NOP | NOP;', 20, new Map(), diagnostics);
    expect(inline).toHaveLength(2);
    expect(inline[0]).toMatchObject({ kind: 'at', row: 0, col: 0 });
    expect(parseLabeledCycleLine('L0: bundle { @0,0: NOP; }')).toMatchObject({ label: 'L0' });
    expect(diagnostics).toHaveLength(0);
  });

  it('expands compile-time for loops inside cycle bodies', () => {
    const diagnostics: any[] = [];
    const body = [
      { lineNo: 1, rawLine: 'for i in range(0, 2) {', cleanLine: 'for i in range(0, 2) {' },
      { lineNo: 2, rawLine: 'at @0,i: NOP;', cleanLine: 'at @0,i: NOP;' },
      { lineNo: 3, rawLine: '}', cleanLine: '}' }
    ];
    const expanded = expandLoopBody(body, new Map(), new Map(), diagnostics);
    expect(expanded).toHaveLength(2);
    expect(expanded[0]).toMatchObject({ kind: 'at', row: 0, col: 0 });
    expect(expanded[1]).toMatchObject({ kind: 'at', row: 0, col: 1 });
    expect(diagnostics).toHaveLength(0);
  });

  it('binds function args and instantiates labeled bodies', () => {
    const diagnostics: any[] = [];
    const def = {
      name: 'mix',
      params: ['dst', 'src'],
      body: [
        { lineNo: 1, rawLine: 'L0: bundle { @0,0: dst = src + IMM(1); }', cleanLine: 'L0: bundle { @0,0: dst = src + IMM(1); }' }
      ],
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 }
    };

    const bound = bindFunctionCallArgs(def, ['R1', 'R2'], 9, diagnostics);
    expect(bound?.get('dst')).toBe('R1');
    expect(parseFunctionCallLine('mix(R1, R2);')).toEqual({ name: 'mix', args: ['R1', 'R2'] });
    expect(parseFunctionHeader('function mix(dst, src) {')).toEqual({ name: 'mix', paramsText: 'dst, src' });
    expect(parseFunctionParams('dst, src', 1, diagnostics)).toEqual(['dst', 'src']);

    const instantiated = instantiateFunctionBody(def, ['R1', 'R2'], 9, diagnostics, { value: 0 });
    expect(instantiated?.[0].cleanLine).toContain('__fn_mix_0_L0');
    expect(instantiated?.[0].cleanLine).toContain('R1 = R2 + IMM(1)');
  });

  it('builds constant map and explicit control cycle helper', () => {
    const diagnostics: any[] = [];
    const constants = buildConstantMap([
      { kind: 'const', name: 'N', value: '8', span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 } }
    ], diagnostics);
    expect(constants.get('N')).toBe(8);

    const control = makeControlCycle(0, 1, 0, 0, 'BNE R0, IMM(0), L1', 'L0');
    expect(control.label).toBe('L0');
    expect(control.statements[0]).toMatchObject({ kind: 'at', row: 0, col: 0 });
    expect(diagnostics).toHaveLength(0);
  });

  it('accepts "bundle" as alias for "cycle" in inline and labeled forms', () => {
    const diagnostics: any[] = [];

    // Inline bundle
    const inline = parseInlineCycleStatements('@0,0: NOP;', 1, new Map(), diagnostics);
    expect(inline).toHaveLength(1);

    // Labeled bundle
    expect(parseLabeledCycleLine('L0: bundle { @0,0: NOP; }')).toMatchObject({ label: 'L0', inlinePayload: '@0,0: NOP; ' });
    expect(parseLabeledCycleLine('L1: bundle {')).toMatchObject({ label: 'L1' });

    // Labeled cycle still works
    expect(parseLabeledCycleLine('L2: bundle { @0,0: NOP; }')).toMatchObject({ label: 'L2' });

    expect(diagnostics).toHaveLength(0);
  });
});
