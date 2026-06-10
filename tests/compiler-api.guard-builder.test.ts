import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '@castm/compiler-ir';
import { buildGuardBundles } from '../packages/compiler-api/src/passes-shared/collective/guard.js';

const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };
const grid: any = { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' };

function run(condition: string) {
  const diagnostics: any[] = [];
  const bundles = buildGuardBundles(
    {
      condition,
      opcode: 'SADD',
      destReg: 'R1',
      srcA: 'R0',
      srcB: 'ZERO'
    },
    0,
    grid,
    span,
    diagnostics
  );
  return { bundles, diagnostics };
}

describe('compiler-api guard builder', () => {
  it('covers comparator and truthy branches deterministically', () => {
    expect(run('col==row').bundles[0].statements.length).toBe(4);
    expect(run('col!=row').bundles[0].statements.length).toBe(12);
    expect(run('col>=row').bundles[0].statements.length).toBe(10);
    expect(run('col<=row').bundles[0].statements.length).toBe(10);
    expect(run('col>row').bundles[0].statements.length).toBe(6);
    expect(run('col<row').bundles[0].statements.length).toBe(6);
    expect(run('idx%2').bundles[0].statements.length).toBe(8);
  });

  it('covers error/empty branches for invalid conditions', () => {
    const badParse = run('col>=');
    expect(badParse.bundles).toEqual([]);
    expect(badParse.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const unresolved = run('foo>0');
    expect(unresolved.bundles).toEqual([]);
    expect(unresolved.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const rhsUnresolved = run('col>=foo');
    expect(rhsUnresolved.bundles).toEqual([]);
    expect(rhsUnresolved.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const invalidChars = run('row&&col');
    expect(invalidChars.bundles).toEqual([]);
    expect(invalidChars.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const nonFinite = run('1/0');
    expect(nonFinite.bundles).toEqual([]);
    expect(nonFinite.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const throwingExpr = run('1+');
    expect(throwingExpr.bundles).toEqual([]);
    expect(throwingExpr.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const emptyCondition = run('');
    expect(emptyCondition.bundles).toEqual([]);
    expect(emptyCondition.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const emptySelection = run('0');
    expect(emptySelection.bundles).toEqual([]);
    expect(emptySelection.diagnostics).toHaveLength(0);
  });
});
