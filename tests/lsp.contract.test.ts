import { describe, expect, it } from 'vitest';
import { getCompletions, validateSource } from '@openedge/lsp-server';

describe('lsp canonical contracts', () => {
  it('provides canonical keyword and statement completions', () => {
    const completions = getCompletions('ro');
    expect(completions.some((c) => c.label === 'route(...);' && c.kind === 'advanced')).toBe(true);
    expect(completions.some((c) => c.label === 'ROUT' && c.kind === 'register')).toBe(true);

    const guardCompletions = getCompletions('gu');
    expect(guardCompletions.some((c) => c.label === 'guard(...);' && c.kind === 'advanced')).toBe(true);

    const keywordCompletions = getCompletions('let');
    expect(keywordCompletions.some((c) => c.label === 'let' && c.kind === 'keyword')).toBe(true);
  });

  it('reports parse errors for legacy syntax', () => {
    const source = `
target "uma-cgra-base";
.const MASK 0xFFFF
.alias acc = R1
.data A { 1, 2, 3 }
#pragma route @0,1 -> @0,0 payload(R3) accum(R1)
kernel "legacy" {
  cycle { row 0: NOP; }
  if (R0 == IMM(0)) @0,0 {
    cycle { @0,0: NOP; }
  }
  for R0 in range(0, 2) @0,0 runtime {
    cycle { @0,1: NOP; }
  }
}
`;
    const diagnostics = validateSource(source);
    expect(diagnostics.some((d) => d.code === 'E2002')).toBe(true);
  });

  it('surfaces canonical parse diagnostics through validateSource', () => {
    const source = `
target "uma-cgra-base";
.const X 1
kernel "k" { cycle { row 0: NOP; } }
`;
    const diagnostics = validateSource(source);
    expect(diagnostics.some((d) => d.code === 'E2002')).toBe(true);
  });
});
