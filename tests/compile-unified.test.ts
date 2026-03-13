import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compile, emit } from '@castm/compiler-api';

const inputPath = '/Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/poseidon2/kernels/unified/poseidon2_unified.castm';
const sourceDir = path.dirname(inputPath);

const resolveInclude = (includePath: string): string | null => {
  try {
    const resolved = path.resolve(sourceDir, includePath);
    return readFileSync(resolved, 'utf8');
  } catch {
    return null;
  }
};

describe('poseidon2 unified kernel', () => {
  it('compiles and emits sim-matrix-csv without errors', async () => {
    const source = await readFile(inputPath, 'utf-8');

    // Compile to get MIR/LIR
    const result = compile(source, { resolveInclude });

    if (result.diagnostics.length > 0) {
      for (const d of result.diagnostics) {
        console.error(`[${d.severity}] ${d.message}` + (d.line != null ? ` (line ${d.line})` : ''));
      }
    }

    const errors = result.diagnostics.filter((d: any) => d.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(result.success).toBe(true);

    // Get MIR or LIR for sim-matrix-csv emission
    const program = result.artifacts.lir ?? result.artifacts.mir;
    expect(program).toBeDefined();

    // Emit in sim-matrix-csv format (what the CGRA simulator expects)
    const emitted = emit(program!, { format: 'sim-matrix-csv' });
    expect(emitted.success).toBe(true);

    await writeFile(path.join(sourceDir, 'instructions.csv'), emitted.csv);

    console.log(`Success: ${result.success}`);
    console.log(`Cycles: ${result.stats.cycles}, Instructions: ${result.stats.instructions}`);
    console.log(`Active slots: ${result.stats.activeSlots}, Utilization: ${(result.stats.utilization * 100).toFixed(1)}%`);
    console.log(`CSV lines: ${emitted.csv.split('\n').length}`);

    // Verify no unresolved symbols in CSV
    const unresolvedCount = (emitted.csv.match(/SUBR_RETURN|SBOX_RETURN|SBOX16_RETURN|SBOX_IN|P_ADDR|RC_SCHED/g) || []).length;
    console.log(`Unresolved symbols: ${unresolvedCount}`);
    expect(unresolvedCount).toBe(0);
  });
});
