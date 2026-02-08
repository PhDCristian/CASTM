/**
 * Rotate/Shift Generator for OpenEdge-DSL
 *
 * Implements #pragma rotate and #pragma shift:
 * - rotate: circular shift of register values across PEs in a row
 * - shift: linear shift with fill value at vacated position
 */

import { Token, TokenType } from '../types/tokens';
import { createToken, createCycleHeader, createCycleFooter } from './control-flow-utils';

export interface RotateParams {
    reg: string;          // Register to rotate (e.g., 'R0')
    direction: 'left' | 'right';
    distance: number;     // How many positions to shift (default 1)
    fill?: number;        // If defined, this is a shift (fill vacated positions)
    isShift: boolean;     // true for shift, false for rotate
    line: number;
}

/**
 * Gets the neighbor register for the given direction.
 * "left" means values move left, so each PE reads from its right neighbor.
 * "right" means values move right, so each PE reads from its left neighbor.
 */
function getNeighborReg(direction: 'left' | 'right'): string {
    return direction === 'left' ? 'RCR' : 'RCL';
}

/**
 * Generates tokens for #pragma rotate or #pragma shift.
 *
 * For rotate left (distance=1) across row 0, 4 PEs:
 *   Each PE[i] gets value from PE[(i+1) % 4]
 *   PE[0] = PE[1], PE[1] = PE[2], PE[2] = PE[3], PE[3] = PE[0] (wrap)
 *
 * For shift left (distance=1, fill=0):
 *   PE[0] = PE[1], PE[1] = PE[2], PE[2] = PE[3], PE[3] = 0
 *
 * Implementation:
 *   Cycle 1: All PEs copy reg to ROUT (to make value available to neighbors)
 *   Cycle 2: All PEs read from neighbor register
 *            For shift: edge PE loads fill value instead
 */
export function generateRotateTokens(params: RotateParams): Token[] {
    const { reg, direction, distance, fill, isShift, line } = params;
    const tokens: Token[] = [];
    const neighbor = getNeighborReg(direction);
    const size = 4;

    // For distance > 1, we chain multiple single-distance rotations
    for (let d = 0; d < distance; d++) {
        // Determine which PE is the "edge" (gets fill for shift, gets wrap for rotate)
        // For left shift: rightmost PE (col 3) gets fill
        // For right shift: leftmost PE (col 0) gets fill
        const edgeCol = direction === 'left' ? size - 1 : 0;

        // Cycle 1: All PEs send their value to ROUT
        tokens.push(...createCycleHeader(line));
        for (let col = 0; col < size; col++) {
            tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
            tokens.push(createToken(TokenType.NUMBER, '0', line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.NUMBER, col.toString(), line));
            tokens.push(createToken(TokenType.OPERATOR, ':', line));

            tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
            tokens.push(createToken(TokenType.IDENTIFIER, 'ROUT', line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.IDENTIFIER, reg, line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
            tokens.push(createToken(TokenType.SEMICOLON, ';', line));
        }
        tokens.push(...createCycleFooter(line));

        // Cycle 2: Each PE reads from neighbor; edge PE gets fill or wrap
        tokens.push(...createCycleHeader(line));
        for (let col = 0; col < size; col++) {
            tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
            tokens.push(createToken(TokenType.NUMBER, '0', line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.NUMBER, col.toString(), line));
            tokens.push(createToken(TokenType.OPERATOR, ':', line));

            if (isShift && col === edgeCol) {
                // Edge PE for shift: load fill value
                const fillVal = fill ?? 0;
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, reg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, `IMM(${fillVal})`, line));
            } else {
                // Normal PE: read from neighbor
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, reg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, neighbor, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
            }
            tokens.push(createToken(TokenType.SEMICOLON, ';', line));
        }
        tokens.push(...createCycleFooter(line));
    }

    return tokens;
}
