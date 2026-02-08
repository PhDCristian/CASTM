/**
 * Transpose Generator for OpenEdge-DSL
 *
 * Implements #pragma transpose(reg=R0):
 * Transposes register values across the 4x4 PE grid.
 * After transpose: PE(i,j).reg = original PE(j,i).reg
 *
 * Strategy:
 * 1. Save original value to R2 (temp)
 * 2. For each column c, scatter the column's values to row c
 *    using horizontal + vertical relay
 *
 * The algorithm processes columns 0-3:
 *   For column c, PE(r,c) has a value that should end up at PE(c,r).
 *   - First, PE(r,c) broadcasts its R2 to ROUT
 *   - Then PE(c,r) receives it via relay chain
 *
 * Since direct 2D routing is needed, we use a phase-based approach:
 * Phase 1: All PEs copy reg → R2 (preserve originals)
 * Phase 2: For each row pair (i<j), swap PE(i,j) ↔ PE(j,i) values
 *          using vertical relay within the appropriate columns
 */

import { Token, TokenType } from '../types/tokens';
import { createToken, createCycleHeader, createCycleFooter } from './control-flow-utils';

interface TransposeParams {
  reg: string;
  line: number;
}

/**
 * Helper: creates instruction tokens for a single PE: @row,col: OPCODE dest, src1, src2;
 */
function peInstr(
  row: number, col: number,
  opcode: string, dest: string, src1: string, src2: string,
  line: number
): Token[] {
  return [
    createToken(TokenType.AT_SYMBOL, '@', line),
    createToken(TokenType.NUMBER, row.toString(), line),
    createToken(TokenType.OPERATOR, ',', line),
    createToken(TokenType.NUMBER, col.toString(), line),
    createToken(TokenType.OPERATOR, ':', line),
    createToken(TokenType.IDENTIFIER, opcode, line),
    createToken(TokenType.IDENTIFIER, dest, line),
    createToken(TokenType.OPERATOR, ',', line),
    createToken(TokenType.IDENTIFIER, src1, line),
    createToken(TokenType.OPERATOR, ',', line),
    createToken(TokenType.IDENTIFIER, src2, line),
    createToken(TokenType.SEMICOLON, ';', line),
  ];
}

/**
 * Generates tokens for a full cycle containing multiple PE instructions.
 */
function makeCycle(instrSets: Token[][], line: number): Token[] {
  return [
    ...createCycleHeader(line),
    ...instrSets.flat(),
    ...createCycleFooter(line),
  ];
}

