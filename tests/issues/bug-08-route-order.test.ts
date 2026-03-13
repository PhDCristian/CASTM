import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('issues/BUG-8 route ordering', () => {
  it('keeps route lowering at its lexical position (no hoisting)', () => {
    const source = `
target "uma-cgra-base";
kernel "bug8_route_order" {
  bundle { @0,0: SADD R0, ZERO, 7; }
  route(@0,0 -> @0,1, payload=R0, accum=R1);
  bundle { @0,1: SADD R2, R1, ZERO; }
}
`;

    const result = compile(source, { emitArtifacts: ['mir'] });
    expect(result.success).toBe(true);

    const mir = result.artifacts.mir;
    expect(mir).toBeDefined();

    const cycles = mir!.cycles;
    const findCycleIndex = (predicate: (entry: string) => boolean): number => {
      return cycles.findIndex((cycle) =>
        cycle.slots.some((slot) =>
          predicate(`${slot.row},${slot.col},${slot.instruction.opcode} ${slot.instruction.operands.join(' ')}`)
        )
      );
    };

    const producerIdx = findCycleIndex((text) => text.includes('0,0,SADD R0 ZERO 7'));
    const routeTransferIdx = findCycleIndex((text) => text.includes('0,0,SADD ROUT R0 ZERO'));
    const consumerIdx = findCycleIndex((text) => text.includes('0,1,SADD R2 R1 ZERO'));

    expect(producerIdx).toBeGreaterThanOrEqual(0);
    expect(routeTransferIdx).toBeGreaterThanOrEqual(0);
    expect(consumerIdx).toBeGreaterThanOrEqual(0);

    expect(routeTransferIdx).toBeGreaterThan(producerIdx);
    expect(consumerIdx).toBeGreaterThan(routeTransferIdx);
  });
});
