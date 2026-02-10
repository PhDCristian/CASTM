import {
  AstProgram,
  CycleAst,
  CycleStatementAst,
  DirectiveAst,
  Diagnostic,
  InstructionAst,
  KernelAst,
  ParseResult,
  SourceSpan
} from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';

function parseNumber(text: string): number {
  const trimmed = text.trim();
  if (/^-?0x[0-9a-f]+$/i.test(trimmed)) {
    const sign = trimmed.startsWith('-') ? -1 : 1;
    const hex = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
    return sign * parseInt(hex, 16);
  }
  return parseInt(trimmed, 10);
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let paren = 0;
  let bracket = 0;

  for (const ch of input) {
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (ch === delimiter && paren === 0 && bracket === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim().length > 0) out.push(current.trim());
  return out;
}

function stripLineComment(line: string): string {
  return line.replace(/\/\/.*$/, '');
}

function countChar(text: string, needle: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch === needle) count++;
  }
  return count;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyBindings(input: string, bindings: ReadonlyMap<string, number>): string {
  let out = input;
  for (const [name, value] of bindings.entries()) {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
    out = out.replace(regex, String(value));
  }
  return out;
}

function evaluateNumericExpression(
  expression: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): number | null {
  const unresolved: string[] = [];
  const replaced = expression.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (name) => {
    if (bindings.has(name)) return String(bindings.get(name));
    if (constants.has(name)) return String(constants.get(name));
    unresolved.push(name);
    return name;
  });

  if (unresolved.length > 0) {
    return null;
  }

  if (!/^[0-9a-fA-FxX+\-*/%()\s]+$/.test(replaced)) {
    return null;
  }

  try {
    const value = Function(`"use strict"; return (${replaced});`)();
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function parseInstruction(text: string, line: number, column: number): InstructionAst {
  const clean = text.trim();

  if (clean === '_' || clean.toUpperCase() === 'NOP') {
    return {
      text: 'NOP',
      opcode: 'NOP',
      operands: [],
      span: spanAt(line, column, clean.length)
    };
  }

  if (clean.includes('=')) {
    return {
      text: clean,
      opcode: null,
      operands: [],
      span: spanAt(line, column, clean.length)
    };
  }

  const firstSpace = clean.indexOf(' ');
  if (firstSpace < 0) {
    return {
      text: clean,
      opcode: clean.toUpperCase(),
      operands: [],
      span: spanAt(line, column, clean.length)
    };
  }

  const opcode = clean.slice(0, firstSpace).toUpperCase();
  const rest = clean.slice(firstSpace + 1);
  const operands = splitTopLevel(rest, ',').map((x) => x.trim()).filter(Boolean);

  return {
    text: clean,
    opcode,
    operands,
    span: spanAt(line, column, clean.length)
  };
}

function parseDirective(clean: string, line: number): DirectiveAst | null {
  const constMatch = clean.match(/^\.const\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*)?(.+)$/i);
  if (constMatch) {
    return {
      kind: 'const',
      name: constMatch[1],
      value: constMatch[2].trim(),
      span: spanAt(line, 1, clean.length)
    };
  }

  const aliasMatch = clean.match(/^\.alias\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)$/i);
  if (aliasMatch) {
    return {
      kind: 'alias',
      name: aliasMatch[1],
      value: aliasMatch[2],
      span: spanAt(line, 1, clean.length)
    };
  }

  const dataMatch = clean.match(/^\.data\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/i);
  if (dataMatch) {
    return {
      kind: 'data',
      name: dataMatch[1],
      value: dataMatch[2].trim(),
      span: spanAt(line, 1, clean.length)
    };
  }

  if (clean.startsWith('.')) {
    return {
      kind: 'raw',
      name: clean.split(/\s+/)[0].slice(1),
      value: clean,
      span: spanAt(line, 1, clean.length)
    };
  }

  return null;
}

