import {
  AstProgram,
  SourceSpan
} from '@castm/compiler-ir';
import { parseNumericLiteral } from './numbers.js';

function splitTopLevel(text: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depthParen += 1;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace += 1;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);

    if (
      ch === delimiter
      && depthParen === 0
      && depthBracket === 0
      && depthBrace === 0
    ) {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

interface AssertionFieldTokens {
  bundleText?: string;
  rowText: string;
  colText: string;
  registerText: string;
  valueText: string;
}

export interface ParsedAssertionPayload {
  bundle: number;
  row: number;
  col: number;
  register: string;
  value: number;
}

export interface AssertionParseFailure {
  message: string;
  hint: string;
}

function inferDefaultAssertionBundle(ast: AstProgram, span: SourceSpan): number {
  const bundles = ast.kernel?.cycles ?? [];
  if (bundles.length === 0) return 0;

  let lastBeforeSpan: number | null = null;
  for (const bundle of bundles) {
    if (bundle.span.startLine <= span.startLine) {
      if (lastBeforeSpan === null || bundle.index > lastBeforeSpan) {
        lastBeforeSpan = bundle.index;
      }
    }
  }

  if (lastBeforeSpan !== null) return lastBeforeSpan;
  return bundles[bundles.length - 1].index;
}

function parseAssertionTokens(rawValue: string): AssertionFieldTokens | AssertionParseFailure {
  const call = rawValue.match(/^assert\s*\(([\s\S]*)\)\s*;?\s*$/i);
  if (!call) {
    return {
      message: `Invalid assert(...) payload '${rawValue}'.`,
      hint: 'Expected `assert(at=@0,0, reg=R1, equals=42)`.'
    };
  }

  const body = call[1].trim();
  const atMatch = body.match(/\bat\s*=\s*@\s*([^,\s]+)\s*,\s*([^\s,]+)\s*/i);
  if (!atMatch) {
    return {
      message: `Invalid assert(...) payload '${rawValue}'.`,
      hint: 'Expected `assert(at=@0,0, reg=R1, equals=42)`.'
    };
  }

  const remaining = body
    .replace(atMatch[0], '')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '');
  const kvPairs = remaining.length > 0
    ? splitTopLevel(remaining, ',').map((part) => part.trim()).filter(Boolean)
    : [];

  const args = new Map<string, string>();
  for (const pair of kvPairs) {
    const kv = pair.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!kv) {
      return {
        message: `Invalid assert argument '${pair}'.`,
        hint: 'Expected named arguments: reg=..., equals=..., optional bundle=...'
      };
    }

    const name = kv[1].toLowerCase();
    if (name !== 'reg' && name !== 'equals' && name !== 'bundle') {
      return {
        message: `Unsupported assert argument '${kv[1]}'.`,
        hint: 'Use current assert arguments: at, reg, equals, and optional bundle.'
      };
    }
    args.set(name, kv[2].trim());
  }

  const registerText = args.get('reg');
  const valueText = args.get('equals');
  if (!registerText || !valueText) {
    return {
      message: `Invalid assert(...) payload '${rawValue}'.`,
      hint: 'Expected `assert(at=@0,0, reg=R1, equals=42)`.'
    };
  }

  return {
    bundleText: args.get('bundle'),
    rowText: atMatch[1].trim(),
    colText: atMatch[2].trim(),
    registerText,
    valueText
  };
}

export function parseAssertionDirectiveValue(
  ast: AstProgram,
  directiveSpan: SourceSpan,
  rawValue: string
): ParsedAssertionPayload | AssertionParseFailure {
  const tokens = parseAssertionTokens(rawValue);
  if ('message' in tokens) return tokens;

  const row = parseNumericLiteral(tokens.rowText);
  if (row === null || !Number.isInteger(row) || row < 0) {
    return {
      message: `Invalid assert row '${tokens.rowText}'.`,
      hint: 'Row must be a non-negative integer.'
    };
  }

  const col = parseNumericLiteral(tokens.colText);
  if (col === null || !Number.isInteger(col) || col < 0) {
    return {
      message: `Invalid assert column '${tokens.colText}'.`,
      hint: 'Column must be a non-negative integer.'
    };
  }

  let bundle: number;
  if (tokens.bundleText) {
    const parsedBundle = parseNumericLiteral(tokens.bundleText);
    if (parsedBundle === null || !Number.isInteger(parsedBundle) || parsedBundle < 0) {
      return {
        message: `Invalid assert bundle '${tokens.bundleText}'.`,
        hint: 'Bundle must be a non-negative integer.'
      };
    }
    bundle = parsedBundle;
  } else {
    bundle = inferDefaultAssertionBundle(ast, directiveSpan);
  }

  const value = parseNumericLiteral(tokens.valueText);
  if (value === null || !Number.isInteger(value)) {
    return {
      message: `Invalid assert value '${tokens.valueText}'.`,
      hint: 'Assertion value must be an integer literal (decimal or hex).'
    };
  }

  return {
    bundle,
    row,
    col,
    register: tokens.registerText,
    value
  };
}
