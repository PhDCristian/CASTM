import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '@castm/compiler-ir';
import { expandSpatialAtBlockStatements } from '../packages/compiler-front/src/structured-core/lowering/cycle-expand.js';
import {
  bindFunctionCallArgs,
  parseFunctionParams
} from '../packages/compiler-front/src/structured-core/lowering/functions.js';

describe('compiler-front lowering edge cases', () => {
  it('expands spatial at-block statements with bindings and multiple segments', () => {
    const diagnostics: any[] = [];
    const statements = expandSpatialAtBlockStatements(
      [
        {
          lineNo: 10,
          rawLine: '  SADD R1, R2, IMM(i); NOP;  ',
          cleanLine: 'SADD R1, R2, IMM(i); NOP;'
        },
        {
          lineNo: 11,
          rawLine: '   ;   ',
          cleanLine: ';'
        },
        {
          lineNo: 12,
          rawLine: '',
          cleanLine: ''
        }
      ],
      2,
      3,
      new Map([['i', 4]]),
      diagnostics
    );

    expect(diagnostics).toHaveLength(0);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatchObject({
      kind: 'at',
      row: 2,
      col: 3
    });
    expect((statements[0] as any).instruction.text).toBe('SADD R1, R2, IMM(4)');
    expect((statements[1] as any).instruction.opcode).toBe('NOP');
  });

  it('reports invalid nested blocks inside spatial at-block bodies', () => {
    const diagnostics: any[] = [];
    const statements = expandSpatialAtBlockStatements(
      [
        {
          lineNo: 20,
          rawLine: 'if (R0 == IMM(0)) {',
          cleanLine: 'if (R0 == IMM(0)) {'
        }
      ],
      0,
      0,
      new Map(),
      diagnostics
    );

    expect(statements).toHaveLength(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(ErrorCodes.Parse.InvalidSyntax);
    expect(diagnostics[0].message).toContain('Unsupported nested block inside spatial at-block');
  });

  it('binds function args and rejects duplicate named arguments', () => {
    const diagnostics: any[] = [];
    const bound = bindFunctionCallArgs(
      { name: 'mix', params: ['dst', 'src'] },
      ['dst: R1', 'dst: R2'],
      7,
      diagnostics
    );

    expect(bound).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(ErrorCodes.Parse.InvalidSyntax);
    expect(diagnostics[0].message).toContain("specified multiple times");
  });

  it('rejects positional args after named args in function calls', () => {
    const diagnostics: any[] = [];
    const bound = bindFunctionCallArgs(
      { name: 'mix', params: ['dst', 'src'] },
      ['dst: R1', 'R2'],
      8,
      diagnostics
    );

    expect(bound).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(ErrorCodes.Parse.InvalidSyntax);
    expect(diagnostics[0].message).toContain('Positional arguments must come before named arguments');
  });

  it('reports too many and missing function arguments', () => {
    const tooManyDiagnostics: any[] = [];
    const tooMany = bindFunctionCallArgs(
      { name: 'mix', params: ['dst', 'src'] },
      ['R1', 'R2', 'R3'],
      9,
      tooManyDiagnostics
    );
    expect(tooMany).toBeNull();
    expect(tooManyDiagnostics).toHaveLength(1);
    expect(tooManyDiagnostics[0].message).toContain('expects 2 argument(s), got 3');

    const missingDiagnostics: any[] = [];
    const missing = bindFunctionCallArgs(
      { name: 'mix', params: ['dst', 'src'] },
      ['foo: R1'],
      10,
      missingDiagnostics
    );
    expect(missing).toBeNull();
    expect(missingDiagnostics).toHaveLength(1);
    expect(missingDiagnostics[0].message).toContain("Missing argument for parameter 'src'");
  });

  it('parses typed function params and rejects invalid/duplicate params', () => {
    const diagnostics: any[] = [];
    expect(parseFunctionParams('', 3, diagnostics)).toEqual([]);
    expect(parseFunctionParams('dst: reg, src: reg', 4, diagnostics)).toEqual(['dst', 'src']);

    const invalid = parseFunctionParams('1dst, src', 5, diagnostics);
    expect(invalid).toBeNull();
    expect(diagnostics.at(-1)?.code).toBe(ErrorCodes.Parse.InvalidSyntax);
    expect(diagnostics.at(-1)?.message).toContain('Invalid function parameter');

    const duplicateDiagnostics: any[] = [];
    const duplicate = parseFunctionParams('dst, dst', 6, duplicateDiagnostics);
    expect(duplicate).toBeNull();
    expect(duplicateDiagnostics).toHaveLength(1);
    expect(duplicateDiagnostics[0].code).toBe(ErrorCodes.Parse.InvalidSyntax);
    expect(duplicateDiagnostics[0].message).toContain("Duplicate function parameter 'dst'");
  });
});
