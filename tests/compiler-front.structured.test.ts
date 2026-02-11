import { describe, expect, it } from 'vitest';
import {
  lowerStructuredProgramToAst,
  parseStructuredSource
} from '@openedge/compiler-front';

describe('compiler-front structured contracts', () => {
  it('parses canonical structured statements from source', () => {
    const source = `
target "uma-cgra-base";
kernel "structured" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
  cycle { @0,0: NOP; }
  for i in range(0, 2) {
    cycle { @0,1: NOP; }
  }
  if (R0 == IMM(0)) at @0,0 {
    cycle { @0,2: NOP; }
  } else {
    cycle { @0,3: NOP; }
  }
  while (R1 < IMM(4)) at @0,0 {
    cycle { @0,1: NOP; }
  }
}
`;

    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    expect(result.structuredAst?.kernel?.body.map((stmt) => stmt.kind)).toEqual([
      'advanced',
      'cycle',
      'for',
      'if',
      'while'
    ]);

    const ifStmt = result.structuredAst?.kernel?.body.find((stmt) => stmt.kind === 'if');
    expect(ifStmt && 'elseBody' in ifStmt && ifStmt.elseBody?.length).toBeGreaterThan(0);
  });

  it('lowers structured program to flat ast projection', () => {
    const source = `
target "uma-cgra-base";
kernel "structured_lower" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
  cycle { @0,0: NOP; }
  for i in range(0, 2) {
    cycle { @0,1: NOP; }
  }
}
`;

    const parsed = parseStructuredSource(source);
    expect(parsed.success).toBe(true);
    const lowered = lowerStructuredProgramToAst(parsed.structuredAst!);

    expect(lowered.kernel?.pragmas).toHaveLength(1);
    expect(lowered.kernel?.pragmas[0].text).toContain('route(');
    expect(lowered.kernel?.cycles).toHaveLength(1);
    expect(lowered.kernel?.cycles[0].index).toBe(0);
  });
});
