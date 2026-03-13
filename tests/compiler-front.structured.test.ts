import { describe, expect, it } from 'vitest';
import {
  lowerStructuredProgramToAst,
  parseStructuredSource
} from '@castm/compiler-front';
import { ErrorCodes } from '@castm/compiler-ir';

describe('compiler-front structured contracts', () => {
  it('parses canonical structured statements from source', () => {
    const source = `
target "uma-cgra-base";
kernel "structured" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
  bundle { @0,0: NOP; }
  for i in range(0, 2) {
    bundle { @0,1: NOP; }
  }
  if (R0 == IMM(0)) at @0,0 {
    bundle { @0,2: NOP; }
  } else {
    bundle { @0,3: NOP; }
  }
  while (R1 < IMM(4)) at @0,0 {
    bundle { @0,1: NOP; }
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
  bundle { @0,0: NOP; }
  for i in range(0, 2) {
    bundle { @0,1: NOP; }
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
  bundle { @0,0: dst = src + IMM(1); }
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
    const allInstructions = (lowered.kernel?.cycles ?? [])
      .flatMap((cycle) => cycle.statements)
      .map((stmt) => {
        if (stmt.kind === 'row') {
          return stmt.instructions.map((instruction) => instruction.text);
        }
        return [stmt.instruction.text];
      })
      .flat();
    expect(allInstructions.filter((text) => text.includes('R1 = R0 + IMM(1)'))).toHaveLength(1);
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

  // ── T2-V1: Labeled advanced statement ──
  it('parses labeled advanced statement (subrC: std::extract_bytes(...))', () => {
    const source = `
target "uma-cgra-base";
kernel "labeled_adv" {
  subrC: std::extract_bytes(src=R0, dest=R1, axis=col, byteWidth=8, mask=255);
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const body = result.structuredAst?.kernel?.body ?? [];
    expect(body).toHaveLength(1);
    expect(body[0].kind).toBe('advanced');
    if (body[0].kind === 'advanced') {
      expect(body[0].name).toBe('extract_bytes');
      expect(body[0].label).toBe('subrC');
      expect(body[0].args).toContain('src=R0');
    }
  });

  // ── T2-V2: Labeled function call ──
  it('parses labeled function call (myLabel: myFn(R0, R1))', () => {
    const source = `
target "uma-cgra-base";
function myFn(a, b) {
  bundle { @0,0: a = b + IMM(1); }
}
kernel "labeled_fn" {
  myLabel: myFn(R0, R1);
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const body = result.structuredAst?.kernel?.body ?? [];
    expect(body).toHaveLength(1);
    expect(body[0].kind).toBe('fn-call');
    if (body[0].kind === 'fn-call') {
      expect(body[0].name).toBe('myFn');
      expect(body[0].label).toBe('myLabel');
    }
  });

  // ── T2-V3: Unlabeled advanced still works ──
  it('parses unlabeled advanced statement without label field', () => {
    const source = `
target "uma-cgra-base";
kernel "unlabeled_adv" {
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const body = result.structuredAst?.kernel?.body ?? [];
    expect(body).toHaveLength(1);
    expect(body[0].kind).toBe('advanced');
    if (body[0].kind === 'advanced') {
      expect(body[0].label).toBeUndefined();
    }
  });

  // ── T2-V4: Labeled cycle still works (no regression) ──
  it('parses labeled cycle (mainEntry: bundle { ... })', () => {
    const source = `
target "uma-cgra-base";
kernel "labeled_cycle" {
  mainEntry: bundle { @0,0: NOP; }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const body = result.structuredAst?.kernel?.body ?? [];
    expect(body).toHaveLength(1);
    expect(body[0].kind).toBe('cycle');
    if (body[0].kind === 'cycle') {
      expect(body[0].cycle.label).toBe('mainEntry');
    }
  });

  // ── T3-V1: Label propagation to PragmaAst ──
  it('propagates label through lowering to PragmaAst', () => {
    const source = `
target "uma-cgra-base";
kernel "label_pragma" {
  subrC: std::route(@0,1 -> @0,0, payload=R3, accum=R1);
  bundle { @0,0: NOP; }
}
`;
    const parsed = parseStructuredSource(source);
    expect(parsed.success).toBe(true);
    const lowered = lowerStructuredProgramToAst(parsed.structuredAst!);
    expect(lowered.kernel?.pragmas).toHaveLength(1);
    expect(lowered.kernel?.pragmas[0].label).toBe('subrC');
    expect(lowered.kernel?.pragmas[0].text).toContain('route(');
  });

  // ── T3-V2: Labeled fn-call propagation through lowering ──
  it('propagates label through fn-call lowering to first cycle', () => {
    const source = `
target "uma-cgra-base";
function doWork(dst, src) {
  bundle { @0,0: dst = src + IMM(1); }
}
kernel "label_fn_call" {
  entry: doWork(R1, R0);
}
`;
    const parsed = parseStructuredSource(source);
    expect(parsed.success).toBe(true);
    const lowered = lowerStructuredProgramToAst(parsed.structuredAst!);
    expect(lowered.kernel?.cycles).toHaveLength(1);
    expect(lowered.kernel?.cycles[0].label).toBe('entry');
  });

  it('accepts "bundle" as alias for "cycle" in inline, block, and labeled forms', () => {
    // Inline bundle
    const r1 = parseStructuredSource(`
target "uma-cgra-base";
kernel "t" {
  bundle { @0,0: NOP; }
}
`);
    expect(r1.success).toBe(true);
    expect(r1.structuredAst?.kernel?.body[0].kind).toBe('cycle');

    // Labeled bundle
    const r2 = parseStructuredSource(`
target "uma-cgra-base";
kernel "t" {
  myLabel: bundle { at all: NOP; }
}
`);
    expect(r2.success).toBe(true);
    const b2 = r2.structuredAst?.kernel?.body[0];
    expect(b2?.kind).toBe('cycle');
    if (b2?.kind === 'cycle') expect(b2.cycle.label).toBe('myLabel');

    // Block bundle (multi-line)
    const r3 = parseStructuredSource(`
target "uma-cgra-base";
kernel "t" {
  bundle {
    @0,0: NOP;
    at all: NOP;
  }
}
`);
    expect(r3.success).toBe(true);
    const b3 = r3.structuredAst?.kernel?.body[0];
    expect(b3?.kind).toBe('cycle');
    if (b3?.kind === 'cycle') expect(b3.cycle.statements).toHaveLength(2);

    // cycle still works (backward compat)
    const r4 = parseStructuredSource(`
target "uma-cgra-base";
kernel "t" {
  bundle { @0,0: NOP; }
}
`);
    expect(r4.success).toBe(true);
    expect(r4.structuredAst?.kernel?.body[0].kind).toBe('cycle');

    // bundle lowers correctly
    const lowered = lowerStructuredProgramToAst(r1.structuredAst!);
    expect(lowered.kernel?.cycles).toHaveLength(1);
    expect(lowered.kernel?.cycles[0].statements[0]).toMatchObject({ kind: 'at', row: 0, col: 0 });
  });

  it('E2E: labeled advanced stmt + labeled fn-call compile through full pipeline (T5-V1)', async () => {
    const { compile } = await import('@castm/compiler-api');
    const source = `
target base;
build { optimize O0; scheduler safe; }

function loadAll(val) {
  bundle { at all: LWI R0, val; }
}

kernel "Labeled_Compound_E2E" {
  mainEntry: bundle { at all: LWI R0, 42; }
  routePhase: std::route(@0,0 -> @0,2, payload=R0, accum=R1);
  loadPhase: loadAll(720);
  bundle { @0,0: EXIT; }
}
`;
    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

    const cycles = result.artifacts.ast?.kernel?.cycles ?? [];
    expect(cycles.length).toBeGreaterThanOrEqual(4); // at least: mainEntry + route expansion + loadAll + EXIT

    // mainEntry label on first cycle
    expect(cycles[0].label).toBe('mainEntry');
    // routePhase label on first route-expanded cycle
    const routeCycle = cycles.find((c: { label?: string }) => c.label === 'routePhase');
    expect(routeCycle).toBeDefined();
    // loadPhase label on first fn-call-expanded cycle
    const loadCycle = cycles.find((c: { label?: string }) => c.label === 'loadPhase');
    expect(loadCycle).toBeDefined();
  });
});
