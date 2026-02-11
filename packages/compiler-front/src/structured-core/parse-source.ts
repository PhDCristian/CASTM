import {
  SourceSpan,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from '../parser-utils/blocks.js';
import { stripLineComment } from '../parser-utils/strings.js';
import { parseDirective } from '../parser-core/declarations.js';
import { parseStructuredStatements } from './statements.js';
import { parseInteger, spanAt } from './utils.js';
import { parseProgramHeadersFromTokens } from './token-stream.js';

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

export function parseStructuredProgramFromSource(source: string): StructuredProgramAst {
  const lines = source.split(/\r?\n/);
  const entries: SourceLineEntry[] = lines.map((rawLine, idx) => ({
    lineNo: idx + 1,
    rawLine,
    cleanLine: stripLineComment(rawLine).trim()
  }));
  const span = computeProgramSpan(lines);
  const headers = parseProgramHeadersFromTokens(source);
  const targetProfileId = headers.targetProfileId;
  const kernelHeaderIdx = headers.kernelHeaderLine
    ? entries.findIndex((entry) => entry.lineNo === headers.kernelHeaderLine)
    : -1;
  if (kernelHeaderIdx < 0) {
    return {
      targetProfileId,
      kernel: null,
      span
    };
  }

  const kernelName = headers.kernelName;
  if (!kernelName) {
    return {
      targetProfileId,
      kernel: null,
      span
    };
  }

  const kernelBlock = collectBlockFromEntries(entries, kernelHeaderIdx);

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
    .map((entry) => parseDirective(entry.cleanLine, entry.lineNo))
    .filter((directive): directive is NonNullable<typeof directive> => directive !== null);

  const kernelDirectives = kernelBlock.body
    .map((entry) => parseDirective(entry.cleanLine, entry.lineNo))
    .filter((directive): directive is NonNullable<typeof directive> => directive !== null);

  const directives = [...topLevelDirectives, ...kernelDirectives];

  const cycleCounter = { value: 0 };
  const body = parseStructuredStatements(kernelBlock.body, cycleCounter);

  return {
    targetProfileId,
    kernel: {
      name: kernelName,
      ...(config ? { config } : {}),
      directives,
      body,
      span: computeKernelSpan(entries, kernelHeaderIdx, kernelBlock.endIndex)
    },
    span
  };
}
