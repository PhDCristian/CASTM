import { describe, expect, it } from 'vitest';
import { getCompletions, validateSource } from '@castm/lsp-server';

describe('lsp canonical contracts', () => {
  it('provides canonical keyword and statement completions', () => {
    const completions = getCompletions('ro');
    expect(completions.some((c) => c.label === 'std::route(...);' && c.kind === 'advanced')).toBe(true);
    expect(completions.some((c) => c.label === 'route(...);' && c.kind === 'advanced')).toBe(true);
    expect(completions.some((c) => c.label === 'ROUT' && c.kind === 'register')).toBe(true);

    const guardCompletions = getCompletions('gu');
    expect(guardCompletions.some((c) => c.label === 'guard(...);' && c.kind === 'advanced')).toBe(true);

    const collectCompletions = getCompletions('co');
    expect(collectCompletions.some((c) => c.label === 'collect(...);' && c.kind === 'advanced')).toBe(true);

    const stashCompletions = getCompletions('st');
    expect(stashCompletions.some((c) => c.label === 'stash(...);' && c.kind === 'advanced')).toBe(true);

    const accumulateCompletions = getCompletions('ac');
    expect(accumulateCompletions.some((c) => c.label === 'accumulate(...);' && c.kind === 'advanced')).toBe(true);

    const mulaccCompletions = getCompletions('mulacc');
    expect(mulaccCompletions.some((c) => c.label === 'mulacc_chain(...);' && c.kind === 'advanced')).toBe(true);

    const carryChainCompletions = getCompletions('carry');
    expect(carryChainCompletions.some((c) => c.label === 'carry_chain(...);' && c.kind === 'advanced')).toBe(true);

    const conditionalSubCompletions = getCompletions('cond');
    expect(conditionalSubCompletions.some((c) => c.label === 'conditional_sub(...);' && c.kind === 'advanced')).toBe(true);

    const normalizeCompletions = getCompletions('no');
    expect(normalizeCompletions.some((c) => c.label === 'normalize(...);' && c.kind === 'advanced')).toBe(true);

    const extractCompletions = getCompletions('ex');
    expect(extractCompletions.some((c) => c.label === 'extract_bytes(...);' && c.kind === 'advanced')).toBe(true);

    const latencyHideCompletions = getCompletions('lat');
    expect(latencyHideCompletions.some((c) => c.label === 'latency_hide(...);' && c.kind === 'advanced')).toBe(true);

    const keywordCompletions = getCompletions('let');
    expect(keywordCompletions.some((c) => c.label === 'let' && c.kind === 'keyword')).toBe(true);

    const pipelineKeywordCompletions = getCompletions('pipe');
    expect(pipelineKeywordCompletions.some((c) => c.label === 'pipeline' && c.kind === 'keyword')).toBe(true);
  });

  it('reports parse errors for legacy syntax', () => {
    const source = `
target "uma-cgra-base";
.const MASK 0xFFFF
.alias acc = R1
.data A { 1, 2, 3 }
#pragma route @0,1 -> @0,0 payload(R3) accum(R1)
kernel "legacy" {
  bundle { row 0: NOP; }
  if (R0 == IMM(0)) @0,0 {
    bundle { @0,0: NOP; }
  }
  for R0 in range(0, 2) @0,0 runtime {
    bundle { @0,1: NOP; }
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
kernel "k" { bundle { row 0: NOP; } }
`;
    const diagnostics = validateSource(source);
    expect(diagnostics.some((d) => d.code === 'E2002')).toBe(true);
  });
});
