import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-11 extract_bytes statement', () => {
  it('extracts byte lanes using column axis by default', () => {
    const source = `
target "uma-cgra-base";
kernel "feat11_col" {
  std::extract_bytes(src=R0, dest=R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    const lines = csvRows(csv);
    expect(lines).toHaveLength(32);
    expect(csv).toContain('0,0,0,SRT R1 R0 0');
    expect(csv).toContain('0,0,1,SRT R1 R0 8');
    expect(csv).toContain('0,0,2,SRT R1 R0 16');
    expect(csv).toContain('0,0,3,SRT R1 R0 24');
    expect(csv).toContain('1,0,0,LAND R1 R1 255');
  });

  it('supports row axis and custom byte width/mask', () => {
    const source = `
target "uma-cgra-base";
build {
  grid 3x5 mesh;
}
kernel "feat11_row" {
  std::extract_bytes(src=R2, dest=R3, axis=row, byteWidth=4, mask=15);
}
`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    const lines = csvRows(csv);
    expect(lines).toHaveLength(30);
    expect(csv).toContain('0,0,0,SRT R3 R2 0');
    expect(csv).toContain('0,1,0,SRT R3 R2 4');
    expect(csv).toContain('0,2,0,SRT R3 R2 8');
    expect(csv).toContain('1,2,4,LAND R3 R3 15');
  });

  it('emits parse diagnostics for malformed extract_bytes syntax', () => {
    const malformed = compile(`
target "uma-cgra-base";
kernel "feat11_bad_parse" {
  extract_bytes(src=R0);
}
`);

    expect(malformed.success).toBe(false);
    expect(malformed.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('emits semantic diagnostics for invalid byteWidth', () => {
    const badWidth = compile(`
target "uma-cgra-base";
kernel "feat11_bad_width" {
  extract_bytes(src=R0, dest=R1, byteWidth=32);
}
`);

    expect(badWidth.success).toBe(false);
    expect(badWidth.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
