import {
  StructuredFnCallStmtAst
} from '@openedge/compiler-ir';
import { splitTopLevel } from '../../parser-utils/strings.js';
import { ADVANCED_NAMES, RESERVED_KEYWORDS } from '../constants.js';
import { spanAt } from '../utils.js';

export function shouldSkipStructuredLine(cleanLine: string): boolean {
  return (
    /^config\s*\(/i.test(cleanLine) ||
    /^let\s+/i.test(cleanLine) ||
    /^\.(io_load|io_store|limit|assert)\b/i.test(cleanLine)
  );
}

export interface ParsedAdvancedStatement {
  name: string;
  args: string;
  text: string;
}

export function parseAdvancedStatement(cleanLine: string): ParsedAdvancedStatement | null {
  const match = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.+)\)\s*;?\s*$/);
  if (!match) return null;
  const name = match[1].toLowerCase();
  if (!ADVANCED_NAMES.has(name)) return null;
  const args = match[2].trim();
  return {
    name,
    args,
    text: `${name}(${args})`
  };
}

export function parseFunctionCall(cleanLine: string): StructuredFnCallStmtAst | null {
  const match = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*;?\s*$/);
  if (!match) return null;

  const name = match[1];
  const lower = name.toLowerCase();
  if (RESERVED_KEYWORDS.has(lower) || ADVANCED_NAMES.has(lower)) return null;

  const argsText = match[2].trim();
  const args = argsText.length === 0 ? [] : splitTopLevel(argsText, ',');

  return {
    kind: 'fn-call',
    name,
    args,
    span: spanAt(1, cleanLine.length)
  };
}
