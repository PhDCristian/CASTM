/**
 * Allreduce Generator for OpenEdge-DSL
 *
 * Implements #pragma allreduce: reduce + broadcast combined.
 * All PEs get the reduction result in a single pragma.
 *
 * Example: #pragma allreduce(sum, R1, R0)
 *   → Reduces R0 across all PEs, broadcasts result to everyone's R1
 */

import { Token } from '../types/tokens';
import { generateReduceTokens } from './pattern-generators';
import { generateBroadcastTokens } from './broadcast-generator';

interface AllreduceParams {
  operation: string;
  srcReg: string;
  destReg: string;
  axis?: 'row' | 'col';
  line: number;
}

/**
 * Generates tokens for allreduce pragma.
 *
 * Composes two existing generators:
 * 1. generateReduceTokens — tree reduction to PE(0,0)
 * 2. generateBroadcastTokens — broadcast result to all PEs
 */
export function generateAllreduceTokens(params: AllreduceParams): Token[] {
  const { operation, srcReg, destReg, axis, line } = params;
  const tokens: Token[] = [];

  // Step 1: Reduce to PE(0,0) (or PE(0,0) for column axis)
  tokens.push(...generateReduceTokens(operation, srcReg, destReg, line, axis));

  // Step 2: Broadcast result from PE(0,0) to all PEs
  tokens.push(...generateBroadcastTokens({
    valueReg: destReg,
    fromRow: 0,
    fromCol: 0,
    scope: axis === 'col' ? 'column' : 'row',
    line,
  }));

  return tokens;
}
