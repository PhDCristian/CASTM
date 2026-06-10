import { describe, expect, it } from 'vitest';
import {
  AstProgram,
  ErrorCodes,
  spanAt
} from '@castm/compiler-ir';
import { createExpandAdvancedStatementsPass } from '../packages/compiler-api/src/passes-shared/expand-advanced-statements-pass.js';

function makeBaseAst(advancedStatements: string[]): AstProgram {
  const span = spanAt(1, 1, 1);
  return {
    targetProfileId: 'uma-cgra-base',
    span,
    kernel: {
      name: 'k',
      config: undefined,
      directives: [],
      advancedStatements: advancedStatements.map((text, index) => ({
        text,
        span: spanAt(index + 1, 1, text.length)
      })),
      bundles: [
        {
          index: 0,
          statements: [
            {
              kind: 'at',
              row: 0,
              col: 0,
              instruction: {
                text: 'NOP',
                opcode: 'NOP',
                operands: [],
                span
              },
              span
            }
          ],
          span
        }
      ],
      span
    }
  };
}

describe('compiler-api expand advancedStatements pass', () => {
  it('dispatches handlers and prepends generated bundles', () => {
    const ast = makeBaseAst([
      'route(@0,1 -> @0,0, payload=R3, accum=R1)',
      'reduce(op=add, dest=R1, src=R0, axis=row)'
    ]);

    const pass = createExpandAdvancedStatementsPass(true, {
      rows: 4,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    });

    const result = pass.run(ast);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.output.kernel?.bundles.length).toBeGreaterThan(1);

    const firstBundleOps = result.output.kernel?.bundles[0].statements
      .flatMap((stmt) => stmt.kind === 'row' ? stmt.instructions : [stmt.instruction])
      .map((inst) => inst.opcode);

    expect(firstBundleOps?.length).toBeGreaterThan(0);
    expect(result.output.kernel?.bundles[0].index).toBe(0);
    expect(result.output.kernel?.bundles.at(-1)?.index).toBe((result.output.kernel?.bundles.length ?? 1) - 1);
  });

  it('emits unsupported advancedStatement diagnostic when strictUnsupported is enabled', () => {
    const ast = makeBaseAst(['foo(bar=1)']);

    const pass = createExpandAdvancedStatementsPass(true, {
      rows: 4,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    });

    const result = pass.run(ast);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedAdvancedStatement)).toBe(true);
  });

  it('normalizes out-of-range advancedStatement anchor bundle indices', () => {
    const ast = makeBaseAst([
      'route(@0,1 -> @0,0, payload=R3, accum=R1)',
      'route(@0,0 -> @0,1, payload=R3, accum=R1)'
    ]);
    ast.kernel!.advancedStatements[0].anchorBundleIndex = -3;
    ast.kernel!.advancedStatements[1].anchorBundleIndex = 999;

    const pass = createExpandAdvancedStatementsPass(true, {
      rows: 4,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    });

    const result = pass.run(ast);
    expect(result.diagnostics).toHaveLength(0);
    expect((result.output.kernel?.bundles.length ?? 0)).toBeGreaterThan(2);
  });
});