function parseCycleStatement(
  clean: string,
  line: number,
  rawLine: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): CycleStatementAst | null {
  const atMatch = clean.match(/^@\s*([^,]+)\s*,\s*([^:]+)\s*:\s*(.+);\s*$/i);
  if (atMatch) {
    const row = evaluateNumericExpression(atMatch[1].trim(), constants, bindings);
    const col = evaluateNumericExpression(atMatch[2].trim(), constants, bindings);
    if (row === null || col === null) return null;
    const instructionText = atMatch[3].trim();
    const column = Math.max(1, rawLine.indexOf(instructionText) + 1);
    return {
      kind: 'at',
      row,
      col,
      instruction: parseInstruction(instructionText, line, column),
      span: spanAt(line, 1, clean.length)
    };
  }

  const rowMatch = clean.match(/^row\s+([^:]+)\s*:\s*(.+);\s*$/i);
  if (rowMatch) {
    const row = evaluateNumericExpression(rowMatch[1].trim(), constants, bindings);
    if (row === null) return null;
    const payload = rowMatch[2].trim();
    const segments = splitTopLevel(payload, '|').map((s) => s.trim());
    return {
      kind: 'row',
      row,
      instructions: segments.map((segment) => parseInstruction(segment, line, Math.max(1, rawLine.indexOf(segment) + 1))),
      span: spanAt(line, 1, clean.length)
    };
  }

  const colMatch = clean.match(/^col\s+([^:]+)\s*:\s*(.+);\s*$/i);
  if (colMatch) {
    const col = evaluateNumericExpression(colMatch[1].trim(), constants, bindings);
    if (col === null) return null;
    const instructionText = colMatch[2].trim();
    return {
      kind: 'col',
      col,
      instruction: parseInstruction(instructionText, line, Math.max(1, rawLine.indexOf(instructionText) + 1)),
      span: spanAt(line, 1, clean.length)
    };
  }

  const allMatch = clean.match(/^all\s*:\s*(.+);\s*$/i);
  if (allMatch) {
    const instructionText = allMatch[1].trim();
    return {
      kind: 'all',
      instruction: parseInstruction(instructionText, line, Math.max(1, rawLine.indexOf(instructionText) + 1)),
      span: spanAt(line, 1, clean.length)
    };
  }

  return null;
}

interface ForHeader {
  variable: string;
  start: number;
  end: number;
  step: number;
}

interface SourceLineEntry {
  lineNo: number;
  rawLine: string;
  cleanLine: string;
}

interface CollectedBlock {
  body: SourceLineEntry[];
  endIndex: number | null;
}

interface FunctionDefinitionLite {
  name: string;
  params: string[];
  body: SourceLineEntry[];
  span: SourceSpan;
}

function parseForHeader(
  cleanLine: string,
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): ForHeader | null {
  const loopMatch = cleanLine.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\((.*)\)\s*\{\s*$/i);
  if (!loopMatch) return null;

  const variable = loopMatch[1];
  const argsText = loopMatch[2].trim();
  const args = argsText.length === 0 ? [] : splitTopLevel(argsText, ',');

  if (args.length < 1 || args.length > 3) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      `Invalid range() in for loop: expected 1..3 arguments, got ${args.length}.`,
      'Valid forms: range(end), range(start,end), range(start,end,step).'
    ));
    return null;
  }

  const values: number[] = [];
  for (const arg of args) {
    const value = evaluateNumericExpression(arg.trim(), constants, bindings);
    if (value === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanLine.length),
        `Invalid range() argument '${arg.trim()}' in for loop.`,
        'Use integer literals, constants, loop bindings, and + - * / % operators.'
      ));
      return null;
    }
    values.push(value);
  }

  let start = 0;
  let end = 0;
  let step = 1;
  if (values.length === 1) {
    end = values[0];
  } else if (values.length === 2) {
    start = values[0];
    end = values[1];
  } else {
    [start, end, step] = values;
  }

  if (step === 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      'range() step cannot be zero.',
      'Use a non-zero step value.'
    ));
    return null;
  }

  return { variable, start, end, step };
}

