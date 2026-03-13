import { describe, expect, it } from 'vitest';
import {
  Diagnostic,
  DirectiveAst,
  ErrorCodes,
  KernelAst,
  spanAt
} from '@castm/compiler-ir';
import { resolveOptionalElseBlockInFunction } from '../packages/compiler-front/src/structured-core/lowering/function-expand-if/else-resolution.js';
import { tryExpandFunctionCall } from '../packages/compiler-front/src/structured-core/lowering/function-expand-call.js';
import { buildConstantMap } from '../packages/compiler-front/src/structured-core/lowering/top-level-scope/constants.js';
import { buildFalseBranchInstruction, parseControlHeader } from '../packages/compiler-front/src/structured-core/lowering/control-flow-branch.js';
import {
  buildRuntimeNoUnrollAggressivePlan,
  buildRuntimeNoUnrollExitBranch,
  chooseJumpColumn
} from '../packages/compiler-front/src/structured-core/lowering/for-expand-helpers/runtime-plan.js';
import { buildRuntimeLoopPlan } from '../packages/compiler-front/src/structured-core/lowering/for-expand-runtime/build-plan.js';
import { parseInstruction } from '../packages/compiler-front/src/structured-core/lowering/instructions.js';
import { buildWhileFusionPlan, rewriteConditionForWhileFusion } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/while-fusion.js';
import { tryParseControlStatement } from '../packages/compiler-front/src/structured-core/statements/control-handler.js';
import { emitWhileControlFlowCycles } from '../packages/compiler-front/src/structured-core/lowering/control-flow-emit/while-cycles.js';
import { lowerStructuredProgramToAst, toStructuredProgramAst } from '../packages/compiler-front/src/structured-core/conversion.js';
import { parseStructuredProgramFromSource } from '../packages/compiler-front/src/structured-core/parse-source.js';

const span = spanAt(1, 1, 1);

function entry(lineNo: number, cleanLine: string, rawLine = cleanLine) {
  return { lineNo, cleanLine, rawLine };
}

function makeKernel(): KernelAst {
  return {
    name: 'k',
    config: undefined,
    directives: [],
    pragmas: [],
    cycles: [],
    span
  };
}

