import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

function expectCsvHasInstruction(csv: string, row: number, col: number, text: string): void {
  const normalized = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(csv).toMatch(new RegExp(`\\n\\d+,${row},${col},${normalized}(?:\\n|$)`));
}

describe('issues/FEAT-2 carry_chain statement', () => {
  it('lowers carry_chain into deterministic per-limb stage sequence', () => {
    const source = `
target "uma-cgra-base";
let L = { 0, 0, 0, 0 };
kernel "feat02_basic" {
  carry_chain(src=R0, carry=R3, store=L, limbs=3, width=16, row=0, start=0, dir=right);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    const rows = csvRows(csv);
    expect(rows).toHaveLength(12);
    expectCsvHasInstruction(csv, 0, 0, 'SADD R0 R0 R3');
    expectCsvHasInstruction(csv, 0, 0, 'LAND R0 R0 65535');
    expectCsvHasInstruction(csv, 0, 0, 'SWI R0 L[0]');
    expectCsvHasInstruction(csv, 0, 0, 'SRT R3 R0 16');
    expectCsvHasInstruction(csv, 0, 1, 'SWI R0 L[1]');
    expectCsvHasInstruction(csv, 0, 2, 'SRT R3 R0 16');
  });

  it('supports leftward carry chains and explicit mask values', () => {
    const source = `
target "uma-cgra-base";
let L = { 0, 0, 0, 0 };
kernel "feat02_left" {
  carry_chain(src=R4, carry=R5, store=L, limbs=2, width=8, mask=255, row=1, start=3, dir=left);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csvRows(csv)).toHaveLength(8);
    expectCsvHasInstruction(csv, 1, 3, 'SADD R4 R4 R5');
    expectCsvHasInstruction(csv, 1, 3, 'LAND R4 R4 255');
    expectCsvHasInstruction(csv, 1, 2, 'SADD R4 R4 R5');
    expectCsvHasInstruction(csv, 1, 2, 'SWI R4 L[1]');
  });

  it('emits diagnostics for malformed args or geometry overflow', () => {
    const malformed = compile(`
target "uma-cgra-base";
kernel "feat02_bad_parse" {
  carry_chain(src=R0, carry=R3, store=L, limbs=3, width=16);
}
`);
    expect(malformed.success).toBe(false);
    expect(malformed.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const badDirection = compile(`
target "uma-cgra-base";
kernel "feat02_bad_dir" {
  carry_chain(src=R0, carry=R3, store=L, limbs=3, width=16, row=0, dir=diag);
}
`);
    expect(badDirection.success).toBe(false);
    expect(badDirection.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const overflow = compile(`
target "uma-cgra-base";
kernel "feat02_oob" {
  carry_chain(src=R0, carry=R3, store=L, limbs=5, width=16, row=0, start=1, dir=right);
}
`);
    expect(overflow.success).toBe(false);
    expect(overflow.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });
});
