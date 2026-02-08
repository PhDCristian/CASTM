/**
 * OpenEdge-DSL Auto-Cycle Desugarer
 *
 * Token-level pass that automatically inserts cycle { } boundaries
 * within #pragma auto_cycle ... #pragma end_auto_cycle regions.
 *
 * Grouping rule:
 * - Instructions with distinct PE coordinates go in the same cycle
 * - When a coordinate conflicts (same PE already in current group), a new cycle starts
 * - 'all:' and 'row N:' instructions occupy all PEs in their scope,
 *   so they always get their own cycle
 *
 * Example:
 *   #pragma auto_cycle
 *   @0,0: LWI R0, A[0];
 *   @0,1: LWI R0, A[1];    // same cycle (no conflict)
 *   @0,0: LWI R1, B[0];    // new cycle (@0,0 already used)
 *   @0,1: LWI R1, B[1];    // same cycle as previous
 *   all: SMUL R2, R0, R1;  // new cycle (all PEs)
 *   #pragma end_auto_cycle
 *
 * Becomes:
 *   cycle { @0,0: LWI R0, A[0]; @0,1: LWI R0, A[1]; }
 *   cycle { @0,0: LWI R1, B[0]; @0,1: LWI R1, B[1]; }
 *   cycle { all: SMUL R2, R0, R1; }
 */

import { Token, TokenType } from '../types/tokens';

/**
 * Creates a synthetic token with the same line/column as a reference token.
 */
function synth(type: TokenType, value: string, ref: Token): Token {
  return { type, value, line: ref.line, column: ref.column };
}

/**
 * Determines what PE coordinates an instruction prefix occupies.
 * Returns null if the token sequence at `pos` is not an instruction prefix.
 *
 * Recognized prefixes:
 * - @row,col:  → single PE
 * - row N:     → 4 PEs (entire row, with or without pipes)
 * - all:       → 16 PEs
 * - col N:     → 4 PEs (entire column)
 */
function detectPrefix(tokens: Token[], pos: number): {
  kind: 'at' | 'row' | 'all' | 'col';
  occupiedPEs: string[];    // list of "r,c" strings
  prefixLength: number;     // number of tokens consumed by the prefix
} | null {
  if (pos >= tokens.length) return null;

  const t = tokens[pos];

  // @row,col:
  if (t.type === TokenType.AT_SYMBOL) {
    if (pos + 4 >= tokens.length) return null;
    const rowTok = tokens[pos + 1];
    const comma = tokens[pos + 2];
    const colTok = tokens[pos + 3];
    const colon = tokens[pos + 4];
    if (rowTok.type === TokenType.NUMBER &&
        comma.type === TokenType.OPERATOR && comma.value === ',' &&
        colTok.type === TokenType.NUMBER &&
        colon.type === TokenType.OPERATOR && colon.value === ':') {
      return {
        kind: 'at',
        occupiedPEs: [`${rowTok.value},${colTok.value}`],
        prefixLength: 5  // @ row , col :
      };
    }
    return null;
  }

  // all:
  if (t.type === TokenType.IDENTIFIER && t.value.toLowerCase() === 'all') {
    if (pos + 1 < tokens.length &&
        tokens[pos + 1].type === TokenType.OPERATOR &&
        tokens[pos + 1].value === ':') {
      const pes: string[] = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          pes.push(`${r},${c}`);
        }
      }
      return { kind: 'all', occupiedPEs: pes, prefixLength: 2 };
    }
    return null;
  }

  // row N: or col N:
  if (t.type === TokenType.KEYWORD &&
      (t.value.toLowerCase() === 'row' || t.value.toLowerCase() === 'col')) {
    if (pos + 2 < tokens.length &&
        tokens[pos + 1].type === TokenType.NUMBER &&
        tokens[pos + 2].type === TokenType.OPERATOR &&
        tokens[pos + 2].value === ':') {
      const n = parseInt(tokens[pos + 1].value, 10);
      const pes: string[] = [];
      if (t.value.toLowerCase() === 'row') {
        for (let c = 0; c < 4; c++) pes.push(`${n},${c}`);
      } else {
        for (let r = 0; r < 4; r++) pes.push(`${r},${n}`);
      }
      return { kind: t.value.toLowerCase() as 'row' | 'col', occupiedPEs: pes, prefixLength: 3 };
    }
    return null;
  }

  return null;
}

