/**
 * Route Generator for OpenEdge-DSL
 * 
 * Implements the logic for #pragma route:
 * 1. Computes shortest path on 4x4 Torus
 * 2. Generates SADD/ROUT instruction tokens for each step
 */

import { Token, TokenType } from '../types/tokens';
import { createToken, createCycleHeader, createCycleFooter } from './control-flow-utils';

interface Point {
    row: number;
    col: number;
}

interface RouteParams {
    src: Point;
    dst: Point;
    payload: string;
    accum: string;
    line: number;
    customOp?: { opcode: string; dest: string; srcA: string; srcB: string };
}

/**
 * Wraps coordinate in 4x4 torus
 */
function wrap(val: number): number {
    return (val + 4) % 4;
}

/**
 * Computes shortest path on 4x4 torus
 * Returns list of points from src to dst
 */
function computeToroidalPath(src: Point, dst: Point): Point[] {
    if (src.row === dst.row && src.col === dst.col) {
        return [src];
    }

    const path: Point[] = [src];
    let current = { ...src };

    // Horizontal Movement
    // Distance right: (dst - src) % 4
    // Distance left: (src - dst) % 4
    const distRight = (dst.col - current.col + 4) % 4;
    const distLeft = (current.col - dst.col + 4) % 4;

    const hStep = distRight <= distLeft ? 1 : -1;
    const hDist = distRight <= distLeft ? distRight : distLeft;

    for (let i = 0; i < hDist; i++) {
        current = { row: current.row, col: wrap(current.col + hStep) };
        path.push(current);
    }

    // Vertical Movement
    const distDown = (dst.row - current.row + 4) % 4;
    const distUp = (current.row - dst.row + 4) % 4;

    const vStep = distDown <= distUp ? 1 : -1;
    const vDist = distDown <= distUp ? distDown : distUp;

    for (let i = 0; i < vDist; i++) {
        current = { row: wrap(current.row + vStep), col: current.col };
        path.push(current);
    }

    return path;
}

/**
 * Determines neighbor register (RCL, RCR, RCT, RCB) to read from
 * based on previous node position
 */
function getIncomingRegister(prev: Point, curr: Point): string {
    // Horizontal
    if (prev.row === curr.row) {
        if (wrap(prev.col + 1) === curr.col) return 'RCL'; // Came from Left
        if (wrap(curr.col + 1) === prev.col) return 'RCR'; // Came from Right
    }
    // Vertical
    if (prev.col === curr.col) {
        if (wrap(prev.row + 1) === curr.row) return 'RCT'; // Came from Top
        if (wrap(curr.row + 1) === prev.row) return 'RCB'; // Came from Bottom
    }
    throw new Error(`Invalid path step: (${prev.row},${prev.col}) -> (${curr.row},${curr.col})`);
}

/**
 * Generates tokens for the route
 */
export function generateRouteTokens(params: RouteParams): Token[] {
    const { src, dst, payload, accum, line } = params;
    const path = computeToroidalPath(src, dst);
    const tokens: Token[] = [];

    // Edge case: src == dst (Local Accumulation)
    if (path.length === 1) {
        tokens.push(...createCycleHeader(line));
        // @row,col: SADD accum, accum, payload
        tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
        tokens.push(createToken(TokenType.NUMBER, src.row.toString(), line));
        tokens.push(createToken(TokenType.OPERATOR, ',', line));
        tokens.push(createToken(TokenType.NUMBER, src.col.toString(), line));
        tokens.push(createToken(TokenType.OPERATOR, ':', line));

        tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
        tokens.push(createToken(TokenType.IDENTIFIER, accum, line));
        tokens.push(createToken(TokenType.OPERATOR, ',', line));
        tokens.push(createToken(TokenType.IDENTIFIER, accum, line));
        tokens.push(createToken(TokenType.OPERATOR, ',', line));
        tokens.push(createToken(TokenType.IDENTIFIER, payload, line));
        tokens.push(createToken(TokenType.SEMICOLON, ';', line));

        tokens.push(...createCycleFooter(line));
        return tokens;
    }

    // Multi-hop Routing
    for (let i = 0; i < path.length; i++) {
        const curr = path[i];
        const isFirst = i === 0;
        const isLast = i === path.length - 1;

        tokens.push(...createCycleHeader(line));

        // Coordinates: @r,c
        tokens.push(createToken(TokenType.AT_SYMBOL, '@', line));
        tokens.push(createToken(TokenType.NUMBER, curr.row.toString(), line));
        tokens.push(createToken(TokenType.OPERATOR, ',', line));
        tokens.push(createToken(TokenType.NUMBER, curr.col.toString(), line));
        tokens.push(createToken(TokenType.OPERATOR, ':', line));

        if (isFirst) {
            // Source: Send payload to ROUT
            // SADD ROUT, payload, ZERO
            tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
            tokens.push(createToken(TokenType.IDENTIFIER, 'ROUT', line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.IDENTIFIER, payload, line));
            tokens.push(createToken(TokenType.OPERATOR, ',', line));
            tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
        } else {
            const prev = path[i - 1];
            const incoming = getIncomingRegister(prev, curr);

            if (!isLast) {
                // Intermediate: Forward to ROUT
                // SADD ROUT, incoming, ZERO
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ROUT', line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, incoming, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, 'ZERO', line));
            } else if (params.customOp) {
                // Destination with custom operation
                // e.g., SMUL R0, R3, incoming
                const { opcode, dest, srcA, srcB } = params.customOp;
                // Replace 'INCOMING' placeholder with the actual incoming register
                const resolvedSrcA = srcA.toUpperCase() === 'INCOMING' ? incoming : srcA;
                const resolvedSrcB = srcB.toUpperCase() === 'INCOMING' ? incoming : srcB;

                tokens.push(createToken(TokenType.IDENTIFIER, opcode, line));
                tokens.push(createToken(TokenType.IDENTIFIER, dest, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, resolvedSrcA, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, resolvedSrcB, line));
            } else {
                // Destination: Standard Accumulate
                // SADD accum, accum, incoming
                tokens.push(createToken(TokenType.IDENTIFIER, 'SADD', line));
                tokens.push(createToken(TokenType.IDENTIFIER, accum, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, accum, line));
                tokens.push(createToken(TokenType.OPERATOR, ',', line));
                tokens.push(createToken(TokenType.IDENTIFIER, incoming, line));
            }
        }

        tokens.push(createToken(TokenType.SEMICOLON, ';', line));
        tokens.push(...createCycleFooter(line));
    }

    return tokens;
}
