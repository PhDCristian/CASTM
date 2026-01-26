/**
 * Scan Generator for OpenEdge-DSL
 * 
 * Implements the logic for #pragma scan:
 * Generates prefix operation (scan) across PEs
 */

import { Token, TokenType } from '../types/tokens';
import { createToken, createCycleHeader, createCycleFooter } from './control-flow-utils';

interface ScanParams {
    operation: string;   // 'add', 'max', 'min', 'and', 'or', 'xor'
    srcReg: string;      // Source register
    dstReg: string;      // Destination register
    direction: 'left' | 'right' | 'up' | 'down';
    mode: 'inclusive' | 'exclusive';
    line: number;
}

/**
 * Maps operation to instruction
 */
function getInstructionForOp(operation: string): string {
    switch (operation.toLowerCase()) {
        case 'add': return 'SADD';
        case 'and': return 'LAND';
        case 'or': return 'LOR';
        case 'xor': return 'LXOR';
        case 'max':
        case 'min':
            // For max/min, we need BSFA pattern - for now use SADD as placeholder
            // TODO: Implement proper max/min with BSFA
            return 'SADD';
        default:
            return 'SADD';
    }
}

/**
 * Gets the incoming neighbor register based on direction
 */
function getIncomingRegister(direction: 'left' | 'right' | 'up' | 'down'): string {
    switch (direction) {
        case 'right': return 'RCL';  // Coming from left
        case 'left': return 'RCR';   // Coming from right
        case 'down': return 'RCT';   // Coming from top
        case 'up': return 'RCB';     // Coming from bottom
    }
}

/**
 * Gets identity value for operation
 */
function getIdentityForOp(operation: string): string {
    switch (operation.toLowerCase()) {
        case 'add':
        case 'or':
        case 'xor':
            return '0';
        case 'and':
            return '4294967295'; // 0xFFFFFFFF
        case 'max':
            return '-2147483648'; // MIN_INT
        case 'min':
            return '2147483647';  // MAX_INT
        default:
            return '0';
    }
}

/**
 * Generates tokens for scan pragma
 * 
 * For right scan across row 0:
 * - PE[0]: dstReg = srcReg (or identity for exclusive)
 * - PE[0]: ROUT = srcReg
 * - PE[1]: dstReg = srcReg op RCL
 * - PE[1]: ROUT = dstReg
 * - PE[2]: dstReg = srcReg op RCL
 * - PE[2]: ROUT = dstReg
 * - PE[3]: dstReg = srcReg op RCL
 */
export function generateScanTokens(params: ScanParams): Token[] {
    const { operation, srcReg, dstReg, direction, mode, line } = params;
    const tokens: Token[] = [];
    const instr = getInstructionForOp(operation);
    const incoming = getIncomingRegister(direction);

    // Determine row/col iteration based on direction
    const isHorizontal = direction === 'left' || direction === 'right';
    const row = 0; // For now, scan operates on row 0 for horizontal
    const col = 0; // For now, scan operates on col 0 for vertical
    const size = 4;

    // Get iteration order
    const getIdx = (i: number): number => {
        if (direction === 'right' || direction === 'down') return i;
        return size - 1 - i;
    };

    for (let i = 0; i < size; i++) {
        const idx = getIdx(i);
        const isFirst = i === 0;
        const posRow = isHorizontal ? row : idx;
        const posCol = isHorizontal ? idx : col;

        // Cycle 1 for this PE: compute dstReg
        tokens.push(...createCycleHeader(line));

        // @row,col:
        tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
        tokens.push(createToken(TokenType.NUMBER, posRow.toString(), line));
        tokens.push(createToken(TokenType.OPERATOR, ',', line));
        tokens.push(createToken(TokenType.NUMBER, posCol.toString(), line));
        tokens.push(createToken(TokenType.OPERATOR, ':', line));

        if (isFirst) {
            if (mode === 'inclusive') {
                // First PE: dstReg = srcReg
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, dstReg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, srcReg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
            } else {
                // Exclusive: dstReg = identity
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, dstReg, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
            }
        } else {
            // Other PEs: dstReg = srcReg op incoming
            tokens.push(createToken(TokenType.IDENTIFIER, instr, line));
            tokens.push(createToken(TokenType.IDENTIFIER, dstReg, line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.IDENTIFIER, srcReg, line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.IDENTIFIER, incoming, line));
        }

        tokens.push(createToken(TokenType.SEMICOLON, ';', line));
        tokens.push(...createCycleFooter(line));

        // Cycle 2 for this PE (except last): send to ROUT
        if (i < size - 1) {
            tokens.push(...createCycleHeader(line));

            tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
            tokens.push(createToken(TokenType.NUMBER, posRow.toString(), line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.NUMBER, posCol.toString(), line));
            tokens.push(createToken(TokenType.OPERATOR, ':', line));

            // SADD ROUT, (inclusive: dstReg, exclusive for first: srcReg), ZERO
            tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
            tokens.push(createToken(TokenType.IDENTIFIER, 'ROUT', line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));

            if (isFirst && mode === 'exclusive') {
                // For exclusive, first PE sends srcReg not identity
                tokens.push(createToken(TokenType.IDENTIFIER, srcReg, line));
            } else {
                tokens.push(createToken(TokenType.IDENTIFIER, dstReg, line));
            }

            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
            tokens.push(createToken(TokenType.SEMICOLON, ';', line));

            tokens.push(...createCycleFooter(line));
        }
    }

    return tokens;
}
