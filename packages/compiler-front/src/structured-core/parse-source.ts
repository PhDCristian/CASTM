import {
  Diagnostic,
  ErrorCodes,
  makeDiagnostic,
  SourceSpan,
  StructuredFunctionDefAst,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from './parser-utils/blocks.js';
import { stripLineComment } from './parser-utils/strings.js';
import { parseDirective } from './lowering/declarations.js';
import { parseFunctionHeader, parseFunctionParams } from './lowering/functions.js';
import { parseStructuredStatements } from './statements.js';
import { parseInteger, spanAt } from './utils.js';
import { parseProgramHeadersFromTokens } from './token-stream.js';

export interface StructuredProgramParseResult {
  program: StructuredProgramAst;
  diagnostics: Diagnostic[];
}

function computeProgramSpan(lines: string[]): SourceSpan {
  return {
    startLine: 1,
    startColumn: 1,
    endLine: lines.length,
    endColumn: (lines[lines.length - 1] ?? '').length + 1
  };
}

function computeKernelSpan(
  entries: SourceLineEntry[],
  headerIndex: number,
  endIndex: number | null
): SourceSpan {
  if (endIndex === null) {
    return spanAt(entries[headerIndex].lineNo, entries[headerIndex].cleanLine.length);
  }
  return {
    startLine: entries[headerIndex].lineNo,
    startColumn: 1,
    endLine: entries[endIndex].lineNo,
    endColumn: Math.max(2, entries[endIndex].cleanLine.length + 1)
  };
}

export function parseStructuredProgramFromSource(source: string): StructuredProgramParseResult {
  const lines = source.split(/\r?\n/);
  const entries: SourceLineEntry[] = lines.map((rawLine, idx) => ({
    lineNo: idx + 1,
    rawLine,
    cleanLine: stripLineComment(rawLine).trim()
  }));
  const span = computeProgramSpan(lines);
  const headers = parseProgramHeadersFromTokens(source);
  const targetProfileId = headers.targetProfileId;
  const functions: StructuredFunctionDefAst[] = [];
  const diagnostics: Diagnostic[] = [];
  const functionLines = new Set<number>();

  for (let i = 0; i < entries.length; i++) {
    if (headers.kernelHeaderLine && entries[i].lineNo >= headers.kernelHeaderLine) break;
    const functionHeader = parseFunctionHeader(entries[i].cleanLine);
    if (!functionHeader) continue;
    const params = parseFunctionParams(functionHeader.paramsText, entries[i].lineNo, diagnostics);
    const block = collectBlockFromEntries(entries, i);
    if (!params || block.endIndex === null) {
      if (block.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entries[i].lineNo, entries[i].cleanLine.length),
          `Unterminated function '${functionHeader.name}'.`,
          'Add a closing brace for function { ... }.'
        ));
      }
      continue;
    }

    for (let lineIdx = i; lineIdx <= block.endIndex; lineIdx++) {
      functionLines.add(entries[lineIdx].lineNo);
    }

    functions.push({
      name: functionHeader.name,
      params,
      body: parseStructuredStatements(block.body, { value: 0 }, diagnostics),
      span: spanAt(entries[i].lineNo, entries[i].cleanLine.length)
    });
    i = block.endIndex;
  }

  const kernelHeaderIdx = headers.kernelHeaderLine
    ? entries.findIndex((entry) => entry.lineNo === headers.kernelHeaderLine)
    : -1;
  if (kernelHeaderIdx < 0) {
    return {
      program: {
        targetProfileId,
        kernel: null,
        functions,
        span
      },
      diagnostics
    };
  }

  const kernelName = headers.kernelName;
  if (!kernelName) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entries[kernelHeaderIdx].lineNo, entries[kernelHeaderIdx].cleanLine.length),
      `Invalid kernel declaration: '${entries[kernelHeaderIdx].cleanLine}'.`,
      'Use: kernel "name" { ... }'
    ));
    return {
      program: {
        targetProfileId,
        kernel: null,
        functions,
        span
      },
      diagnostics
    };
  }

  for (let i = 0; i < kernelHeaderIdx; i++) {
    const entry = entries[i];
    if (functionLines.has(entry.lineNo)) continue;
    if (!entry.cleanLine) continue;
    if (/^target\s+"[^"]+"\s*;?\s*$/i.test(entry.cleanLine)) continue;
    if (parseDirective(entry.cleanLine, entry.lineNo)) continue;
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, entry.cleanLine.length),
      `Unexpected top-level statement: '${entry.cleanLine}'.`,
      'Expected target declaration, let declaration, function definition, or kernel block.'
    ));
  }

  const kernelBlock = collectBlockFromEntries(entries, kernelHeaderIdx);
  if (kernelBlock.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entries[kernelHeaderIdx].lineNo, entries[kernelHeaderIdx].cleanLine.length),
      `Unterminated kernel '${kernelName}'.`,
      'Add a closing brace for kernel { ... }.'
    ));
  }

  const configEntry = kernelBlock.body.find((entry) => /^config\s*\(/i.test(entry.cleanLine));
  const configMatch = configEntry?.cleanLine.match(/^config\s*\(\s*([^,]+)\s*,\s*([^\)]+)\)\s*;?\s*$/i);
  const config = configMatch
    ? {
        mask: parseInteger(configMatch[1]) ?? 0,
        startAddr: parseInteger(configMatch[2]) ?? 0,
        span: spanAt(configEntry!.lineNo, configEntry!.cleanLine.length)
      }
    : undefined;

  const topLevelDirectives = entries
    .slice(0, kernelHeaderIdx)
    .filter((entry) => !functionLines.has(entry.lineNo))
    .map((entry) => parseDirective(entry.cleanLine, entry.lineNo))
    .filter((directive): directive is NonNullable<typeof directive> => directive !== null);

  const kernelDirectives = kernelBlock.body
    .map((entry) => parseDirective(entry.cleanLine, entry.lineNo))
    .filter((directive): directive is NonNullable<typeof directive> => directive !== null);

  const directives = [...topLevelDirectives, ...kernelDirectives];

  const cycleCounter = { value: 0 };
  const body = parseStructuredStatements(kernelBlock.body, cycleCounter, diagnostics);

  return {
    program: {
      targetProfileId,
      kernel: {
        name: kernelName,
        ...(config ? { config } : {}),
        directives,
        body,
        span: computeKernelSpan(entries, kernelHeaderIdx, kernelBlock.endIndex)
      },
      functions,
      span
    },
    diagnostics
  };
}
