import { describe, it, expect } from 'vitest';
import { compileDslToCsv } from '@utils/dsl-compiler';

describe('Pragma Route Support', () => {

    it('should generate local accumulation (0-hop) correctly', () => {
        // Case 1: Same PE (Local Accumulation)
        const code = `
    kernel "RouteTest_Local" {
        config(0xF, 0);
        #pragma route (0,0) -> (0,0) payload(R1) accum(R0)
    }
    `;
        const result = compileDslToCsv(code);
        expect(result.success).toBe(true);
        // Expected: @0,0: SADD R0, R0, R1;
        // We check for the instruction string in the CSV output
        // The CSV generator puts strings in quotes if they contain commas
        expect(result.csv).toContain('"SADD R0, R0, R1"');
    });

    it('should generate 1-hop neighbor routing (Right)', () => {
        // Case 2: 1-hop Right ((0,0) -> (0,1))
        // Logic: Send Right, Recieve from Left (RCL)
        const code = `
    kernel "RouteTest_Neighbor" {
        config(0xF, 0);
        #pragma route (0,0) -> (0,1) payload(R1) accum(R0)
    }
    `;
        const result = compileDslToCsv(code);
        expect(result.success).toBe(true);

        // Cycle 1: @0,0: SADD ROUT, R1, ZERO;
        expect(result.csv).toContain('"SADD ROUT, R1, ZERO"');

        // Cycle 2: @0,1: SADD R0, R0, RCL;
        expect(result.csv).toContain('"SADD R0, R0, RCL"');
    });

    it('should generate wrap-around routing (Left via Torus)', () => {
        // Case 3: Wrap-around Left ((0,0) -> (0,3))
        // Logic: 0 is "Right" of 3 on torus. 
        // PE(0,0) sends (Right). PE(0,3) receives from Right (RCR).
        // Wait, let's re-verify the logic from route-generator.ts:
        // Path: (0,0) -> (0,3). 
        // distRight: (3-0+4)%4 = 3. distLeft: (0-3+4)%4 = 1.
        // distLeft < distRight, so go Left (step -1).
        // Path: (0,0) -> (0,3).
        // Sender (0,0) computes neighbor. 
        // Actually, sender PUSHES to ROUT.
        // Receiver (0,3) READS from neighbor.
        // (0,0) is to the Right of (0,3). So (0,3) reads from RCR.

        const code = `
    kernel "RouteTest_Wrap" {
        config(0xF, 0);
        #pragma route (0,0) -> (0,3) payload(R1) accum(R0)
    }
    `;
        const result = compileDslToCsv(code);
        expect(result.success).toBe(true);

        // Cycle 1: @0,0: SADD ROUT, R1, ZERO;
        expect(result.csv).toContain('"SADD ROUT, R1, ZERO"');

        // Cycle 2: @0,3: SADD R0, R0, RCR;
        expect(result.csv).toContain('"SADD R0, R0, RCR"');
    });

    it('should generate multi-hop routing (2 hops)', () => {
        // Case 4: 2-hops (Right then Down) ((0,0) -> (1,1))
        // Path: (0,0) -> (0,1) -> (1,1)
        const code = `
    kernel "RouteTest_MultiHop" {
        config(0xF, 0);
        #pragma route (0,0) -> (1,1) payload(R1) accum(R0)
    }
    `;
        const result = compileDslToCsv(code);
        expect(result.success).toBe(true);

        // Cycle 1: @0,0 sends
        expect(result.csv).toContain('"SADD ROUT, R1, ZERO"');

        // Cycle 2: @0,1 forwards (Receive Left RCL -> Send ROUT)
        // Wait, previous test showed forward logic.
        // Let's verify route-generator logic for intermediate node.
        // prev=(0,0), curr=(0,1). Incoming = RCL.
        // Instruction: SADD ROUT, RCL, ZERO.
        expect(result.csv).toContain('"SADD ROUT, RCL, ZERO"');

        // Cycle 3: @1,1 receives (from 0,1 which is Top).
        // Incoming = RCT.
        expect(result.csv).toContain('"SADD R0, R0, RCT"');
    });

    it('should fail with invalid arguments', () => {
        const code = `
    kernel "RouteTest_Invalid" {
        config(0xF, 0);
        #pragma route (0,0) -> (0,0) // Missing payload/accum
    }
    `;
        const result = compileDslToCsv(code);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Expected IDENTIFIER');
    });

    it('should generate custom operation at destination with op()', () => {
        // Extended syntax: dest(REG) op(OPCODE Rd, Rs1, Rs2)
        // Use INCOMING placeholder for the routed value
        const code = `
    kernel "RouteTest_CustomOp" {
        config(0xF, 0);
        #pragma route (0,1) -> (0,0) payload(R3) dest(R1) op(SMUL R1, R0, INCOMING)
    }
    `;
        const result = compileDslToCsv(code);
        expect(result.success).toBe(true);

        // Cycle 1: @0,1 sends R3
        expect(result.csv).toContain('"SADD ROUT, R3, ZERO"');

        // Cycle 2: @0,0 receives via RCR and multiplies with R0
        expect(result.csv).toContain('"SMUL R1, R0, RCR"');
    });

    it('should support multi-hop routing with custom op()', () => {
        // 2-hop routing with custom SADD at destination
        const code = `
    kernel "RouteTest_MultiHopOp" {
        config(0xF, 0);
        #pragma route (0,0) -> (1,1) payload(R2) dest(R0) op(SADD R0, R3, INCOMING)
    }
    `;
        const result = compileDslToCsv(code);
        expect(result.success).toBe(true);

        // Cycle 1: @0,0 sends R2
        expect(result.csv).toContain('"SADD ROUT, R2, ZERO"');

        // Cycle 2: @0,1 forwards
        expect(result.csv).toContain('"SADD ROUT, RCL, ZERO"');

        // Cycle 3: @1,1 receives and applies custom op
        expect(result.csv).toContain('"SADD R0, R3, RCT"');
    });

});
