/**
 * Broadcast Generator for OpenEdge-DSL
 * 
 * Implements the logic for #pragma broadcast:
 * Distributes a value from one PE to multiple PEs
 */

import { Token, TokenType } from '../types/tokens';
import { createToken, createCycleHeader, createCycleFooter } from './control-flow-utils';

interface BroadcastParams {
    valueReg: string;    // Register to broadcast
    fromRow: number;     // Source PE row
    fromCol: number;     // Source PE col
    scope: 'row' | 'column' | 'all';
    line: number;
}

/**
 * Generates tokens for broadcast pragma
 * 
 * For row broadcast from @0,0:
 * - Cycle 1: @0,0: SADD ROUT, valueReg, ZERO
 * - Cycle 2: @0,1: SADD valueReg, RCL, ZERO; SADD ROUT, valueReg, ZERO
 * - Cycle 3: @0,2: SADD valueReg, RCL, ZERO; SADD ROUT, valueReg, ZERO  
 * - Cycle 4: @0,3: SADD valueReg, RCL, ZERO
 */
export function generateBroadcastTokens(params: BroadcastParams): Token[] {
    const { valueReg, fromRow, fromCol, scope, line } = params;
    const tokens: Token[] = [];

    if (scope === 'row') {
        // Row broadcast: propagate horizontally
        // Start from fromCol, propagate right
        for (let i = 0; i < 4; i++) {
            const col = (fromCol + i) % 4;
            const isFirst = i === 0;
            const isLast = i === 3;

            tokens.push(...createCycleHeader(line));

            // @row,col:
            tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
            tokens.push(createToken(TokenType.NUMBER, fromRow.toString(), line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.NUMBER, col.toString(), line));
            tokens.push(createToken(TokenType.OPERATOR, ':', line));

            if (isFirst) {
                // Source PE: Send to ROUT
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ROUT', line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, valueReg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
            } else {
                // Receiving PE: valueReg = RCL
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, valueReg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'RCL', line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));

                // Forward to next (except last)
                if (!isLast) {
                    tokens.push(createToken(TokenType.SEMICOLON, ';', line));

                    // Another instruction in same cycle: SADD ROUT, valueReg, ZERO
                    tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
                    tokens.push(createToken(TokenType.NUMBER, fromRow.toString(), line));
                    tokens.push(createToken(TokenType.OPERATOR, ',', line));
                    tokens.push(createToken(TokenType.NUMBER, col.toString(), line));
                    tokens.push(createToken(TokenType.OPERATOR, ':', line));

                    tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                    tokens.push(createToken(TokenType.IDENTIFIER, 'ROUT', line));
                    tokens.push(createToken(TokenType.OPERATOR, ',', line));
                    tokens.push(createToken(TokenType.IDENTIFIER, valueReg, line));
                    tokens.push(createToken(TokenType.OPERATOR, ',', line));
                    tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
                }
            }

            tokens.push(createToken(TokenType.SEMICOLON, ';', line));
            tokens.push(...createCycleFooter(line));
        }
    } else if (scope === 'column') {
        // Column broadcast: propagate vertically
        for (let i = 0; i < 4; i++) {
            const row = (fromRow + i) % 4;
            const isFirst = i === 0;
            const isLast = i === 3;

            tokens.push(...createCycleHeader(line));

            tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
            tokens.push(createToken(TokenType.NUMBER, row.toString(), line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.NUMBER, fromCol.toString(), line));
            tokens.push(createToken(TokenType.OPERATOR, ':', line));

            if (isFirst) {
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ROUT', line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, valueReg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
            } else {
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, valueReg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'RCT', line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));

                if (!isLast) {
                    tokens.push(createToken(TokenType.SEMICOLON, ';', line));

                    tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
                    tokens.push(createToken(TokenType.NUMBER, row.toString(), line));
                    tokens.push(createToken(TokenType.OPERATOR, ',', line));
                    tokens.push(createToken(TokenType.NUMBER, fromCol.toString(), line));
                    tokens.push(createToken(TokenType.OPERATOR, ':', line));

                    tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                    tokens.push(createToken(TokenType.IDENTIFIER, 'ROUT', line));
                    tokens.push(createToken(TokenType.OPERATOR, ',', line));
                    tokens.push(createToken(TokenType.IDENTIFIER, valueReg, line));
                    tokens.push(createToken(TokenType.OPERATOR, ',', line));
                    tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
                }
            }

            tokens.push(createToken(TokenType.SEMICOLON, ';', line));
            tokens.push(...createCycleFooter(line));
        }
    } else {
        // 'all' scope: first row, then column from each PE
        // This is complex - for now, do row then column from origin
        const rowTokens = generateBroadcastTokens({
            ...params,
            scope: 'row'
        });
        tokens.push(...rowTokens);

        // Then column broadcast from each PE in the row
        for (let col = 0; col < 4; col++) {
            const colTokens = generateBroadcastTokens({
                valueReg,
                fromRow,
                fromCol: col,
                scope: 'column',
                line
            });
            tokens.push(...colTokens);
        }
    }

    return tokens;
}