describe('compiler-front branch holes', () => {
  it('resolves optional else blocks for trailing and next-line forms including unterminated cases', () => {
    const diagnostics: Diagnostic[] = [];

    const trailingElseBody = [
      entry(1, 'if (R0 == IMM(0)) at @0,0 {'),
      entry(2, '@0,0: NOP;'),
      entry(3, '} else {'),
      entry(4, '@0,1: NOP;')
    ];
    const trailing = resolveOptionalElseBlockInFunction(
      trailingElseBody,
      { body: [], endIndex: 2, trailingAfterClose: 'else {' },
      1,
      trailingElseBody[0].cleanLine.length,
      diagnostics
    );
    expect(trailing.shouldBreak).toBe(true);
    expect(diagnostics.at(-1)?.message).toContain('Unterminated else block');

    const diagnostics2: Diagnostic[] = [];
    const nextLineElseBody = [
      entry(1, 'if (R0 == IMM(0)) at @0,0 {'),
      entry(2, '@0,0: NOP;'),
      entry(3, '}'),
      entry(4, 'else {'),
      entry(5, '@0,1: NOP;')
    ];
    const nextLine = resolveOptionalElseBlockInFunction(
      nextLineElseBody,
      { body: [], endIndex: 2 },
      1,
      nextLineElseBody[0].cleanLine.length,
      diagnostics2
    );
    expect(nextLine.shouldBreak).toBe(true);
    expect(diagnostics2.at(-1)?.message).toContain('Unterminated else block');
  });

  it('expands function calls with recursion guard, arg failure and success path', () => {
    const kernel = makeKernel();
    const fn = {
      name: 'mix',
      params: ['dst', 'src'],
      body: [entry(10, 'bundle { @0,0: dst = src + IMM(1); }')],
      span
    };
    const functions = new Map([[fn.name, fn]]);
    const constants = new Map<string, number>();
    const expansionCounter = { value: 0 };
    const controlFlowCounter = { value: 0 };
    const cycleCounter = { value: 0 };

    const recursiveDiagnostics: Diagnostic[] = [];
    const recursive = tryExpandFunctionCall({
      body: [entry(1, 'mix(R1, R0);')],
      index: 0,
      entry: entry(1, 'mix(R1, R0);'),
      clean: 'mix(R1, R0);',
      kernel,
      functions,
      constants,
      diagnostics: recursiveDiagnostics,
      cycleCounter,
      callStack: ['mix'],
      expansionCounter,
      controlFlowCounter,
      expandBody: () => {}
    });
    expect(recursive.handled).toBe(true);
    expect(recursiveDiagnostics.at(-1)?.message).toContain('Recursive function call detected');

    const badArgsDiagnostics: Diagnostic[] = [];
    const badArgs = tryExpandFunctionCall({
      body: [entry(2, 'mix(R1);')],
      index: 0,
      entry: entry(2, 'mix(R1);'),
      clean: 'mix(R1);',
      kernel: makeKernel(),
      functions,
      constants,
      diagnostics: badArgsDiagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {}
    });
    expect(badArgs.handled).toBe(true);
    expect(badArgsDiagnostics.at(-1)?.message).toContain('Missing argument');

    let expanded = false;
    const ok = tryExpandFunctionCall({
      body: [entry(3, 'mix(R2, R1);')],
      index: 0,
      entry: entry(3, 'mix(R2, R1);'),
      clean: 'mix(R2, R1);',
      kernel: makeKernel(),
      functions,
      constants,
      diagnostics: [],
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {
        expanded = true;
      }
    });
    expect(ok.handled).toBe(true);
    expect(expanded).toBe(true);
  });

  it('builds constant map and reports invalid numeric const expressions', () => {
    const directives: DirectiveAst[] = [
      { kind: 'const', name: 'A', value: '4', span },
      { kind: 'const', name: 'B', value: 'A + 2', span },
      { kind: 'const', name: 'BAD', value: 'A +', span }
    ];
    const diagnostics: Diagnostic[] = [];
    const constants = buildConstantMap(directives, diagnostics);

    expect(constants.get('A')).toBe(4);
    expect(constants.get('B')).toBe(6);
    expect(constants.has('BAD')).toBe(false);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('parses control headers and false-branch instruction mapping', () => {
    const diagnostics: Diagnostic[] = [];
    const ifOk = parseControlHeader('if (R0 == 1) at @0,1 {', 'if', 1, new Map(), diagnostics);
    expect(ifOk).toMatchObject({ row: 0, col: 1 });

    const badCondition = parseControlHeader('if (R0) at @0,1 {', 'if', 2, new Map(), diagnostics);
    expect(badCondition).toBeNull();
    expect(diagnostics.at(-1)?.message).toContain('Invalid if condition');

    const badLocation = parseControlHeader('while (R0 < 3) at @x,1 {', 'while', 3, new Map(), diagnostics);
    expect(badLocation).toBeNull();
    expect(diagnostics.at(-1)?.message).toContain('Invalid while control location');

    expect(buildFalseBranchInstruction({ lhs: 'R0', operator: '==', rhs: 'R1' }, 'L')).toContain('BNE');
    expect(buildFalseBranchInstruction({ lhs: 'R0', operator: '!=', rhs: 'R1' }, 'L')).toContain('BEQ');
    expect(buildFalseBranchInstruction({ lhs: 'R0', operator: '<', rhs: 'R1' }, 'L')).toContain('BGE');
    expect(buildFalseBranchInstruction({ lhs: 'R0', operator: '>=', rhs: 'R1' }, 'L')).toContain('BLT');
    expect(buildFalseBranchInstruction({ lhs: 'R0', operator: '>', rhs: 'R1' }, 'L')).toContain('BGE R1, R0');
    expect(buildFalseBranchInstruction({ lhs: 'R0', operator: '<=', rhs: 'R1' }, 'L')).toContain('BLT R1, R0');
  });

  it('covers runtime-for helper planning branches', () => {
    expect(chooseJumpColumn(0)).toBe(1);
    expect(chooseJumpColumn(0, 1)).toBe(2);
    expect(buildRuntimeNoUnrollExitBranch('R0', 10, 'L_END', 1)).toContain('BGE R0');
    expect(buildRuntimeNoUnrollExitBranch('R0', 10, 'L_END', -1)).toContain('BGE 10, R0');

    const loopCycle = {
      index: 0,
      span,
      statements: [
        {
          kind: 'at' as const,
          row: 0,
          col: 1,
          instruction: parseInstruction('SADD R1, R0, IMM(1)', 1, 1),
          span
        }
      ]
    };
    const aggressive = buildRuntimeNoUnrollAggressivePlan(
      [loopCycle as any],
      'R0',
      0,
      0,
      () => false,
      parseInstruction
    );
    expect(aggressive).not.toBeNull();
    expect(aggressive?.incomingRegister).toBe('RCL');
    expect(aggressive?.bodyInstruction.text).toContain('R3');

    expect(buildRuntimeNoUnrollAggressivePlan([loopCycle as any, loopCycle as any], 'R0', 0, 0, () => false, parseInstruction)).toBeNull();
    expect(buildRuntimeNoUnrollAggressivePlan([loopCycle as any], 'R0', 0, 3, () => false, parseInstruction)).toBeNull();
  });

  it('buildRuntimeLoopPlan defaults control position when header has no explicit control', () => {
    const plan = buildRuntimeLoopPlan({
      header: { variable: 'R0', start: 0, end: 2, step: 1, runtime: true },
      loopBody: [entry(10, 'bundle { @0,1: SADD R1, R0, IMM(1); }')],
      lineNo: 10,
      lineLength: 40,
      kernel: makeKernel(),
      functions: new Map(),
      constants: new Map(),
      diagnostics: [],
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: {
        cycleHasControlFlow: () => false,
        cloneCycle: (cycle) => ({ ...cycle }),
        parseInstruction,
        makeControlCycle: (index, lineNo, row, col, text, label) => ({
          index,
          label,
          span: spanAt(lineNo, 1, text.length),
          statements: [{
            kind: 'at',
            row,
            col,
            instruction: parseInstruction(text, lineNo, 1),
            span: spanAt(lineNo, 1, text.length)
          }]
        }),
        expandFunctionBodyIntoKernel: (body, kernel) => {
          kernel.cycles.push({
            index: 0,
            span,
            statements: [{
              kind: 'at',
              row: 0,
              col: 1,
              instruction: parseInstruction('SADD R1, R0, IMM(1)', 10, 1),
              span
            }]
          });
        }
      }
    } as any);

    expect(plan.controlRow).toBe(0);
    expect(plan.controlCol).toBe(0);
    expect(plan.startLabel).toMatch(/^__for_start_/);
  });

  it('builds and rewrites while-fusion plans', () => {
    const cycle = {
      index: 0,
      span,
      statements: [{
        kind: 'at' as const,
        row: 0,
        col: 1,
        instruction: parseInstruction('SADD R1, R1, R0', 1, 1),
        span
      }]
    };
    const plan = buildWhileFusionPlan([cycle as any], 0, 0);
    expect(plan).toMatchObject({ bodyRow: 0, bodyCol: 1, incomingRegister: 'RCR' });
    expect(buildWhileFusionPlan([{ ...cycle, label: 'L' } as any], 0, 0)).toBeNull();
    const rewritten = rewriteConditionForWhileFusion({ lhs: 'R0', operator: '==', rhs: 'IMM(1)' }, 'RCL');
    expect(rewritten).toEqual({ lhs: 'RCL', operator: '==', rhs: 'IMM(1)' });
  });

  it('parses structured control statements and emits while control-flow cycles', () => {
    const parseNested = () => [];
    const diagnostics: Diagnostic[] = [];
    const entries = [
      entry(1, 'for i in range(0, 2) {'),
      entry(2, 'bundle { @0,0: NOP; }'),
      entry(3, '}'),
      entry(4, 'if (R0 == IMM(0)) at @0,0 {'),
      entry(5, 'bundle { @0,0: NOP; }'),
      entry(6, '} else {'),
      entry(7, 'bundle { @0,1: NOP; }'),
      entry(8, '}'),
      entry(9, 'while (R0 < IMM(4)) at @0,0 {'),
      entry(10, 'bundle { @0,0: NOP; }'),
      entry(11, '}')
    ];

    const forResult = tryParseControlStatement(entries, 0, entries[0].cleanLine, 1, { value: 0 }, diagnostics, parseNested);
    expect(forResult.handled).toBe(true);
    expect(forResult.node?.kind).toBe('for');

    const ifResult = tryParseControlStatement(entries, 3, entries[3].cleanLine, 4, { value: 0 }, diagnostics, parseNested);
    expect(ifResult.handled).toBe(true);
    expect((ifResult.node as any).elseBody).toBeDefined();

    const whileResult = tryParseControlStatement(entries, 8, entries[8].cleanLine, 9, { value: 0 }, diagnostics, parseNested);
    expect(whileResult.handled).toBe(true);
    expect(whileResult.node?.kind).toBe('while');

    const notControl = tryParseControlStatement(entries, 1, entries[1].cleanLine, 2, { value: 0 }, diagnostics, parseNested);
    expect(notControl.handled).toBe(false);

    const kernel = makeKernel();
    const cycleIndex = emitWhileControlFlowCycles({
      kernel,
      cycleIndex: 0,
      lineNo: 20,
      row: 0,
      col: 0,
      condition: { lhs: 'R0', operator: '<', rhs: 'IMM(4)' },
      startLabel: 'L_START',
      endLabel: 'L_END',
      loopCycles: [{
        index: 0,
        span,
        statements: [{
          kind: 'at',
          row: 0,
          col: 1,
          instruction: parseInstruction('SADD R1, R1, R0', 20, 1),
          span
        }]
      }],
      fusionPlan: { bodyRow: 0, bodyCol: 1, incomingRegister: 'RCR' }
    });
    expect(cycleIndex).toBeGreaterThan(0);
    expect(kernel.cycles.at(-1)?.label).toBe('L_END');
  });

  it('reports malformed structured control headers with explicit diagnostics', () => {
    const diagnostics: Diagnostic[] = [];
    const parseNested = () => [];
    const entries = [
      entry(1, 'for i in range(0, 2) chunk(2) {'),
      entry(2, 'bundle { @0,0: NOP; }'),
      entry(3, '}'),
      entry(4, 'if (R0 == IMM(0)) {'),
      entry(5, 'bundle { @0,0: NOP; }'),
      entry(6, '}'),
      entry(7, 'while (R0 < IMM(4)) at @x,0 {'),
      entry(8, 'bundle { @0,0: NOP; }'),
      entry(9, '}'),
      entry(10, 'while (R0 < IMM(4)) at @0,0')
    ];

    const malformedFor = tryParseControlStatement(entries, 0, entries[0].cleanLine, 1, { value: 0 }, diagnostics, parseNested);
    expect(malformedFor.handled).toBe(true);
    expect(malformedFor.nextIndex).toBe(2);

    const malformedIf = tryParseControlStatement(entries, 3, entries[3].cleanLine, 4, { value: 0 }, diagnostics, parseNested);
    expect(malformedIf.handled).toBe(true);
    expect(malformedIf.nextIndex).toBe(5);

    const badWhileCoord = tryParseControlStatement(entries, 6, entries[6].cleanLine, 7, { value: 0 }, diagnostics, parseNested);
    expect(badWhileCoord.handled).toBe(true);
    expect(badWhileCoord.node?.kind).toBe('while');

    const malformedWhileNoBrace = tryParseControlStatement(entries, 9, entries[9].cleanLine, 10, { value: 0 }, diagnostics, parseNested);
    expect(malformedWhileNoBrace.handled).toBe(true);
    expect(malformedWhileNoBrace.nextIndex).toBe(9);
    expect(malformedWhileNoBrace.stop).toBe(false);

    const unterminatedMalformedIf = tryParseControlStatement(
      [entry(1, 'if (R0 == IMM(0)) {'), entry(2, 'bundle { @0,0: NOP; }')],
      0,
      'if (R0 == IMM(0)) {',
      1,
      { value: 0 },
      diagnostics,
      parseNested
    );
    expect(unterminatedMalformedIf.handled).toBe(true);
    expect(unterminatedMalformedIf.stop).toBe(true);

    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax && d.message.includes('Invalid for-loop header'))).toBe(true);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax && d.message.includes('Invalid if header'))).toBe(true);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax && d.message.includes('Invalid while control location'))).toBe(true);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax && d.message.includes('Invalid while header'))).toBe(true);
  });

  it('converts ast <-> structured and covers null-kernel branches', () => {
    const noKernelAst = { targetProfileId: 'uma-cgra-base', kernel: null, span } as any;
    const structuredNoKernel = toStructuredProgramAst(noKernelAst);
    expect(structuredNoKernel.kernel).toBeNull();

    const ast = {
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: {
        name: 'k',
        config: undefined,
        directives: [],
        pragmas: [
          { text: 'route(@0,1 -> @0,0, payload=R3, accum=R1)', span },
          { text: 'broadcast', span }
        ],
        cycles: [{ index: 0, statements: [], span }],
        span
      }
    } as any;
    const structured = toStructuredProgramAst(ast);
    expect(structured.kernel?.body.map((stmt: any) => stmt.kind)).toEqual(['advanced', 'advanced', 'cycle']);

    const loweredNoKernel = lowerStructuredProgramToAst({
      targetProfileId: 'uma-cgra-base',
      kernel: null,
      functions: [],
      span
    });
    expect(loweredNoKernel.kernel).toBeNull();
  });

  it('parse-source handles missing/invalid kernel declarations and top-level errors', () => {
    const noKernel = parseStructuredProgramFromSource(`
target "uma-cgra-base";
function f(a) {
  bundle { @0,0: NOP; }
}
`);
    expect(noKernel.program.kernel).toBeNull();
    expect(noKernel.program.functions).toHaveLength(1);

    const invalidTopLevel = parseStructuredProgramFromSource(`
target "uma-cgra-base";
oops;
kernel "k" { bundle { @0,0: NOP; } }
`);
    expect(invalidTopLevel.diagnostics.some((d) => d.message.includes('Unexpected top-level statement'))).toBe(true);

    const unterminatedFunction = parseStructuredProgramFromSource(`
target "uma-cgra-base";
function f(a) {
  bundle { @0,0: NOP; }
kernel "k" { bundle { @0,0: NOP; } }
`);
    expect(unterminatedFunction.diagnostics.some((d) => d.message.includes('Unterminated function'))).toBe(true);

    const unterminatedMacro = parseStructuredProgramFromSource(`
target "uma-cgra-base";
macro m(a) {
  bundle { @0,0: NOP; }
kernel "k" { bundle { @0,0: NOP; } }
`);
    expect(unterminatedMacro.diagnostics.some((d) => d.message.includes('Unterminated macro'))).toBe(true);

    const unterminatedKernel = parseStructuredProgramFromSource(`
target "uma-cgra-base";
kernel "k" {
  bundle { @0,0: NOP; }
`);
    expect(unterminatedKernel.diagnostics.some((d) => d.message.includes('Unterminated kernel'))).toBe(true);
  });
});
