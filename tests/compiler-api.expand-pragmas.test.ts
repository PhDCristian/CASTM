import { describe, expect, it } from 'vitest';
import {
  AstProgram,
  ErrorCodes,
  spanAt
} from '@castm/compiler-ir';
import { createExpandPragmasPass } from '../packages/compiler-api/src/passes-shared/expand-pragmas-pass.js';

function makeBaseAst(pragmas: string[]): AstProgram {
  const span = spanAt(1, 1, 1);
  return {
    targetProfileId: 'uma-cgra-base',
    span,
    kernel: {
      name: 'k',
      config: undefined,
      directives: [],
      pragmas: pragmas.map((text, index) => ({
        text,
        span: spanAt(index + 1, 1, text.length)
      })),
      cycles: [
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

describe('compiler-api expand pragmas pass', () => {
  it('dispatches handlers and prepends generated cycles', () => {
    const ast = makeBaseAst([
      'route(@0,1 -> @0,0, payload=R3, accum=R1)',
      'reduce(op=add, dest=R1, src=R0, axis=row)'
    ]);

    const pass = createExpandPragmasPass(true, {
      rows: 4,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    });

    const result = pass.run(ast);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.output.kernel?.cycles.length).toBeGreaterThan(1);

    const firstCycleOps = result.output.kernel?.cycles[0].statements
      .flatMap((stmt) => stmt.kind === 'row' ? stmt.instructions : [stmt.instruction])
      .map((inst) => inst.opcode);

    expect(firstCycleOps?.length).toBeGreaterThan(0);
    expect(result.output.kernel?.cycles[0].index).toBe(0);
    expect(result.output.kernel?.cycles.at(-1)?.index).toBe((result.output.kernel?.cycles.length ?? 1) - 1);
  });

  it('emits unsupported pragma diagnostic when strictUnsupported is enabled', () => {
    const ast = makeBaseAst(['foo(bar=1)']);

    const pass = createExpandPragmasPass(true, {
      rows: 4,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    });

    const result = pass.run(ast);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedPragma)).toBe(true);
  });

  it('normalizes out-of-range pragma anchor cycle indices', () => {
    const ast = makeBaseAst([
      'route(@0,1 -> @0,0, payload=R3, accum=R1)',
      'route(@0,0 -> @0,1, payload=R3, accum=R1)'
    ]);
    ast.kernel!.pragmas[0].anchorCycleIndex = -3;
    ast.kernel!.pragmas[1].anchorCycleIndex = 999;

    const pass = createExpandPragmasPass(true, {
      rows: 4,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    });

    const result = pass.run(ast);
    expect(result.diagnostics).toHaveLength(0);
    expect((result.output.kernel?.cycles.length ?? 0)).toBeGreaterThan(2);
  });
});
