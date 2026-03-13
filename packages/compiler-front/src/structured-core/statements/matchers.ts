import {
  StructuredFnCallStmtAst
} from '@castm/compiler-ir';
import { splitTopLevel } from '../parser-utils/strings.js';
import { ADVANCED_NAMES, RESERVED_KEYWORDS } from '../constants.js';
import { spanAt } from '../utils.js';
import { parseAdvancedNamespaceIssue, parseStandardAdvancedCall } from '../advanced.js';

export function shouldSkipStructuredLine(cleanLine: string): boolean {
  return (
    /^config\s*\(/i.test(cleanLine) ||
    /^let\s+/i.test(cleanLine) ||
    /^io\.(load|store)\s*\(/i.test(cleanLine) ||
    /^limit\s*\(/i.test(cleanLine) ||
    /^assert\s*\(/i.test(cleanLine)
  );
}

export interface ParsedAdvancedStatement {
  name: string;
  args: string;
  text: string;
  sourceForm: 'qualified' | 'unqualified';
  namespace: 'std' | null;
}

export interface ParsedPipelineCall {
  name: string;
  args: string[];
}

export function parseAdvancedStatement(cleanLine: string): ParsedAdvancedStatement | null {
  const parsed = parseStandardAdvancedCall(cleanLine);
  if (!parsed) return null;

  return {
    name: parsed.name,
    args: parsed.args,
    text: parsed.text,
    sourceForm: parsed.sourceForm,
    namespace: parsed.namespace
  };
}

export { parseAdvancedNamespaceIssue };

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

export function parsePipelineCallSequence(cleanLine: string): ParsedPipelineCall[] | null | undefined {
  const match = cleanLine.match(/^pipeline\s*\((.*)\)\s*;?\s*$/i);
  if (!match) return undefined;

  const body = match[1].trim();
  if (!body) return null;

  const parts = splitTopLevel(body, ',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const calls: ParsedPipelineCall[] = [];
  for (const part of parts) {
    const callMatch = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/);
    if (!callMatch) return null;

    const name = callMatch[1];
    const lower = name.toLowerCase();
    if (lower === 'pipeline' || RESERVED_KEYWORDS.has(lower) || ADVANCED_NAMES.has(lower)) return null;

    const argsText = callMatch[2].trim();
    const args = argsText.length === 0 ? [] : splitTopLevel(argsText, ',');
    calls.push({ name, args });
  }

  return calls;
}
