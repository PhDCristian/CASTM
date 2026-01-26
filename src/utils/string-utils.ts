/**
 * OpenEdge-DSL String Utilities
 *
 * Helper functions for string manipulation during compilation.
 */

/**
 * Extracts a numeric value from a token string, handling:
 * - Plain numbers: "3" → 3
 * - IMM wrappers: "IMM(5)" → 5
 * - Hex numbers: "0x10" → 16
 * - Negative numbers: "-5" → -5
 *
 * @param token The token string to parse
 * @returns The numeric value
 * @throws Error if the token cannot be parsed as a number
 */
export function extractNumericValue(token: string): number {
  // Handle IMM(value) wrapper - from for loop variable substitution
  const immMatch = token.match(/^IMM\((-?\d+)\)$/i);
  if (immMatch) {
    return parseInt(immMatch[1], 10);
  }

  // Handle plain number or hex
  const val = parseInt(token, token.startsWith('0x') ? 16 : 10);
  if (isNaN(val)) {
    throw new Error(`Invalid numeric value: ${token}`);
  }
  return val;
}

/**
 * Checks if a string represents a valid number (decimal or hex)
 */
export function isNumericString(str: string): boolean {
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return /^0[xX][0-9a-fA-F]+$/.test(str);
  }
  return /^-?\d+$/.test(str);
}

/**
 * Checks if a string is an IMM() wrapper
 */
export function isImmWrapper(str: string): boolean {
  return /^IMM\(-?\d+\)$/i.test(str);
}

/**
 * Extracts the value from an IMM() wrapper, returns null if not an IMM wrapper
 */
export function extractImmValue(str: string): number | null {
  const match = str.match(/^IMM\((-?\d+)\)$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Wraps a numeric value in an IMM() wrapper
 */
export function wrapInImm(value: number): string {
  return `IMM(${value})`;
}

/**
 * Checks if a string is a valid DSL register name
 */
export function isRegister(str: string): boolean {
  const upper = str.toUpperCase();
  return /^R[0-3]$/.test(upper) || upper === 'ROUT';
}

/**
 * Checks if a string is a valid neighbor reference
 */
export function isNeighborRef(str: string): boolean {
  const upper = str.toUpperCase();
  return ['SELF', 'RCL', 'RCR', 'RCT', 'RCB', 'ZERO'].includes(upper);
}

/**
 * Checks if a string is a data array reference (data[index] or name[index])
 */
export function isArrayReference(str: string): boolean {
  return /^\w+\[\d+\]$/.test(str) || /^\w+\[[a-zA-Z_]\w*\]$/.test(str);
}

/**
 * Parses an array reference into name and index
 * @returns Object with arrayName and index, or null if not a valid reference
 */
export function parseArrayReference(str: string): { arrayName: string; index: string } | null {
  const match = str.match(/^(\w+)\[([^\]]+)\]$/);
  if (match) {
    return { arrayName: match[1], index: match[2] };
  }
  return null;
}

/**
 * Escapes special characters in a string for use in regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits a string by whitespace while respecting quoted strings
 */
export function splitRespectingQuotes(str: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (/\s/.test(char) && !inQuotes) {
      if (current) {
        result.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * Normalizes whitespace in a string (collapses multiple spaces to one)
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Checks if a character is a valid identifier start character
 */
export function isIdentifierStart(char: string): boolean {
  return /[a-zA-Z_]/.test(char);
}

/**
 * Checks if a character is a valid identifier continuation character
 */
export function isIdentifierPart(char: string): boolean {
  return /[a-zA-Z0-9_]/.test(char);
}
