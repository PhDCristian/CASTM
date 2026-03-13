import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '@castm/compiler-ir';
import {
  collectBlockAfterOpenFromEntries,
  collectBlockAfterOpenFromSource,
  collectBlockFromEntries,
  collectBlockFromSource
} from '../packages/compiler-front/src/structured-core/parser-utils/blocks.js';
import {
  applyBindings,
  evaluateNumericExpression,
  parseNumber
} from '../packages/compiler-front/src/structured-core/parser-utils/numbers.js';
import { parseForHeader } from '../packages/compiler-front/src/structured-core/lowering/control-flow.js';

function entry(lineNo: number, cleanLine: string) {
  return { lineNo, rawLine: cleanLine, cleanLine };
}

describe('compiler-front parser utils and for header parsing', () => {
  it('collects source/entry blocks with trailing close payload and unterminated blocks', () => {
    const sourceLines = [
      'if (x) {',
      'bundle { @0,0: NOP; }',
      '} else {',
      'bundle { @0,1: NOP; }',
      '}'
    ];
    const fromSource = collectBlockFromSource(sourceLines, 0);
    expect(fromSource.endIndex).toBe(2);
    expect(fromSource.trailingAfterClose).toBe('else {');
    expect(fromSource.body).toHaveLength(1);

    const fromEntries = collectBlockFromEntries(
      sourceLines.map((line, idx) => entry(idx + 1, line)),
      0
    );
    expect(fromEntries.endIndex).toBe(2);
    expect(fromEntries.trailingAfterClose).toBe('else {');

    const unterminated = collectBlockFromEntries(
      [entry(1, 'for i in range(0, 2) {'), entry(2, '@0,0: NOP;')],
      0
    );
    expect(unterminated.endIndex).toBeNull();
  });

  it('collects blocks after explicit open brace from source/entries', () => {
    const lines = [
      '@0,0: NOP;',
      '} after',
      'ignored'
    ];
    const fromSource = collectBlockAfterOpenFromSource(lines, 0);
    expect(fromSource.endIndex).toBe(1);
    expect(fromSource.trailingAfterClose).toBe('after');
    expect(fromSource.body).toHaveLength(1);

    const fromEntries = collectBlockAfterOpenFromEntries(
      lines.map((line, idx) => entry(idx + 1, line)),
      0
    );
    expect(fromEntries.endIndex).toBe(1);
    expect(fromEntries.body).toHaveLength(1);
  });

  it('parses numbers, applies bindings and evaluates numeric expressions safely', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('0x10')).toBe(16);
    expect(parseNumber('-0x10')).toBe(-16);

    const bound = applyBindings('i + i2 + idx', new Map([['i', 3], ['idx', 7]]));
    expect(bound).toBe('3 + i2 + 7');

    const constants = new Map<string, number>([['BASE', 100], ['STRIDE', 4]]);
    const bindings = new Map<string, number>([['i', 2]]);
    expect(evaluateNumericExpression('BASE + i * STRIDE', constants, bindings)).toBe(108);
    expect(evaluateNumericExpression('BASE + unknown', constants, bindings)).toBeNull();
    expect(evaluateNumericExpression('BASE + alert(1)', constants, bindings)).toBeNull();
    expect(evaluateNumericExpression('1 / 2', constants, bindings)).toBeNull();
    expect(evaluateNumericExpression('1 +', constants, bindings)).toBeNull();
  });

  it('parses for headers and reports invalid range/runtime/control combinations', () => {
    const diagnostics: any[] = [];
    const constants = new Map<string, number>([['N', 8]]);

    const oneArg = parseForHeader(
      'for i in range(4) {',
      1,
      constants,
      new Map(),
      diagnostics
    );
    expect(oneArg).toMatchObject({ variable: 'i', start: 0, end: 4, step: 1, runtime: false });

    const twoArg = parseForHeader(
      'for i in range(2, N) {',
      2,
      constants,
      new Map(),
      diagnostics
    );
    expect(twoArg).toMatchObject({ start: 2, end: 8, step: 1 });

    const runtime = parseForHeader(
      'for R0 in range(0, N, 2) at @1,2 runtime {',
      3,
      constants,
      new Map(),
      diagnostics
    );
    expect(runtime).toMatchObject({
      variable: 'R0',
      runtime: true,
      control: { row: 1, col: 2 },
      step: 2
    });

    const withModifiers = parseForHeader(
      'for i in range(0, N) unroll(2) collapse(2) {',
      3,
      constants,
      new Map(),
      diagnostics
    );
    expect(withModifiers).toMatchObject({
      variable: 'i',
      unrollFactor: 2,
      collapseLevels: 2,
      collapseOrder: 'row_major'
    });

    const badArgCountDiagnostics: any[] = [];
    const badArgCount = parseForHeader(
      'for i in range() {',
      4,
      constants,
      new Map(),
      badArgCountDiagnostics
    );
    expect(badArgCount).toBeNull();
    expect(badArgCountDiagnostics[0].code).toBe(ErrorCodes.Parse.InvalidSyntax);
    expect(badArgCountDiagnostics[0].message).toContain('expected 1..3 arguments');

    const badRangeDiagnostics: any[] = [];
    const badRange = parseForHeader(
      'for i in range(0, BAD) {',
      5,
      constants,
      new Map(),
      badRangeDiagnostics
    );
    expect(badRange).toBeNull();
    expect(badRangeDiagnostics[0].message).toContain('Invalid range() argument');

    const zeroStepDiagnostics: any[] = [];
    const zeroStep = parseForHeader(
      'for i in range(0, 10, 0) {',
      6,
      constants,
      new Map(),
      zeroStepDiagnostics
    );
    expect(zeroStep).toBeNull();
    expect(zeroStepDiagnostics[0].message).toContain('step: 0');

    const badControlDiagnostics: any[] = [];
    const badControl = parseForHeader(
      'for i in range(0, 10) at @X,1 {',
      7,
      constants,
      new Map(),
      badControlDiagnostics
    );
    expect(badControl).toBeNull();
    expect(badControlDiagnostics[0].message).toContain('Invalid control location');

    const runtimeNoControlDiagnostics: any[] = [];
    const runtimeNoControl = parseForHeader(
      'for i in range(0, 10) runtime {',
      8,
      constants,
      new Map(),
      runtimeNoControlDiagnostics
    );
    expect(runtimeNoControl).toBeNull();
    expect(runtimeNoControlDiagnostics[0].message).toContain('require an explicit control location');

    const runtimeCollapseDiagnostics: any[] = [];
    const runtimeCollapse = parseForHeader(
      'for R0 in range(0, 4) at @0,0 runtime collapse(2) {',
      9,
      constants,
      new Map(),
      runtimeCollapseDiagnostics
    );
    expect(runtimeCollapse).toBeNull();
    expect(runtimeCollapseDiagnostics[0].message).toContain('collapse(n) is not supported');

    const runtimeUnrollDiagnostics: any[] = [];
    const runtimeUnroll = parseForHeader(
      'for R0 in range(0, 4) at @0,0 runtime unroll(2) {',
      10,
      constants,
      new Map(),
      runtimeUnrollDiagnostics
    );
    expect(runtimeUnroll).toBeNull();
    expect(runtimeUnrollDiagnostics[0].message).toContain('unroll(k) is not supported');

    const invalidModifierDiagnostics: any[] = [];
    const invalidModifier = parseForHeader(
      'for i in range(0, 4) collapse(0) {',
      11,
      constants,
      new Map(),
      invalidModifierDiagnostics
    );
    expect(invalidModifier).toBeNull();
    expect(invalidModifierDiagnostics[0].message).toContain('collapse(0)');

    const invalidModifierListDiagnostics: any[] = [];
    const invalidModifierList = parseForHeader(
      'for i in range(0, 4) chunk(2) {',
      12,
      constants,
      new Map(),
      invalidModifierListDiagnostics
    );
    expect(invalidModifierList).toBeNull();
    expect(invalidModifierListDiagnostics[0].message).toContain('Invalid for-loop modifier list');

    const invalidModifierResidueDiagnostics: any[] = [];
    const invalidModifierResidue = parseForHeader(
      'for i in range(0, 4) unroll(2) junk {',
      13,
      constants,
      new Map(),
      invalidModifierResidueDiagnostics
    );
    expect(invalidModifierResidue).toBeNull();
    expect(invalidModifierResidueDiagnostics[0].message).toContain('Invalid for-loop modifier segment');
  });
});