function collectBlockFromSource(
  lines: string[],
  startIndex: number
): CollectedBlock {
  const body: SourceLineEntry[] = [];
  const header = stripLineComment(lines[startIndex]).trim();
  let depth = countChar(header, '{') - countChar(header, '}');
  if (depth <= 0) depth = 1;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = stripLineComment(rawLine).trim();
    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    if (nextDepth === 0) {
      return { body, endIndex: i };
    }

    body.push({
      lineNo: i + 1,
      rawLine,
      cleanLine
    });
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

function collectBlockFromEntries(
  entries: SourceLineEntry[],
  startIndex: number
): CollectedBlock {
  const body: SourceLineEntry[] = [];
  const header = entries[startIndex].cleanLine;
  let depth = countChar(header, '{') - countChar(header, '}');
  if (depth <= 0) depth = 1;

  for (let i = startIndex + 1; i < entries.length; i++) {
    const cleanLine = entries[i].cleanLine;
    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    if (nextDepth === 0) {
      return { body, endIndex: i };
    }

    body.push(entries[i]);
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

function expandLoopBody(
  body: SourceLineEntry[],
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): CycleStatementAst[] {
  const statements: CycleStatementAst[] = [];

  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    if (!entry.cleanLine) continue;

    const clean = applyBindings(entry.cleanLine, bindings);
    const raw = applyBindings(entry.rawLine, bindings);
    if (!clean) continue;

    const loopHeader = parseForHeader(clean, entry.lineNo, constants, bindings, diagnostics);
    if (loopHeader) {
      const nested = collectBlockFromEntries(body, i);
      if (nested.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated for loop inside cycle block.',
          'Add a closing brace for for { ... }.'
        ));
        break;
      }

      const shouldContinue = loopHeader.step > 0
        ? (v: number) => v < loopHeader.end
        : (v: number) => v > loopHeader.end;

      for (let value = loopHeader.start; shouldContinue(value); value += loopHeader.step) {
        const nestedBindings = new Map(bindings);
        nestedBindings.set(loopHeader.variable, value);
        statements.push(...expandLoopBody(nested.body, constants, nestedBindings, diagnostics));
      }

      i = nested.endIndex;
      continue;
    }

    if (clean === '}') {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        'Unexpected closing brace inside cycle block.',
        'Check for mismatched braces around for/cycle blocks.'
      ));
      continue;
    }

    const statement = parseCycleStatement(clean, entry.lineNo, raw, constants, bindings);
    if (!statement) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        `Invalid cycle statement: '${clean}'`,
        'Expected @row,col:, row N:, col N:, all:, or for ... in range(...) { ... }.'
      ));
      continue;
    }

    statements.push(statement);
  }

  return statements;
}

function buildConstantMap(directives: DirectiveAst[], diagnostics: Diagnostic[]): Map<string, number> {
  const constants = new Map<string, number>();

  for (const directive of directives) {
    if (directive.kind !== 'const') continue;
    const value = evaluateNumericExpression(directive.value, constants, new Map());
    if (value === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        directive.span,
        `Invalid numeric value for .const '${directive.name}': '${directive.value}'.`,
        'Use integer expressions referencing previously declared constants.'
      ));
      continue;
    }
    constants.set(directive.name, value);
  }

  return constants;
}

function parseFunctionHeader(cleanLine: string): { name: string; paramsText: string } | null {
  const match = cleanLine.match(/^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*\{\s*$/i);
  if (!match) return null;
  return {
    name: match[1],
    paramsText: match[2].trim()
  };
}

function parseFunctionParams(
  paramsText: string,
  lineNo: number,
  diagnostics: Diagnostic[]
): string[] | null {
  if (!paramsText) return [];
  const parts = splitTopLevel(paramsText, ',').map((p) => p.trim()).filter(Boolean);
  const params: string[] = [];

  for (const part of parts) {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*.+)?$/);
    if (!match) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, Math.max(1, paramsText.length)),
        `Invalid function parameter '${part}'.`,
        'Use parameter syntax: name or name: type.'
      ));
      return null;
    }

    const name = match[1];
    if (params.includes(name)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, Math.max(1, paramsText.length)),
        `Duplicate function parameter '${name}'.`,
        'Each function parameter must be unique.'
      ));
      return null;
    }

    params.push(name);
  }

  return params;
}

