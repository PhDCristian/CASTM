import { describe, expect, it } from 'vitest';
import {
  lowerStructuredProgramToAst,
  parseStructuredSource
} from '@openedge/compiler-front';
import { ErrorCodes } from '@openedge/compiler-ir';

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
    const advanced = result.structuredAst?.kernel?.body.find((stmt) => stmt.kind === 'advanced');
    expect(advanced && 'name' in advanced ? advanced.name : null).toBe('route');
    expect(advanced && 'args' in advanced ? advanced.args : '').toContain('payload=R3');
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
    expect(lowered.kernel?.cycles).toHaveLength(3);
    expect(lowered.kernel?.cycles[0].index).toBe(0);
  });

  it('captures top-level function definitions and lowers function calls', () => {
    const source = `
target "uma-cgra-base";
function add_one(dst, src) {
  cycle { @0,0: dst = src + IMM(1); }
}
kernel "fn_structured" {
  add_one(R1, R0);
}
`;

    const parsed = parseStructuredSource(source);
    expect(parsed.success).toBe(true);
    expect(parsed.structuredAst?.functions).toHaveLength(1);
    expect(parsed.structuredAst?.functions[0].name).toBe('add_one');
    const lowered = parsed.ast ?? lowerStructuredProgramToAst(parsed.structuredAst!);
    expect(lowered.kernel?.cycles.length).toBe(1);
    expect(lowered.kernel?.cycles[0].statements[0].instruction.text).toContain('R1 = R0 + IMM(1)');
  });

  it('reports invalid syntax for legacy statements without classic fallback', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_reject" {
  #pragma route @0,1 -> @0,0 payload(R3) accum(R1)
}
`;

    const parsed = parseStructuredSource(source);
    expect(parsed.success).toBe(false);
    expect(parsed.ast).toBeUndefined();
    expect(parsed.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('reports unrecognized canonical statements as parse errors', () => {
    const source = `
target "uma-cgra-base";
kernel "unknown_stmt" {
  this is not valid dsl;
}
`;

    const parsed = parseStructuredSource(source);
    expect(parsed.success).toBe(false);
    expect(parsed.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
