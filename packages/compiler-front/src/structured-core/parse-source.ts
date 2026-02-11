import {
  AstProgram,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from '../parser-utils/blocks.js';
import { stripLineComment } from '../parser-utils/strings.js';
import { toStructuredProgramAst } from './conversion.js';
import { parseStructuredStatements } from './statements.js';
import { parseInteger, spanAt } from './utils.js';

export function parseStructuredProgramFromSource(source: string, ast: AstProgram): StructuredProgramAst {
  const lines = source.split(/\r?\n/);
  const entries: SourceLineEntry[] = lines.map((rawLine, idx) => ({
    lineNo: idx + 1,
    rawLine,
    cleanLine: stripLineComment(rawLine).trim()
  }));

  const kernelHeaderIdx = entries.findIndex((entry) => /^kernel\s+"([^"]+)"\s*\{\s*$/i.test(entry.cleanLine));
  if (kernelHeaderIdx < 0 || !ast.kernel) {
    return {
      targetProfileId: ast.targetProfileId,
      kernel: null,
      span: ast.span
    };
  }

  const kernelHeader = entries[kernelHeaderIdx].cleanLine.match(/^kernel\s+"([^"]+)"\s*\{\s*$/i);
  if (!kernelHeader) {
    return toStructuredProgramAst(ast);
  }

  const kernelBlock = collectBlockFromEntries(entries, kernelHeaderIdx);
  if (kernelBlock.endIndex === null) {
    return toStructuredProgramAst(ast);
  }

  const configEntry = kernelBlock.body.find((entry) => /^config\s*\(/i.test(entry.cleanLine));
  const configMatch = configEntry?.cleanLine.match(/^config\s*\(\s*([^,]+)\s*,\s*([^\)]+)\)\s*;?\s*$/i);
  const config = configMatch
    ? {
        mask: parseInteger(configMatch[1]) ?? 0,
        startAddr: parseInteger(configMatch[2]) ?? 0,
        span: spanAt(configEntry!.lineNo, configEntry!.cleanLine.length)
      }
    : ast.kernel.config;

  const cycleCounter = { value: 0 };
  const body = parseStructuredStatements(kernelBlock.body, cycleCounter);

  return {
    targetProfileId: ast.targetProfileId,
    kernel: {
      name: kernelHeader[1],
      ...(config ? { config } : {}),
      directives: ast.kernel.directives,
      body,
      span: ast.kernel.span
    },
    span: ast.span
  };
}
