import { describe, it, expect } from 'vitest';
import { parseScanPragmaArgs, parseBroadcastPragmaArgs } from '../parser/pragma-parser';
import { generateScanTokens } from '../parser/scan-generator';
import { generateBroadcastTokens } from '../parser/broadcast-generator';
import { tokenize } from '../lexer/lexer';
import { TokenStream } from '../parser/token-stream';
import { compileDslToCsv } from '@utils/dsl-compiler';

describe('pragma-scan', () => {
    describe('parseScanPragmaArgs', () => {
        it('should parse basic scan pragma', () => {
            const tokens = tokenize('(add, R0, R1, right)');
            const stream = new TokenStream(tokens);
            const result = parseScanPragmaArgs(stream);

            expect(result).toBeDefined();
            expect(result?.operation).toBe('add');
            expect(result?.srcReg).toBe('R0');
            expect(result?.dstReg).toBe('R1');
            expect(result?.direction).toBe('right');
            expect(result?.mode).toBe('inclusive'); // default
        });

        it('should parse scan pragma with mode', () => {
            const tokens = tokenize('(add, R0, R1, right, exclusive)');
            const stream = new TokenStream(tokens);
            const result = parseScanPragmaArgs(stream);

            expect(result).toBeDefined();
            expect(result?.mode).toBe('exclusive');
        });

        it('should parse scan with different operations', () => {
            for (const op of ['max', 'min', 'and', 'or', 'xor']) {
                const tokens = tokenize(`(${op}, R0, R2, left)`);
                const stream = new TokenStream(tokens);
                const result = parseScanPragmaArgs(stream);

                expect(result?.operation).toBe(op);
                expect(result?.direction).toBe('left');
            }
        });
    });

    describe('generateScanTokens', () => {
        it('should generate tokens for right scan', () => {
            const tokens = generateScanTokens({
                operation: 'add',
                srcReg: 'R0',
                dstReg: 'R1',
                direction: 'right',
                mode: 'inclusive',
                line: 1
            });

            expect(tokens.length).toBeGreaterThan(0);

            // Convert tokens to string for easier checking
            const tokenStr = tokens.map(t => t.value).join(' ');
            expect(tokenStr).toContain('@ 0 , 0');  // First PE
            expect(tokenStr).toContain('SADD');
            expect(tokenStr).toContain('R1');
            expect(tokenStr).toContain('R0');
        });
    });

    describe('compilation integration', () => {
        it('should compile #pragma scan in a kernel', () => {
            const code = `
kernel "ScanTest" {
    config(0xF, 0);
    #pragma scan(add, R0, R1, right)
    cycle { @0,0: EXIT; }
}
            `;
            const result = compileDslToCsv(code);
            expect(result.success).toBe(true);
            // Scan should generate SADD instructions
            expect(result.csv).toContain('SADD');
        });

        it('should compile #pragma scan with exclusive mode', () => {
            const code = `
kernel "ScanExclusive" {
    config(0xF, 0);
    #pragma scan(add, R0, R1, right, exclusive)
    cycle { @0,0: EXIT; }
}
            `;
            const result = compileDslToCsv(code);
            expect(result.success).toBe(true);
        });

        it('should generate correct scan chain for prefix sum', () => {
            const code = `
kernel "PrefixSumTest" {
    config(0xF, 0);
    #pragma scan(add, R0, R1, right)
    cycle { @0,0: EXIT; }
}
            `;
            const result = compileDslToCsv(code);
            expect(result.success).toBe(true);
            // Should have ROUT for forwarding between PEs
            expect(result.csv).toContain('ROUT');
            // Should have RCL for receiving from left neighbor
            expect(result.csv).toContain('RCL');
        });
    });
});

describe('pragma-broadcast', () => {
    describe('parseBroadcastPragmaArgs', () => {
        it('should parse row broadcast pragma', () => {
            const tokens = tokenize('(value=R0, from=@0,0, to=row)');
            const stream = new TokenStream(tokens);
            const result = parseBroadcastPragmaArgs(stream);

            expect(result).toBeDefined();
            expect(result?.valueReg).toBe('R0');
            expect(result?.fromRow).toBe(0);
            expect(result?.fromCol).toBe(0);
            expect(result?.scope).toBe('row');
        });

        it('should parse column broadcast pragma', () => {
            const tokens = tokenize('(value=R2, from=@1,2, to=column)');
            const stream = new TokenStream(tokens);
            const result = parseBroadcastPragmaArgs(stream);

            expect(result).toBeDefined();
            expect(result?.valueReg).toBe('R2');
            expect(result?.fromRow).toBe(1);
            expect(result?.fromCol).toBe(2);
            expect(result?.scope).toBe('column');
        });

        it('should parse all broadcast pragma', () => {
            const tokens = tokenize('(value=ROUT, from=@0,0, to=all)');
            const stream = new TokenStream(tokens);
            const result = parseBroadcastPragmaArgs(stream);

            expect(result?.scope).toBe('all');
        });
    });

    describe('generateBroadcastTokens', () => {
        it('should generate tokens for row broadcast', () => {
            const tokens = generateBroadcastTokens({
                valueReg: 'R0',
                fromRow: 0,
                fromCol: 0,
                scope: 'row',
                line: 1
            });

            expect(tokens.length).toBeGreaterThan(0);

            const tokenStr = tokens.map(t => t.value).join(' ');
            expect(tokenStr).toContain('ROUT');  // Sends via ROUT
            expect(tokenStr).toContain('RCL');   // Receives from left
        });

        it('should generate tokens for column broadcast', () => {
            const tokens = generateBroadcastTokens({
                valueReg: 'R0',
                fromRow: 0,
                fromCol: 0,
                scope: 'column',
                line: 1
            });

            expect(tokens.length).toBeGreaterThan(0);

            const tokenStr = tokens.map(t => t.value).join(' ');
            expect(tokenStr).toContain('RCT');   // Receives from top
        });
    });

    describe('compilation integration', () => {
        it('should compile #pragma broadcast row in a kernel', () => {
            const code = `
kernel "BroadcastRowTest" {
    config(0xF, 0);
    #pragma broadcast(value=R0, from=@0,0, to=row)
    cycle { @0,0: EXIT; }
}
            `;
            const result = compileDslToCsv(code);
            expect(result.success).toBe(true);
            // Should generate chain of SADD ROUT and SADD R0, RCL
            expect(result.csv).toContain('ROUT');
            expect(result.csv).toContain('RCL');
        });

        it('should compile #pragma broadcast column in a kernel', () => {
            const code = `
kernel "BroadcastColTest" {
    config(0xF, 0);
    #pragma broadcast(value=R1, from=@0,0, to=column)
    cycle { @0,0: EXIT; }
}
            `;
            const result = compileDslToCsv(code);
            expect(result.success).toBe(true);
            expect(result.csv).toContain('RCT'); // Column uses vertical routing
        });

        it('should compile #pragma broadcast to all PEs', () => {
            const code = `
kernel "BroadcastAllTest" {
    config(0xF, 0);
    #pragma broadcast(value=R2, from=@0,0, to=all)
    cycle { @0,0: EXIT; }
}
            `;
            const result = compileDslToCsv(code);
            expect(result.success).toBe(true);
        });
    });
});