/**
 * Generates tokens for #pragma transpose.
 *
 * Algorithm overview for 4x4 grid:
 *
 * The diagonal PE(i,i) keeps its own value — no work needed.
 * The 6 off-diagonal swap pairs are: (0,1)↔(1,0), (0,2)↔(2,0), (0,3)↔(3,0),
 *   (1,2)↔(2,1), (1,3)↔(3,1), (2,3)↔(3,2).
 *
 * Strategy: column-based scatter.
 * For each column c (0..3), PE(r,c) needs to send its value to PE(c,r).
 * We process this as: for each column, route values vertically then horizontally.
 *
 * Simplified implementation:
 * 1. Save all values to R2
 * 2. Process row exchanges from adjacent to distant:
 *    a. Row 0↔1 exchange (distance 1): PE(0,1)↔PE(1,0), handled in cols 0,1
 *    b. Row 1↔2 exchange (distance 1): PE(1,2)↔PE(2,1), handled in cols 1,2
 *    c. Row 2↔3 exchange (distance 1): PE(2,3)↔PE(3,2), handled in cols 2,3
 *    d. Row 0↔2 exchange (distance 2): PE(0,2)↔PE(2,0)
 *    e. Row 1↔3 exchange (distance 2): PE(1,3)↔PE(3,1)
 *    f. Row 0↔3 exchange (distance 3): PE(0,3)↔PE(3,0)
 *
 * For each swap pair PE(i,j)↔PE(j,i):
 *   - PE(i,j) needs value from row j, col i → that's PE(j,i).R2
 *   - PE(j,i) needs value from row i, col j → that's PE(i,j).R2
 *   These are in different columns, so we need:
 *     1. Vertical relay in col j: PE(i,j) reads down to get PE(j,j)'s relay of PE(j,i)'s value
 *     Actually this still requires horizontal communication first.
 *
 * REVISED APPROACH - using horizontal-first, then vertical:
 * For each source row r:
 *   Cycle A: All PEs in row r broadcast R2 → ROUT (horizontal availability)
 *   Cycle B: For each c != r: PE(r,r) reads value from PE(r,c) via horizontal relay to column r
 *            Then PE(r,r) has the value that needs to go to PE(c,r)
 *   This still requires multiple hops...
 *
 * SIMPLEST CORRECT APPROACH:
 * Use the fact that all PEs have unique positions. Do it in 4 phases (one per column):
 *
 * For column c:
 *   Step 1: All PEs in column c broadcast their R2 to ROUT
 *   Step 2: Row c reads from the PEs in column c via RCT/RCB
 *
 * But PEs in column c are at (0,c), (1,c), (2,c), (3,c) and their values
 * need to go to (c,0), (c,1), (c,2), (c,3) respectively.
 * PE(r,c).R2 → PE(c,r).reg
 *
 * Column c's PEs are all in the same column, so they can communicate vertically.
 * The destination PEs are all in row c. To get values from column c to row c,
 * we need BOTH vertical and horizontal movement.
 *
 * ACTUAL IMPLEMENTATION - direct pair swaps using R2 (original) and R3 (temp relay):
 *
 * Phase 0: Save reg to R2 for all PEs
 * Phase 1-6: For each swap pair (i,j)↔(j,i) where i<j:
 *   - Move PE(i,j).R2 to PE(j,i).reg via vertical relay in column j, then horizontal
 *   - Move PE(j,i).R2 to PE(i,j).reg via vertical relay in column i, then horizontal
 *
 * This is too many cycles. Let's use a BULK approach instead:
 *
 * FINAL APPROACH - row-based transposition in 3 phases:
 *
 * Phase 0 (1 cycle): All PEs: R2 = reg (save original)
 * Phase 1 (2 cycles per row): For each row r = 0..3:
 *   Cycle A: All PEs in row r broadcast R2 to ROUT
 *   Cycle B: PE(c,r) reads from PE(r,r) horizontally for each c
 *            But PE(r,c).ROUT only reaches PE(r,c±1) not PE(c,r)...
 *
 * OK, let me just implement this with the minimum number of cycles using
 * explicit point-to-point movement. For a 4x4 grid this is finite and manageable.
 *
 * CONCRETE ALGORITHM:
 * We'll use R2 to preserve originals and R3 as relay temp.
 * Total: ~10 cycles
 *
 * Cycle 0: ALL PEs: R2 = reg, R3 = reg (save originals, broadcast to ROUT)
 *
 * For distance-1 swaps (adjacent rows), we can do all 3 in parallel:
 * Cycle 1: Broadcast step - specific PEs in the swap pairs broadcast ROUT
 *   @0,1: SADD ROUT, R2, ZERO  (PE(0,1) sends its value, ROUT available to PE(1,1) via RCT)
 *   @1,0: SADD ROUT, R2, ZERO  (PE(1,0) sends its value, ROUT available to PE(0,0) via RCB)
 *   @1,2: SADD ROUT, R2, ZERO  (PE(1,2) sends)
 *   @2,1: SADD ROUT, R2, ZERO  (PE(2,1) sends)
 *   @2,3: SADD ROUT, R2, ZERO  (PE(2,3) sends)
 *   @3,2: SADD ROUT, R2, ZERO  (PE(3,2) sends)
 *
 * But wait — RCT reads from the PE ABOVE in the SAME COLUMN. So PE(1,1) reads
 * PE(0,1).ROUT via RCT. We need PE(1,0) to get PE(0,1).ROUT, but PE(1,0)'s
 * RCT reads PE(0,0).ROUT, which is wrong.
 *
 * The fundamental issue: RCT/RCB/RCL/RCR only communicate with SAME-ROW or
 * SAME-COLUMN neighbors. To move a value from PE(0,1) to PE(1,0) we need:
 *   Step 1: PE(0,1) → ROUT
 *   Step 2: PE(1,1) reads RCT (gets PE(0,1).ROUT) → R3, then ROUT
 *   Step 3: PE(1,0) reads RCR (gets PE(1,1).ROUT) → reg
 *
 * So each swap requires vertical relay + horizontal relay = 2+ extra cycles.
 * For efficiency, we can batch: first do all vertical movements, then horizontal.
 *
 * BATCH ALGORITHM:
 *
 * Cycle 0: All PEs save: R2 = reg (original values preserved)
 *
 * For column c = 0..3, the values PE(0,c), PE(1,c), PE(2,c), PE(3,c) need to
 * be rearranged so that PE(r,c).R2 ends up at PE(c,r).reg.
 * Within column c, PE(r,c).R2 needs to go to row c in column c first (vertical),
 * then from PE(c,c) it needs horizontal relay to PE(c,r).
 *
 * But PE(c,c) can only hold one value at a time, so we can't pipeline through it.
 *
 * PRAGMATIC APPROACH: Just handle each column's scatter sequentially.
 * For each source column c:
 *   The 4 values at PE(0,c)..PE(3,c) need to reach PE(c,0)..PE(c,3).
 *   PE(c,c) already has the right value (diagonal).
 *   For r != c: PE(r,c).R2 needs to reach PE(c,r).reg.
 *
 * Processing column c:
 *   Sub-step V: Move values vertically within col c to row c
 *     PE(r,c) broadcasts R2 → ROUT
 *     Relay through intermediate PEs until PE(c,c) has all values
 *   Sub-step H: PE(c,c) distributes values horizontally to PE(c,r) for each r
 *
 * This is still complex. For a thesis tool, let me just generate the specific
 * cycle instructions for a 4x4 grid directly. It's a fixed 4x4 size.
 */
