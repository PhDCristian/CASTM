import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { parseForHeader } from '../../packages/compiler-front/src/structured-core/lowering/control-flow.js';
import { ErrorCodes } from '@castm/compiler-ir';

describe('FEAT-20 collapse edge cases', () => {
  it('rejects duplicate loop modifiers in parser', () => {
    const diagnostics: any[] = [];
    const duplicateUnroll = parseForHeader(
      'for i in range(0, 8) unroll(2) unroll(4) {',
      1,
      new Map(),
      new Map(),
      diagnostics
    );
    expect(duplicateUnroll).toBeNull();
    expect(diagnostics.some((d) => d.message.includes('Duplicate unroll'))).toBe(true);

    const duplicateCollapseDiagnostics: any[] = [];
    const duplicateCollapse = parseForHeader(
      'for i in range(0, 8) collapse(2) collapse(3) {',
      2,
      new Map(),
      new Map(),
      duplicateCollapseDiagnostics
    );
    expect(duplicateCollapse).toBeNull();
    expect(duplicateCollapseDiagnostics.some((d) => d.message.includes('Duplicate collapse'))).toBe(true);
  });

  it('rejects invalid non-integer modifier arguments', () => {
    const diagnostics: any[] = [];
    const header = parseForHeader(
      'for i in range(0, 8) collapse(1/2) {',
      1,
      new Map(),
      new Map(),
      diagnostics
    );
    expect(header).toBeNull();
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    expect(diagnostics.some((d) => d.message.includes('Invalid collapse'))).toBe(true);
  });

  it('rejects collapse(n) when requested depth exceeds nested static loops', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "collapse_depth_exceeds" {
  for i in range(0, 2) collapse(3) {
    for j in range(0, 2) {
      bundle { @i,j: NOP; }
    }
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('collapse(3)'))).toBe(true);
  });

  it('rejects collapse(n) on non-perfectly-nested loop bodies', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "collapse_non_perfect" {
  for i in range(0, 2) collapse(2) {
    for j in range(0, 2) {
      bundle { @i,j: NOP; }
    }
    bundle { @0,3: NOP; }
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('perfectly nested'))).toBe(true);
  });

  it('rejects collapse inside cycle-level nested loop expansion', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "cycle_scope_collapse" {
  bundle {
    for i in range(0, 2) collapse(2) {
      @0,i: NOP;
    }
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('inside cycle blocks'))).toBe(true);
  });

  it('rejects unroll inside cycle-level nested loop expansion', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "cycle_scope_unroll" {
  bundle {
    for i in range(0, 4) unroll(2) {
      @0,i: NOP;
    }
  }
}
`);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('unroll(k) is not supported'))).toBe(true);
  });
});