function parseFunctionCallLine(cleanLine: string): { name: string; args: string[] } | null {
  const match = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*;?\s*$/);
  if (!match) return null;

  const argsText = match[2].trim();
  const args = argsText.length === 0
    ? []
    : splitTopLevel(argsText, ',').map((arg) => arg.trim());

  return {
    name: match[1],
    args
  };
}

function applyFunctionArgs(input: string, argsByParam: ReadonlyMap<string, string>): string {
  let out = input;
  for (const [name, value] of argsByParam.entries()) {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
    out = out.replace(regex, value);
  }
  return out;
}

function instantiateFunctionBody(
  def: FunctionDefinitionLite,
  args: string[],
  callLineNo: number,
  diagnostics: Diagnostic[]
): SourceLineEntry[] | null {
  if (args.length !== def.params.length) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(callLineNo, 1, 1),
      `Function '${def.name}' expects ${def.params.length} argument(s), got ${args.length}.`,
      `Call it as: ${def.name}(${def.params.join(', ')})`
    ));
    return null;
  }

  const argsByParam = new Map<string, string>();
  for (let i = 0; i < def.params.length; i++) {
    argsByParam.set(def.params[i], args[i]);
  }

  return def.body.map((entry) => {
    const raw = applyFunctionArgs(entry.rawLine, argsByParam);
    const clean = applyFunctionArgs(entry.cleanLine, argsByParam);
    return {
      lineNo: callLineNo,
      rawLine: raw,
      cleanLine: clean
    };
  });
}

function parseInlineCycleStatements(
  payload: string,
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): CycleStatementAst[] {
  const statements: CycleStatementAst[] = [];
  const parts = splitTopLevel(payload, ';').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const cleanStmt = `${part};`;
    const parsed = parseCycleStatement(cleanStmt, lineNo, cleanStmt, constants, new Map());
    if (!parsed) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanStmt.length),
        `Invalid inline cycle statement: '${part}'.`,
        'Use valid cycle placement syntax like @r,c:, row:, col:, or all:.'
      ));
      continue;
    }
    statements.push(parsed);
  }
  return statements;
}

function expandFunctionBodyIntoKernel(
  body: SourceLineEntry[],
  kernel: KernelAst,
  functions: ReadonlyMap<string, FunctionDefinitionLite>,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  cycleCounter: { value: number },
  callStack: string[]
): void {
  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    const clean = entry.cleanLine.trim();
    if (!clean) continue;

    const inlineCycleMatch = clean.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
    if (inlineCycleMatch) {
      const cycle: CycleAst = {
        index: cycleCounter.value++,
        statements: parseInlineCycleStatements(inlineCycleMatch[1], entry.lineNo, constants, diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      };
      kernel.cycles.push(cycle);
      continue;
    }

    if (/^cycle\s*\{\s*$/i.test(clean)) {
      const block = collectBlockFromEntries(body, i);
      if (block.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated cycle block inside function body.',
          'Add a closing brace for cycle { ... }.'
        ));
        break;
      }

      kernel.cycles.push({
        index: cycleCounter.value++,
        statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      });
      i = block.endIndex;
      continue;
    }

    const nestedCall = parseFunctionCallLine(clean);
    if (nestedCall && functions.has(nestedCall.name)) {
      if (callStack.includes(nestedCall.name)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          `Recursive function call detected: ${[...callStack, nestedCall.name].join(' -> ')}.`,
          'Recursive function expansion is not supported.'
        ));
        continue;
      }

      const def = functions.get(nestedCall.name)!;
      const instantiated = instantiateFunctionBody(def, nestedCall.args, entry.lineNo, diagnostics);
      if (!instantiated) continue;

      expandFunctionBodyIntoKernel(
        instantiated,
        kernel,
        functions,
        constants,
        diagnostics,
        cycleCounter,
        [...callStack, nestedCall.name]
      );
      continue;
    }

    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      `Unsupported function body statement: '${clean}'.`,
      'Function bodies currently support cycle blocks and function calls.'
    ));
  }
}

