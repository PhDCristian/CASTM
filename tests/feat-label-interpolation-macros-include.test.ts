import { describe, expect, it } from 'vitest';
import {
  parseStructuredSource,
  preprocessIncludes
} from '@castm/compiler-front';
import type { Diagnostic } from '@castm/compiler-ir';

// ═══════════════════════════════════════════════════════════════════════
// Feature 1: Label interpolation in for loops
// ═══════════════════════════════════════════════════════════════════════
describe('label interpolation in for loops', () => {
  it('interpolates {i} in label definitions and goto references', () => {
    const source = `
target "uma-cgra-base";
kernel "label_interp" {
  for i in range(3) {
    label_{i}: bundle { @0,0: LWI R0, i; }
  }
  bundle { @0,1: JUMP label_0, ZERO; }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const labels = result.ast!.kernel!.cycles.map((c) => c.label).filter(Boolean);
    expect(labels).toEqual(['label_0', 'label_1', 'label_2']);
  });

  it('interpolates {i} in goto within the same for loop', () => {
    const source = `
target "uma-cgra-base";
kernel "label_goto" {
  for i in range(2) {
    ret_{i}: bundle { @0,0: LWI R0, i; }
    bundle { @0,1: JUMP ret_{i}, ZERO; }
  }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const cycles = result.ast!.kernel!.cycles;
    expect(cycles.length).toBe(4);
    expect(cycles[0].label).toBe('ret_0');
    expect(cycles[2].label).toBe('ret_1');
    // Verify goto references expanded correctly
    const goto0 = cycles[1].statements[0];
    expect(goto0.instruction.text).toContain('ret_0');
    const goto1 = cycles[3].statements[0];
    expect(goto1.instruction.text).toContain('ret_1');
  });

  it('interpolates {i} in label used as immediate value', () => {
    const source = `
target "uma-cgra-base";
kernel "label_imm" {
  for i in range(2) {
    target_{i}: bundle { @0,0: LWI R0, 42; }
    bundle { @0,0: SADD R3, ZERO, target_{i}; }
  }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const cycles = result.ast!.kernel!.cycles;
    expect(cycles.length).toBe(4);
    expect(cycles[0].label).toBe('target_0');
    expect(cycles[2].label).toBe('target_1');
    expect(cycles[1].statements[0].instruction.text).toContain('target_0');
    expect(cycles[3].statements[0].instruction.text).toContain('target_1');
  });

  it('supports nested for loops with label interpolation', () => {
    const source = `
target "uma-cgra-base";
kernel "nested_label" {
  for i in range(2) {
    for j in range(2) {
      lbl_{i}_{j}: bundle { @0,0: NOP; }
    }
  }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const labels = result.ast!.kernel!.cycles.map((c) => c.label).filter(Boolean);
    expect(labels).toEqual(['lbl_0_0', 'lbl_0_1', 'lbl_1_0', 'lbl_1_1']);
  });

  it('does not substitute {x} when x is not a loop variable', () => {
    const source = `
target "uma-cgra-base";
kernel "no_false_interp" {
  for i in range(2) {
    lbl_{i}_{notavar}: bundle { @0,0: NOP; }
  }
}
`;
    const result = parseStructuredSource(source);
    // {notavar} is not a loop variable, so it stays as-is in the label.
    // The label will contain literal braces: lbl_0_{notavar}, lbl_1_{notavar}
    // This parses successfully but the braces remain unresolved.
    expect(result.success).toBe(true);
    const labels = result.ast!.kernel!.cycles.map((c) => c.label).filter(Boolean);
    expect(labels).toEqual(['lbl_0_{notavar}', 'lbl_1_{notavar}']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 2: Macros
// ═══════════════════════════════════════════════════════════════════════
describe('macros', () => {
  it('parses macro definitions and expands them', () => {
    const source = `
target "uma-cgra-base";

macro nop_at(r, c) {
  bundle { @r,c: NOP; }
}

kernel "macro_basic" {
  nop_at(0, 0);
  nop_at(1, 1);
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const cycles = result.ast!.kernel!.cycles;
    expect(cycles.length).toBe(2);
    expect(cycles[0].statements[0].kind).toBe('at');
    if (cycles[0].statements[0].kind === 'at') {
      expect(cycles[0].statements[0].row).toBe(0);
      expect(cycles[0].statements[0].col).toBe(0);
    }
    if (cycles[1].statements[0].kind === 'at') {
      expect(cycles[1].statements[0].row).toBe(1);
      expect(cycles[1].statements[0].col).toBe(1);
    }
  });

  it('macros can pass labels as parameters', () => {
    const source = `
target "uma-cgra-base";

macro call_subr(target_label, ret_label) {
  bundle { @0,0: SADD R3, ZERO, ret_label; }
  bundle { @0,1: JUMP target_label, ZERO; }
}

kernel "macro_labels" {
  call_subr(my_func, after_call);
  after_call: bundle { @0,0: NOP; }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const cycles = result.ast!.kernel!.cycles;
    expect(cycles.length).toBe(3);
    expect(cycles[0].statements[0].instruction.text).toContain('after_call');
    expect(cycles[1].statements[0].instruction.text).toContain('my_func');
    expect(cycles[2].label).toBe('after_call');
  });

  it('macros do not rename internal labels (unlike functions)', () => {
    const source = `
target "uma-cgra-base";

macro with_label(val) {
  internal: bundle { @0,0: LWI R0, val; }
}

kernel "macro_no_rename" {
  with_label(42);
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const labels = result.ast!.kernel!.cycles.map((c) => c.label).filter(Boolean);
    // Macro should NOT rename 'internal' to '__fn_with_label_1_internal'
    expect(labels).toEqual(['internal']);
  });

  it('macros combined with label interpolation in for loops', () => {
    const source = `
target "uma-cgra-base";

macro do_call(ret_label) {
  bundle { @0,0: SADD R3, ZERO, ret_label; }
  bundle { @0,1: JUMP entry, ZERO; }
}

kernel "macro_for_labels" {
  entry: bundle { @0,0: NOP; }
  for i in range(3) {
    do_call(ret_{i});
    ret_{i}: bundle { @0,0: NOP; }
  }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    const cycles = result.ast!.kernel!.cycles;
    const labels = cycles.map((c) => c.label).filter(Boolean);
    expect(labels).toContain('entry');
    expect(labels).toContain('ret_0');
    expect(labels).toContain('ret_1');
    expect(labels).toContain('ret_2');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 3: Include / Import
// ═══════════════════════════════════════════════════════════════════════
describe('include directive', () => {
  it('preprocesses include directives by replacing with file content', () => {
    const mainSource = `
target "uma-cgra-base";
include "helper.castm";
kernel "with_include" {
  helper_func(0, 0);
}
`;
    const helperContent = `
function helper_func(r, c) {
  bundle { @r,c: NOP; }
}
`;
    const resolveInclude = (path: string): string | null => {
      if (path === 'helper.castm') return helperContent;
      return null;
    };

    const result = parseStructuredSource(mainSource, { resolveInclude });
    expect(result.success).toBe(true);
    expect(result.ast!.kernel!.cycles.length).toBe(1);
  });

  it('reports error for unresolvable includes', () => {
    const source = `
target "uma-cgra-base";
include "nonexistent.castm";
kernel "broken_include" {
  bundle { @0,0: NOP; }
}
`;
    const resolveInclude = (): string | null => null;
    const result = parseStructuredSource(source, { resolveInclude });
    expect(result.diagnostics.some((d) => d.message.includes('Could not resolve include'))).toBe(true);
  });

  it('reports error for circular includes', () => {
    const source = `include "a.castm";`;
    const resolveInclude = (path: string): string | null => {
      if (path === 'a.castm') return `include "b.castm";`;
      if (path === 'b.castm') return `include "a.castm";`;
      return null;
    };
    const diagnostics: Diagnostic[] = [];
    preprocessIncludes(source, resolveInclude, diagnostics);
    expect(diagnostics.some((d) => d.message.includes('Circular include'))).toBe(true);
  });

  it('supports nested includes', () => {
    const mainSource = `
target "uma-cgra-base";
include "a.castm";
kernel "nested_includes" {
  from_b(1);
}
`;
    const resolveInclude = (path: string): string | null => {
      if (path === 'a.castm') return `include "b.castm";`;
      if (path === 'b.castm') return `
function from_b(x) {
  bundle { @0,0: LWI R0, x; }
}
`;
      return null;
    };

    const result = parseStructuredSource(mainSource, { resolveInclude });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.ast!.kernel!.cycles.length).toBe(1);
  });

  it('reports unresolved include when no resolveInclude option provided', () => {
    const source = `
target "uma-cgra-base";
include "something.castm";
kernel "no_resolver" {
  bundle { @0,0: NOP; }
}
`;
    const result = parseStructuredSource(source);
    expect(result.diagnostics.some((d) => d.message.includes('Unresolved include'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 4: Let constants
// ═══════════════════════════════════════════════════════════════════════
describe('let constants', () => {
  it('let declarations are parsed as directives and constants are built', () => {
    const source = `
target "uma-cgra-base";
kernel "let_immediates" {
  let ADDR = 128;
  bundle { @0,0: LWI R0, ADDR; }
  bundle { @0,0: SWI R0, ADDR; }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    // Constants are stored as directives in the kernel
    const directives = result.structuredAst?.kernel?.directives;
    expect(directives).toBeDefined();
    const addrDirective = directives?.find((d) => d.name === 'ADDR');
    expect(addrDirective).toBeDefined();
    expect(addrDirective?.kind).toBe('const');
    expect(addrDirective?.value).toBe('128');
    // Instruction text at AST level preserves the symbolic name;
    // resolution happens in later analysis passes
    const cycles = result.ast!.kernel!.cycles;
    expect(cycles.length).toBe(2);
    expect(cycles[0].statements[0].instruction.text).toContain('ADDR');
  });

  it('let constants are used for for-loop range evaluation', () => {
    const source = `
target "uma-cgra-base";
kernel "let_for_range" {
  let N = 3;
  for k in range(N) {
    bundle { @0,0: LWI R0, k; }
  }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    // The for loop should expand 3 times using the constant N=3
    const cycles = result.ast!.kernel!.cycles;
    expect(cycles.length).toBe(3);
  });

  it('let constants can reference earlier constants for range evaluation', () => {
    const source = `
target "uma-cgra-base";
kernel "let_chain" {
  let A = 2;
  let B = A + 1;
  for k in range(B) {
    bundle { @0,0: LWI R0, k; }
  }
}
`;
    const result = parseStructuredSource(source);
    expect(result.success).toBe(true);
    // B = A + 1 = 3, so 3 iterations
    const cycles = result.ast!.kernel!.cycles;
    expect(cycles.length).toBe(3);
  });
});
