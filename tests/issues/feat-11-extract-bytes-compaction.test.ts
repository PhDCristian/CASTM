import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

function normalizeCsv(csv: string): string {
  return csv
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

function normalizeInstruction(op: string): string {
  const srtZero = op.match(/^SRT\s+([A-Z0-9_]+)\s+([A-Z0-9_]+)\s+0$/i);
  if (srtZero) {
    return `SADD ${srtZero[1]} ${srtZero[2]} ZERO`;
  }

  const saddZero = op.match(/^SADD\s+([A-Z0-9_]+)\s+([A-Z0-9_]+)\s+0$/i);
  if (saddZero) {
    return `SADD ${saddZero[1]} ${saddZero[2]} ZERO`;
  }

  return op;
}

function normalizeCsvInstructions(csv: string): string {
  const lines = normalizeCsv(csv).split('\n');
  const [header, ...rows] = lines;
  const normalizedRows = rows.map((line) => {
    const [cycle, row, col, op] = line.split(',');
    return `${cycle},${row},${col},${normalizeInstruction(op)}`;
  });
  return [header, ...normalizedRows].join('\n');
}

describe('issues/FEAT-11 compact kernel patterns', () => {
  it('matches explicit row-byte extraction generated with for-in-cycle', () => {
    const manualSource = `
target "uma-cgra-base";
kernel "manual_extract_row" {
  bundle {
    for r in range(0, 4) {
      for c in range(0, 4) {
        at @r,c: SRT R1, R0, r*8;
      }
    }
  }
  bundle {
    for r in range(0, 4) {
      for c in range(0, 4) {
        at @r,c: LAND R1, R1, 255;
      }
    }
  }
}
`;

    const compactSource = `
target "uma-cgra-base";
kernel "compact_extract_row" {
  std::extract_bytes(src=R0, dest=R1, axis=row, byteWidth=8, mask=255);
}
`;

    const manual = compile(manualSource);
    const compact = compile(compactSource);

    expect(manual.success).toBe(true);
    expect(compact.success).toBe(true);

    const manualCsv = normalizeCsvInstructions(manual.artifacts.csv ?? '');
    const compactCsv = normalizeCsvInstructions(compact.artifacts.csv ?? '');
    expect(compactCsv).toBe(manualCsv);
  });

  it('supports concise function composition with std::extract_bytes', () => {
    const source = `
target "uma-cgra-base";

function extract_bytes_row(valueSrc, valueDst) {
  std::extract_bytes(src=valueSrc, dest=valueDst, axis=row, byteWidth=8, mask=255);
}

kernel "compact_fn_extract" {
  extract_bytes_row(R0, R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('SRT R1 R0 0');
    expect(csv).toContain('SRT R1 R0 8');
    expect(csv).toContain('SRT R1 R0 16');
    expect(csv).toContain('SRT R1 R0 24');
    expect(csv).toContain('LAND R1 R1 255');
  });
});
