import {
  BuildConfigAst,
  Diagnostic,
  ErrorCodes,
  RuntimeStmtAst,
  TargetAst,
  makeDiagnostic,
  SourceSpan,
  StructuredFunctionDefAst,
  StructuredProgramAst
} from '@castm/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from './parser-utils/blocks.js';
import { splitTopLevel, stripLineComment } from './parser-utils/strings.js';
import { parseDirective } from './lowering/declarations.js';
import { parseFunctionHeader, parseMacroHeader, parseFunctionParams } from './lowering/functions.js';
import { parseStructuredStatements } from './statements.js';
import { parseInteger, spanAt } from './utils.js';
import { parseProgramHeadersFromTokens } from './token-stream.js';
import { parseBuildConfig } from './parse-build-config.js';

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

function parseTargetLine(cleanLine: string, lineNo: number): TargetAst | null {
  const quoted = cleanLine.match(/^target\s+"([^"]+)"\s*;?\s*$/i);
  if (quoted) {
    const raw = quoted[1].trim();
    return {
      id: raw,
      raw,
      span: spanAt(lineNo, cleanLine.length)
    };
  }

  const bare = cleanLine.match(/^target\s+([A-Za-z_][A-Za-z0-9_-]*)\s*;?\s*$/i);
  if (!bare) return null;
  const raw = bare[1].trim();
  return {
    id: raw,
    raw,
    span: spanAt(lineNo, cleanLine.length)
  };
}

interface RuntimeLineParseResult {
  handled: boolean;
  stmt?: RuntimeStmtAst;
}

function parseRuntimeStatementLine(
  cleanLine: string,
  lineNo: number,
  diagnostics: Diagnostic[]
): RuntimeLineParseResult {
  const io = cleanLine.match(/^io\.(load|store)\s*\(([\s\S]*)\)\s*;?\s*$/i);
  if (io) {
    const args = splitTopLevel(io[2], ',').map((part) => part.trim()).filter(Boolean);
    if (args.length === 0) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, cleanLine.length),
        `Invalid io.${io[1].toLowerCase()} statement.`,
        `Use: io.${io[1].toLowerCase()}(0, 4, 8);`
      ));
      return { handled: true };
    }
    const kind = io[1].toLowerCase() === 'load' ? 'io_load' : 'io_store';
    if (kind === 'io_load') {
      return {
        handled: true,
        stmt: {
          kind: 'io_load',
          addresses: args,
          raw: cleanLine,
          span: spanAt(lineNo, cleanLine.length)
        }
      };
    }
    return {
      handled: true,
      stmt: {
        kind: 'io_store',
        addresses: args,
        raw: cleanLine,
        span: spanAt(lineNo, cleanLine.length)
      }
    };
  }

  const limit = cleanLine.match(/^limit\s*\(([\s\S]+)\)\s*;?\s*$/i);
  if (limit) {
    return {
      handled: true,
      stmt: {
        kind: 'limit',
        value: limit[1].trim(),
        raw: cleanLine,
        span: spanAt(lineNo, cleanLine.length)
      }
    };
  }

  const assertion = cleanLine.match(/^assert\s*\(([\s\S]+)\)\s*;?\s*$/i);
  if (assertion) {
    const body = assertion[1].trim();
    const atMatch = body.match(/\bat\s*=\s*@\s*([^,\s]+)\s*,\s*([^\s,]+)\s*/i);
    if (!atMatch) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, cleanLine.length),
        `Invalid assert statement '${cleanLine}'.`,
        'Use: assert(at=@0,0, reg=R1, equals=42, cycle=0).'
      ));
      return { handled: true };
    }

    const remaining = body
      .replace(atMatch[0], '')
      .replace(/^\s*,\s*/, '')
      .replace(/\s*,\s*$/, '');
    const parsedArgs = new Map<string, string>();
    const args = remaining.length > 0 ? splitTopLevel(remaining, ',') : [];
    let valid = true;
    for (const part of args) {
      const kv = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (!kv) {
        valid = false;
        break;
      }
      parsedArgs.set(kv[1].toLowerCase(), kv[2].trim());
    }
    if (!valid || !parsedArgs.has('reg') || !parsedArgs.has('equals')) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, cleanLine.length),
        `Invalid assert statement '${cleanLine}'.`,
        'Use: assert(at=@0,0, reg=R1, equals=42, cycle=0).'
      ));
      return { handled: true };
    }

    return {
      handled: true,
        stmt: {
          kind: 'assert',
          at: {
            row: atMatch[1].trim(),
            col: atMatch[2].trim()
          },
          reg: parsedArgs.get('reg')!.trim(),
          equals: parsedArgs.get('equals')!.trim(),
          ...(parsedArgs.get('cycle') ? { cycle: parsedArgs.get('cycle')!.trim() } : {}),
          raw: cleanLine,
          span: spanAt(lineNo, cleanLine.length)
        }
    };
  }

  const legacyRuntime = cleanLine.match(/^\.(io_load|io_store|limit|assert)\b/i);
  if (legacyRuntime) {
    const legacy = legacyRuntime[1].toLowerCase();
    const hint = legacy === 'io_load'
      ? 'Use io.load(...) instead of .io_load.'
      : legacy === 'io_store'
        ? 'Use io.store(...) instead of .io_store.'
        : legacy === 'limit'
          ? 'Use limit(...) instead of .limit.'
          : 'Use assert(...) instead of .assert.';
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, cleanLine.length),
      `Legacy runtime directive '.${legacy}' is not supported in canonical mode.`,
      hint,
      'MIG-RUNTIME-001'
    ));
    return { handled: true };
  }

  return { handled: false };
}

