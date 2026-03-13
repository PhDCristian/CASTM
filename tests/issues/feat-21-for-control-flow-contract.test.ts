import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

describe('FEAT-21 for/control-flow contracts', () => {
  it('supports static for-loop expansion with nested if/else control blocks', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "for_if_else_compose" {
  for i in range(0, 2) {
    if (R0 == 0) at @0,0 {
      bundle { at @0,i: R1 = R1 + 1; }
    } else {
      bundle { at @1,i: R1 = R1 + 2; }
    }
  }
}
`);
    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.stats.cycles).toBeGreaterThan(0);
  });

  it('reports explicit diagnostic for malformed if header without control location', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "bad_if_header" {
  if (R0 == 0) {
    bundle { at @0,1: R1 = R1 + 1; }
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Invalid if header'))).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Unterminated kernel'))).toBe(false);
  });

  it('reports explicit diagnostic for malformed for-loop header modifiers', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "bad_for_header" {
  for i in range(0, 4) chunk(2) {
    bundle { at @0,i: NOP; }
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Invalid for-loop header'))).toBe(true);
  });

  it('reports explicit diagnostic for invalid while control location literals', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "bad_while_control" {
  while (R0 < 3) at @x,0 {
    bundle { at @0,1: R0 = R0 + 1; }
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Invalid while control location'))).toBe(true);
  });
});
