import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function jumpTexts(source: string): string[] {
  const result = compile(source, { emitArtifacts: ['ast'] });
  expect(result.success).toBe(true);
  const cycles = result.artifacts.ast?.kernel?.cycles ?? [];
  return cycles.flatMap((cycle) =>
    cycle.statements
      .map((stmt) => ('instruction' in stmt ? stmt.instruction.text : ''))
      .filter((text) => text.startsWith('JUMP '))
  );
}

describe('FEAT-24 loop-control statements (break/continue)', () => {
  it('supports break/continue in while with deterministic lowering', () => {
    const jumps = jumpTexts(`
target "uma-cgra-base";
kernel "while_break_continue" {
  while (R0 < 3) at @0,0 {
    continue;
    break;
  }
}
`);
    const jumpCount = jumps.filter((text) => text.includes('__while_')).length;
    expect(jumpCount).toBeGreaterThanOrEqual(2);
  });

  it('supports break/continue in runtime for loops', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "runtime_for_break_continue" {
  loopR: for R0 in range(0, 3) at @0,0 runtime {
    continue loopR;
    break;
  }
}
`);
    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('supports labeled break target resolution in nested loops', () => {
    const jumps = jumpTexts(`
target "uma-cgra-base";
kernel "nested_labeled_break" {
  outer: while (R0 < 2) at @0,0 {
    inner: while (R1 < 2) at @0,1 {
      break outer;
    }
    break;
  }
}
`);
    expect(jumps.some((text) => text.includes('__while_end_0'))).toBe(true);
  });

  it('reports E3012 for loop control outside loops', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "break_outside" {
  break;
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidLoopControl)).toBe(true);
  });

  it('reports E3012 for unknown labeled loop target', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "continue_unknown_label" {
  while (R0 < 1) at @0,0 {
    continue missingLoop;
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidLoopControl)).toBe(true);
  });

  it('reports E3012 for static for-loop break/continue usage', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "static_for_break" {
  for i in range(0, 2) {
    break;
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidLoopControl)).toBe(true);
  });
});