export function generateTransposeTokens(params: TransposeParams): Token[] {
  const { reg, line } = params;
  const tokens: Token[] = [];

  // We use R2 for saved originals and R3 as temp/relay
  const TEMP = 'R2';
  const RELAY = 'R3';

  // Phase 0: All PEs save their original value
  // cycle { @r,c: SADD R2, reg, ZERO; ... for all 16 PEs }
  {
    const instrs: Token[][] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        instrs.push(peInstr(r, c, 'SADD', TEMP, reg, 'ZERO', line));
      }
    }
    tokens.push(...makeCycle(instrs, line));
  }

  // Now we need to implement the transpose.
  // For each swap pair (i,j) ↔ (j,i) where i < j:
  //   PE(i,j) needs PE(j,i).R2 and PE(j,i) needs PE(i,j).R2
  //
  // Route: PE(a,b).R2 → PE(b,a).reg requires:
  //   1. Vertical movement from row a to row b (in column b): |a-b| hops
  //   2. Horizontal movement from column b to column a (in row b): |b-a| hops
  //   But |a-b| = |b-a| = distance.
  //
  // To minimize cycles, process by distance and batch all same-distance swaps.
  //
  // For each swap, we route BOTH directions simultaneously using different columns.
  // PE(i,j).R2 travels down col j to row j, then left/right to col i → PE(j,i)
  // PE(j,i).R2 travels down col i to row i, then left/right to col j → PE(i,j)
  //
  // Since these use different columns for the vertical phase, they don't conflict.

  // Define all swap pairs grouped by vertical distance
  const swapPairs = [
    // Distance 1: (0,1)↔(1,0), (1,2)↔(2,1), (2,3)↔(3,2)
    { i: 0, j: 1 },
    { i: 1, j: 2 },
    { i: 2, j: 3 },
    // Distance 2: (0,2)↔(2,0), (1,3)↔(3,1)
    { i: 0, j: 2 },
    { i: 1, j: 3 },
    // Distance 3: (0,3)↔(3,0)
    { i: 0, j: 3 },
  ];

  // Group by distance
  const byDistance: Map<number, Array<{i: number, j: number}>> = new Map();
  for (const pair of swapPairs) {
    const dist = pair.j - pair.i;
    if (!byDistance.has(dist)) byDistance.set(dist, []);
    byDistance.get(dist)!.push(pair);
  }

  // Process each distance group
  for (const [dist, pairs] of byDistance) {
    // For distance d, we need:
    // 1. Broadcast: source PEs send R2 to ROUT
    // 2. d-1 relay cycles (vertical)
    // 3. Final vertical receive
    // 4. d-1 horizontal relay cycles (if d > 1)
    // 5. Final horizontal receive and store to reg
    //
    // For distance 1:
    //   Cycle A: PE(i,j) and PE(j,i) broadcast R2 → ROUT
    //   Cycle B: PE(j,j) reads RCT→R3 (gets PE(i,j).R2), PE(i,i) reads RCB→R3 (gets PE(j,i).R2)
    //            PE(j,j) and PE(i,i) also broadcast R3 → ROUT for horizontal phase
    //   Note: But ROUT is implicit, so SADD R3, RCT, ZERO already puts result in ROUT
    //   Cycle C: PE(j,i) reads from PE(j,j) horizontally (RCR or RCL), stores to reg
    //            PE(i,j) reads from PE(i,i) horizontally (RCL or RCR), stores to reg
    //
    // For distance 1, total: 3 cycles per group
    // For distance 2: 5 cycles (broadcast, relay-v, receive-v, relay-h, receive-h)
    // For distance 3: uses toroidal wrap (dist 3 = dist 1 via wraparound going up)

    for (const { i, j } of pairs) {
      // Generate swap for PE(i,j) ↔ PE(j,i)
      tokens.push(...generateSwapTokens(i, j, reg, TEMP, RELAY, line));
    }
  }

  return tokens;
}

