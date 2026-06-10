import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

type SerializedBundle = {
  index: number;
  ops: Array<{ row: number; col: number; text: string }>;
};

function serializeAst(ast: any): SerializedBundle[] {
  const bundles = ast?.kernel?.bundles ?? [];
  return bundles.map((bundle: any) => ({
    index: bundle.index,
    ops: bundle.statements.flatMap((stmt: any) => {
      if (stmt.kind === 'row') {
        return stmt.instructions.map((inst: any) => ({
          row: stmt.row,
          col: -1,
          text: inst.text
        }));
      }
      if (stmt.kind === 'all') {
        return [{ row: -2, col: -2, text: stmt.instruction.text }];
      }
      return [{ row: stmt.row ?? -1, col: stmt.col ?? -1, text: stmt.instruction.text }];
    })
  }));
}

function serializeLowered(program: any): SerializedBundle[] {
  return (program?.bundles ?? []).map((bundle: any) => ({
    index: bundle.index,
    ops: (bundle.operations ?? bundle.slots ?? []).map((item: any) => {
      const instruction = item.instruction ?? item;
      return {
        row: item.row,
        col: item.col,
        text: `${instruction.opcode} ${instruction.operands.join(' ')}`.trim()
      };
    })
  }));
}

describe('compiler-api pipeline contracts', () => {
  it('keeps deterministic snapshots across pipeline artifacts', () => {
    const source = `
target "uma-cgra-base";
let A = { 10, 20, 30, 40 };
kernel "pipeline_contract" {
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
  bundle {
    @0,0: R0 = A[1];
    @0,1: R2 = R0 + IMM(1);
  }
}
`;

    const result = compile(source, {
      emitArtifacts: ['structured', 'ast', 'hir', 'mir', 'lir', 'csv']
    });

    expect(result.success).toBe(true);

    const structuredView = {
      targetProfileId: result.artifacts.structuredAst?.targetProfileId,
      kernelName: result.artifacts.structuredAst?.kernel?.name,
      bodyKinds: result.artifacts.structuredAst?.kernel?.body.map((stmt) => stmt.kind),
      advancedTexts: result.artifacts.structuredAst?.kernel?.body
        .filter((stmt) => stmt.kind === 'advanced')
        .map((stmt: any) => stmt.text)
    };

    const snapshotView = {
      structured: structuredView,
      ast: serializeAst(result.artifacts.ast),
      hir: serializeLowered(result.artifacts.hir),
      mir: serializeLowered(result.artifacts.mir),
      lir: serializeLowered(result.artifacts.lir),
      csv: result.artifacts.csv?.trim().split('\n')
    };

    expect(snapshotView).toMatchSnapshot();
  });
});