export function parseSource(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const lines = source.split(/\r?\n/);

  const span: SourceSpan = {
    startLine: 1,
    startColumn: 1,
    endLine: lines.length,
    endColumn: (lines[lines.length - 1] || '').length + 1
  };

  const ast: AstProgram = {
    targetProfileId: null,
    kernel: null,
    span
  };

  let kernel: KernelAst | null = null;
  let kernelConstants = new Map<string, number>();
  let inKernel = false;
  let inCycle = false;
  let currentCycle: CycleAst | null = null;
  let cycleConstants = new Map<string, number>();
  let cycleIndex = 0;
  const pendingDirectives: DirectiveAst[] = [];
  const functions = new Map<string, FunctionDefinitionLite>();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i];
    const clean = stripLineComment(rawLine).trim();

    if (!clean) continue;

    if (!inKernel) {
      const functionHeader = parseFunctionHeader(clean);
      if (functionHeader) {
        const params = parseFunctionParams(functionHeader.paramsText, lineNo, diagnostics);
        const block = collectBlockFromSource(lines, i);
        if (block.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            `Unterminated function '${functionHeader.name}'.`,
            'Add a closing brace for function { ... }.'
          ));
          break;
        }

        if (params && !functions.has(functionHeader.name)) {
          functions.set(functionHeader.name, {
            name: functionHeader.name,
            params,
            body: block.body,
            span: spanAt(lineNo, 1, clean.length)
          });
        } else if (params) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            `Duplicate function definition '${functionHeader.name}'.`,
            'Use unique function names.'
          ));
        }

        i = block.endIndex;
        continue;
      }

      const targetMatch = clean.match(/^target\s+"([^"]+)"\s*;?\s*$/i);
      if (targetMatch) {
        ast.targetProfileId = targetMatch[1];
        continue;
      }

      const kernelMatch = clean.match(/^kernel\s+"([^"]+)"\s*\{\s*$/i);
      if (kernelMatch) {
        const initialDirectives = [...pendingDirectives];
        kernel = {
          name: kernelMatch[1],
          config: undefined,
          cycles: [],
          directives: initialDirectives,
          pragmas: [],
          span: spanAt(lineNo, 1, clean.length)
        };
        kernelConstants = buildConstantMap(initialDirectives, diagnostics);
        ast.kernel = kernel;
        pendingDirectives.length = 0;
        inKernel = true;
        continue;
      }

      const topDirective = parseDirective(clean, lineNo);
      if (topDirective) {
        if (!ast.kernel) {
          pendingDirectives.push(topDirective);
          continue;
        }

        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(lineNo, 1, clean.length),
          `Unexpected top-level directive after kernel declaration: '${clean}'`,
          'Move directives into kernel block or place them before kernel declaration.'
        ));
        continue;
      }

      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        `Unexpected top-level statement: '${clean}'`,
        'Expected target declaration or kernel block.'
      ));
      continue;
    }

    if (inKernel && !inCycle) {
      if (clean === '}') {
        inKernel = false;
        continue;
      }

      const configMatch = clean.match(/^config\s*\(\s*([^,]+)\s*,\s*([^\)]+)\)\s*;?\s*$/i);
      if (configMatch && kernel) {
        kernel.config = {
          mask: parseNumber(configMatch[1]),
          startAddr: parseNumber(configMatch[2]),
          span: spanAt(lineNo, 1, clean.length)
        };
        continue;
      }

      if (/^#pragma\s+/i.test(clean) && kernel) {
        kernel.pragmas.push({
          text: clean,
          span: spanAt(lineNo, 1, clean.length)
        });
        continue;
      }

      const directive = parseDirective(clean, lineNo);
      if (directive && kernel) {
        kernel.directives.push(directive);
        if (directive.kind === 'const') {
          const value = evaluateNumericExpression(directive.value, kernelConstants, new Map());
          if (value === null) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              directive.span,
              `Invalid numeric value for .const '${directive.name}': '${directive.value}'.`,
              'Use integer expressions referencing previously declared constants.'
            ));
          } else {
            kernelConstants.set(directive.name, value);
          }
        }
        continue;
      }

      const inlineCycleMatch = clean.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
      if (inlineCycleMatch && kernel) {
        const statements = parseInlineCycleStatements(
          inlineCycleMatch[1],
          lineNo,
          kernelConstants,
          diagnostics
        );
        kernel.cycles.push({
          index: cycleIndex++,
          statements,
          span: spanAt(lineNo, 1, clean.length)
        });
        continue;
      }

      if (/^cycle\s*\{\s*$/i.test(clean)) {
        inCycle = true;
        cycleConstants = new Map(kernelConstants);
        currentCycle = {
          index: cycleIndex++,
          statements: [],
          span: spanAt(lineNo, 1, clean.length)
        };
        continue;
      }

      const functionCall = parseFunctionCallLine(clean);
      if (functionCall && functions.has(functionCall.name) && kernel) {
        const def = functions.get(functionCall.name)!;
        const instantiated = instantiateFunctionBody(def, functionCall.args, lineNo, diagnostics);
        if (instantiated) {
          const cycleCounter = { value: cycleIndex };
          expandFunctionBodyIntoKernel(
            instantiated,
            kernel,
            functions,
            kernelConstants,
            diagnostics,
            cycleCounter,
            [functionCall.name]
          );
          cycleIndex = cycleCounter.value;
        }
        continue;
      }

      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        `Unexpected kernel statement: '${clean}'`,
        'Expected config, directive, pragma, cycle block, or kernel close.'
      ));
      continue;
    }

    if (inCycle) {
      if (clean === '}') {
        if (kernel && currentCycle) {
          kernel.cycles.push(currentCycle);
        }
        currentCycle = null;
        inCycle = false;
        continue;
      }

      const loopHeader = parseForHeader(clean, lineNo, cycleConstants, new Map(), diagnostics);
      if (loopHeader) {
        const block = collectBlockFromSource(lines, i);
        if (block.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            'Unterminated for loop inside cycle block.',
            'Add a closing brace for for { ... }.'
          ));
          break;
        }

        const shouldContinue = loopHeader.step > 0
          ? (v: number) => v < loopHeader.end
          : (v: number) => v > loopHeader.end;

        for (let value = loopHeader.start; shouldContinue(value); value += loopHeader.step) {
          const bindings = new Map<string, number>();
          bindings.set(loopHeader.variable, value);
          const expanded = expandLoopBody(block.body, cycleConstants, bindings, diagnostics);
          currentCycle?.statements.push(...expanded);
        }

        i = block.endIndex;
        continue;
      }

      const statement = parseCycleStatement(clean, lineNo, rawLine, cycleConstants, new Map());
      if (!statement) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(lineNo, 1, clean.length),
          `Invalid cycle statement: '${clean}'`,
          'Expected @row,col:, row N:, col N:, all:, or for ... in range(...) { ... }.'
        ));
        continue;
      }

      currentCycle?.statements.push(statement);
    }
  }

  if (inCycle) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      'Unterminated cycle block.',
      'Add a closing brace for cycle { ... }.'
    ));
  }

  if (inKernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      'Unterminated kernel block.',
      'Add a closing brace for kernel { ... }.'
    ));
  }

  if (!ast.targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing required target declaration.',
      'Add: target "uma-cgra-v1";'
    ));
  }

  if (!ast.kernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingKernel,
      'error',
      spanAt(1, 1, 1),
      'Missing kernel declaration.',
      'Add: kernel "Name" { ... }'
    ));
  }

  return {
    success: diagnostics.every((d) => d.severity !== 'error'),
    ast,
    diagnostics
  };
}