/**
 * Finds the end of an instruction (the semicolon).
 * Returns the position of the semicolon, or -1 if not found.
 */
function findSemicolon(tokens: Token[], start: number): number {
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].type === TokenType.SEMICOLON) {
      return i;
    }
  }
  return -1;
}

/**
 * Processes a single auto_cycle region, inserting cycle { } wrappers.
 */
function processRegion(tokens: Token[], start: number, end: number): Token[] {
  const result: Token[] = [];
  let pos = start;

  // Current cycle accumulator
  let currentCycleTokens: Token[] = [];
  let occupiedInCycle = new Set<string>();

  function flushCycle() {
    if (currentCycleTokens.length === 0) return;
    // Get a reference token for line info
    const ref = currentCycleTokens[0];
    result.push(synth(TokenType.KEYWORD, 'cycle', ref));
    result.push(synth(TokenType.BRACE_OPEN, '{', ref));
    result.push(...currentCycleTokens);
    result.push(synth(TokenType.BRACE_CLOSE, '}', ref));
    currentCycleTokens = [];
    occupiedInCycle = new Set();
  }

  while (pos < end) {
    // Skip whitespace-like tokens (newlines etc. are already filtered by tokenizer)
    const prefix = detectPrefix(tokens, pos);

    if (!prefix) {
      // Not an instruction prefix — could be a pragma or other construct.
      // Flush current cycle and pass through as-is until next prefix or end.
      flushCycle();

      // Find next instruction prefix or end
      let nextPos = pos;
      while (nextPos < end && !detectPrefix(tokens, nextPos)) {
        nextPos++;
      }
      // Copy non-instruction tokens through
      for (let i = pos; i < nextPos; i++) {
        result.push(tokens[i]);
      }
      pos = nextPos;
      continue;
    }

    // Check for PE conflicts
    const hasConflict = prefix.occupiedPEs.some(pe => occupiedInCycle.has(pe));

    if (hasConflict) {
      // Flush current cycle, start new one
      flushCycle();
    }

    // Find the semicolon that ends this instruction
    const semiPos = findSemicolon(tokens, pos);
    if (semiPos < 0) {
      // No semicolon found — error, just push remaining and break
      for (let i = pos; i < end; i++) {
        currentCycleTokens.push(tokens[i]);
      }
      break;
    }

    // Add prefix PEs to occupied set
    for (const pe of prefix.occupiedPEs) {
      occupiedInCycle.add(pe);
    }

    // Add all tokens from prefix through semicolon to current cycle
    for (let i = pos; i <= semiPos; i++) {
      currentCycleTokens.push(tokens[i]);
    }

    pos = semiPos + 1;
  }

  // Flush any remaining cycle
  flushCycle();

  return result;
}

/**
 * Main entry point: desugar auto_cycle regions in the token stream.
 *
 * Finds #pragma auto_cycle ... #pragma end_auto_cycle regions
 * and wraps instructions in cycle { } blocks based on PE coordination conflicts.
 */
export function desugarAutoCycle(tokens: Token[]): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];

    // Detect #pragma auto_cycle
    if (t.type === TokenType.PRAGMA && t.value.toLowerCase() === 'auto_cycle') {
      // Skip the pragma token
      i++;

      // Find matching #pragma end_auto_cycle
      let endPos = -1;
      for (let j = i; j < tokens.length; j++) {
        if (tokens[j].type === TokenType.PRAGMA &&
            tokens[j].value.toLowerCase() === 'end_auto_cycle') {
          endPos = j;
          break;
        }
      }

      if (endPos < 0) {
        throw {
          message: `#pragma auto_cycle without matching #pragma end_auto_cycle`,
          line: t.line
        };
      }

      // Process the region between auto_cycle and end_auto_cycle
      const processed = processRegion(tokens, i, endPos);
      result.push(...processed);

      // Skip past end_auto_cycle
      i = endPos + 1;
      continue;
    }

    // Not in auto_cycle region — pass through
    result.push(t);
    i++;
  }

  return result;
}