export function preprocessIncludes(
  source: string,
  resolveInclude: (path: string) => string | null,
  diagnostics: Diagnostic[],
  visitedPaths: Set<string> = new Set()
): string {
  const lines = source.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const clean = stripLineComment(lines[i]).trim();
    const includeMatch = clean.match(/^include\s+"([^"]+)"\s*;?\s*$/i);
    if (!includeMatch) {
      result.push(lines[i]);
      continue;
    }

    const includePath = includeMatch[1];
    if (visitedPaths.has(includePath)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(i + 1, clean.length),
        `Circular include detected: '${includePath}'.`,
        'Remove the circular include dependency.'
      ));
      continue;
    }

    const content = resolveInclude(includePath);
    if (content === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(i + 1, clean.length),
        `Could not resolve include '${includePath}'.`,
        'Check that the file exists and the path is correct.'
      ));
      continue;
    }

    const nested = new Set(visitedPaths);
    nested.add(includePath);
    const expanded = preprocessIncludes(content, resolveInclude, diagnostics, nested);
    result.push(expanded);
  }

  return result.join('\n');
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
  let target: TargetAst | null = null;
  let build: BuildConfigAst | undefined;
  const functions: StructuredFunctionDefAst[] = [];
  const diagnostics: Diagnostic[] = [];
  const functionLines = new Set<number>();
  const buildLines = new Set<number>();
  const targetLines = new Set<number>();

  for (let i = 0; i < entries.length; i++) {
    if (headers.kernelHeaderLine && entries[i].lineNo >= headers.kernelHeaderLine) break;
    const functionHeader = parseFunctionHeader(entries[i].cleanLine);
    const macroHeader = !functionHeader ? parseMacroHeader(entries[i].cleanLine) : null;
    const header = functionHeader ?? macroHeader;
    if (!header) continue;
    const isMacro = !!macroHeader;
    const params = parseFunctionParams(header.paramsText, entries[i].lineNo, diagnostics);
    const block = collectBlockFromEntries(entries, i);
    if (!params || block.endIndex === null) {
      if (block.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entries[i].lineNo, entries[i].cleanLine.length),
          `Unterminated ${isMacro ? 'macro' : 'function'} '${header.name}'.`,
          `Add a closing brace for ${isMacro ? 'macro' : 'function'} { ... }.`
        ));
      }
      continue;
    }

    for (let lineIdx = i; lineIdx <= block.endIndex; lineIdx++) {
      functionLines.add(entries[lineIdx].lineNo);
    }

    functions.push({
      name: header.name,
      params,
      body: parseStructuredStatements(block.body, { value: 0 }, diagnostics),
      span: spanAt(entries[i].lineNo, entries[i].cleanLine.length),
      ...(isMacro ? { isMacro: true } : {})
    });
    i = block.endIndex;
  }

  const kernelHeaderIdx = headers.kernelHeaderLine
    ? entries.findIndex((entry) => entry.lineNo === headers.kernelHeaderLine)
    : -1;

  const topLevelStop = kernelHeaderIdx >= 0 ? kernelHeaderIdx : entries.length;
  for (let i = 0; i < topLevelStop; i++) {
    const entry = entries[i];
    if (functionLines.has(entry.lineNo)) continue;
    const parsedTarget = parseTargetLine(entry.cleanLine, entry.lineNo);
    if (parsedTarget) {
      target = parsedTarget;
      targetLines.add(entry.lineNo);
      continue;
    }
  }

  for (let i = 0; i < topLevelStop; i++) {
    const entry = entries[i];
    if (functionLines.has(entry.lineNo)) continue;
    if (!/^build\s*\{/i.test(entry.cleanLine)) continue;
    if (build) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, entry.cleanLine.length),
        'Duplicate build block.',
        'Only one top-level build { ... } block is allowed.'
      ));
      continue;
    }
    const parsed = parseBuildConfig(entries, i, diagnostics);
    if (parsed.endIndex === null) {
      break;
    }
    if (parsed.config) build = parsed.config;
    for (let lineIdx = i; lineIdx <= parsed.endIndex; lineIdx++) {
      buildLines.add(entries[lineIdx].lineNo);
    }
    i = parsed.endIndex;
  }

  const targetProfileId = target?.id ?? null;

  if (kernelHeaderIdx < 0) {
    return {
      program: {
        target,
        targetProfileId,
        ...(build ? { build } : {}),
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
        target,
        targetProfileId,
        ...(build ? { build } : {}),
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
    if (buildLines.has(entry.lineNo)) continue;
    if (targetLines.has(entry.lineNo)) continue;
    if (!entry.cleanLine) continue;
    if (parseDirective(entry.cleanLine, entry.lineNo)) continue;
    if (/^include\s+"[^"]+"\s*;?\s*$/i.test(entry.cleanLine)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, entry.cleanLine.length),
        `Unresolved include directive: '${entry.cleanLine}'.`,
        'Pass a resolveInclude option to enable file includes.'
      ));
      continue;
    }
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, entry.cleanLine.length),
      `Unexpected top-level statement: '${entry.cleanLine}'.`,
      'Expected target declaration, build block, let declaration, function/macro definition, or kernel block.'
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

  const runtime: RuntimeStmtAst[] = [];
  const runtimeLines = new Set<number>();
  for (const entry of kernelBlock.body) {
    const parsedRuntime = parseRuntimeStatementLine(entry.cleanLine, entry.lineNo, diagnostics);
    if (!parsedRuntime.handled) continue;
    runtimeLines.add(entry.lineNo);
    if (parsedRuntime.stmt) runtime.push(parsedRuntime.stmt);
  }

  const cycleCounter = { value: 0 };
  const bodyEntries = kernelBlock.body.filter((entry) => !runtimeLines.has(entry.lineNo));
  const body = parseStructuredStatements(bodyEntries, cycleCounter, diagnostics);

  return {
    program: {
      target,
      targetProfileId,
      ...(build ? { build } : {}),
      kernel: {
        name: kernelName,
        ...(config ? { config } : {}),
        directives,
        runtime,
        body,
        span: computeKernelSpan(entries, kernelHeaderIdx, kernelBlock.endIndex)
      },
      functions,
      span
    },
    diagnostics
  };
}