/**
 * Generates tokens to swap values between PE(i,j) and PE(j,i).
 * Uses R2 (saved originals) and R3 (relay temp).
 *
 * Route A: PE(i,j).R2 → PE(j,i).reg
 *   Path: PE(i,j) → vertical to PE(j,j) → horizontal to PE(j,i)
 *
 * Route B: PE(j,i).R2 → PE(i,j).reg
 *   Path: PE(j,i) → vertical to PE(i,i) → horizontal to PE(i,j)
 */
function generateSwapTokens(
  i: number, j: number,
  reg: string, temp: string, relay: string,
  line: number
): Token[] {
  const tokens: Token[] = [];
  const vDist = j - i; // vertical distance (always positive since i < j)
  const hDist = j - i; // horizontal distance (same as vertical for transpose)

  // ---- Vertical phase ----
  // Route A: PE(i,j) → down through col j → PE(j,j)
  // Route B: PE(j,i) → up through col i → PE(i,i)

  // Cycle V0: Source PEs broadcast R2 to ROUT
  {
    const instrs: Token[][] = [];
    instrs.push(peInstr(i, j, 'SADD', 'ROUT', temp, 'ZERO', line)); // Route A source
    instrs.push(peInstr(j, i, 'SADD', 'ROUT', temp, 'ZERO', line)); // Route B source
    tokens.push(...makeCycle(instrs, line));
  }

  // Vertical relay cycles (vDist - 1 intermediate hops)
  for (let step = 1; step < vDist; step++) {
    const instrs: Token[][] = [];
    // Route A: relay down col j, row i+step reads RCT and forwards
    const relayRowA = i + step;
    instrs.push(peInstr(relayRowA, j, 'SADD', relay, 'RCT', 'ZERO', line));

    // Route B: relay up col i, row j-step reads RCB and forwards
    const relayRowB = j - step;
    instrs.push(peInstr(relayRowB, i, 'SADD', relay, 'RCB', 'ZERO', line));

    tokens.push(...makeCycle(instrs, line));
  }

  // Final vertical receive: PE(j,j) and PE(i,i) get the values
  {
    const instrs: Token[][] = [];
    // Route A: PE(j,j) reads from above (RCT) — gets PE(i,j).R2
    instrs.push(peInstr(j, j, 'SADD', relay, 'RCT', 'ZERO', line));
    // Route B: PE(i,i) reads from below (RCB) — gets PE(j,i).R2
    instrs.push(peInstr(i, i, 'SADD', relay, 'RCB', 'ZERO', line));
    tokens.push(...makeCycle(instrs, line));
  }

  // ---- Horizontal phase ----
  // Route A: PE(j,j).R3 → left through row j → PE(j,i)
  // Route B: PE(i,i).R3 → right through row i → PE(i,j)

  // Horizontal relay cycles (hDist - 1 intermediate hops)
  for (let step = 1; step < hDist; step++) {
    const instrs: Token[][] = [];
    // Route A: relay left in row j, col j-step reads RCR (from right neighbor)
    const relayColA = j - step;
    instrs.push(peInstr(j, relayColA, 'SADD', relay, 'RCR', 'ZERO', line));

    // Route B: relay right in row i, col i+step reads RCL (from left neighbor)
    const relayColB = i + step;
    instrs.push(peInstr(i, relayColB, 'SADD', relay, 'RCL', 'ZERO', line));

    tokens.push(...makeCycle(instrs, line));
  }

  // Final horizontal receive: PE(j,i) and PE(i,j) get their transposed values
  {
    const instrs: Token[][] = [];
    // Route A: PE(j,i) reads from right (RCR) — gets PE(i,j).R2 (the transposed value)
    instrs.push(peInstr(j, i, 'SADD', reg, 'RCR', 'ZERO', line));
    // Route B: PE(i,j) reads from left (RCL) — gets PE(j,i).R2 (the transposed value)
    instrs.push(peInstr(i, j, 'SADD', reg, 'RCL', 'ZERO', line));
    tokens.push(...makeCycle(instrs, line));
  }

  return tokens;
}

/**
 * Parses #pragma transpose arguments.
 * Syntax: #pragma transpose(reg=R0)
 */
export function parseTransposePragmaArgs(stream: import('./token-stream').TokenStream): {
  reg: string;
} | null {
  if (!stream.match(TokenType.OPERATOR, '(')) {
    return null;
  }

  // Parse reg=REG
  const regKey = stream.expect(TokenType.IDENTIFIER).value.toLowerCase();
  if (regKey !== 'reg') {
    throw new Error(`Expected 'reg' but got '${regKey}'`);
  }
  stream.expect(TokenType.OPERATOR, '=');
  const reg = stream.expect(TokenType.IDENTIFIER).value.toUpperCase();

  stream.expect(TokenType.OPERATOR, ')');

  return { reg };
}
