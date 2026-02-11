import {
  AstProgram,
  SourceSpan
} from '@openedge/compiler-ir';
import { parseNumericLiteral } from './numbers.js';

interface AssertionFieldTokens {
  cycleText?: string;
  rowText: string;
  colText: string;
  registerText: string;
  valueText: string;
}

export interface ParsedAssertionPayload {
  cycle: number;
  row: number;
  col: number;
  register: string;
  value: number;
}

export interface AssertionParseFailure {
  message: string;
  hint: string;
}

function inferDefaultAssertionCycle(ast: AstProgram, span: SourceSpan): number {
  const cycles = ast.kernel?.cycles ?? [];
  if (cycles.length === 0) return 0;

  let lastBeforeSpan: number | null = null;
  for (const cycle of cycles) {
    if (cycle.span.startLine <= span.startLine) {
      if (lastBeforeSpan === null || cycle.index > lastBeforeSpan) {
        lastBeforeSpan = cycle.index;
      }
    }
  }

  if (lastBeforeSpan !== null) return lastBeforeSpan;
  return cycles[cycles.length - 1].index;
}

function parseAssertionTokens(rawValue: string): AssertionFieldTokens | null {
  const shorthand = rawValue.match(
    /^\.assert\s+(?:cycle\s*=\s*([^\s]+)\s+)?@\s*([^,:\s]+)\s*,\s*([^:\s]+)\s*:?\s*([A-Za-z_][A-Za-z0-9_]*)\s*==\s*(.+)\s*$/i
  );
  if (shorthand) {
    return {
      cycleText: shorthand[1]?.trim(),
      rowText: shorthand[2].trim(),
      colText: shorthand[3].trim(),
      registerText: shorthand[4].trim(),
      valueText: shorthand[5].trim()
    };
  }

  const object = rawValue.match(/^\.assert\s*\{([\s\S]*)\}\s*$/i);
  if (!object) return null;

  const body = object[1];
  const cycleMatch = body.match(/\bcycle\s*:\s*([^,}]+)/i);
  const locationMatch = body.match(/\blocation\s*:\s*([^,}]+)\s*,\s*([^,}]+)/i);
  const registerMatch = body.match(/\bregister\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/i);
  const valueMatch = body.match(/\bvalue\s*:\s*([^,}]+)/i);
  if (!locationMatch || !registerMatch || !valueMatch) return null;

  return {
    cycleText: cycleMatch?.[1]?.trim(),
    rowText: locationMatch[1].trim().replace(/^@/, ''),
    colText: locationMatch[2].trim(),
    registerText: registerMatch[1].trim(),
    valueText: valueMatch[1].trim()
  };
}

export function parseAssertionDirectiveValue(
  ast: AstProgram,
  directiveSpan: SourceSpan,
  rawValue: string
): ParsedAssertionPayload | AssertionParseFailure {
  const tokens = parseAssertionTokens(rawValue);
  if (!tokens) {
    return {
      message: `Invalid .assert directive payload '${rawValue}'.`,
      hint: 'Expected `.assert cycle=0 @0,0 R1 == 42` or `.assert { cycle: 0, location: 0,0, register: R1, value: 42 }`.'
    };
  }

  const row = parseNumericLiteral(tokens.rowText);
  if (row === null || !Number.isInteger(row) || row < 0) {
    return {
      message: `Invalid .assert row '${tokens.rowText}'.`,
      hint: 'Row must be a non-negative integer.'
    };
  }

  const col = parseNumericLiteral(tokens.colText);
  if (col === null || !Number.isInteger(col) || col < 0) {
    return {
      message: `Invalid .assert column '${tokens.colText}'.`,
      hint: 'Column must be a non-negative integer.'
    };
  }

  let cycle: number;
  if (tokens.cycleText) {
    const parsedCycle = parseNumericLiteral(tokens.cycleText);
    if (parsedCycle === null || !Number.isInteger(parsedCycle) || parsedCycle < 0) {
      return {
        message: `Invalid .assert cycle '${tokens.cycleText}'.`,
        hint: 'Cycle must be a non-negative integer.'
      };
    }
    cycle = parsedCycle;
  } else {
    cycle = inferDefaultAssertionCycle(ast, directiveSpan);
  }

  const value = parseNumericLiteral(tokens.valueText);
  if (value === null || !Number.isInteger(value)) {
    return {
      message: `Invalid .assert value '${tokens.valueText}'.`,
      hint: 'Assertion value must be an integer literal (decimal or hex).'
    };
  }

  return {
    cycle,
    row,
    col,
    register: tokens.registerText,
    value
  };
}
