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

function parseCycleStatement(clean: string, line: number, rawLine: string): CycleStatementAst | null {
  const atMatch = clean.match(/^@\s*(-?\d+)\s*,\s*(-?\d+)\s*:\s*(.+);\s*$/i);
  if (atMatch) {
    const row = parseNumber(atMatch[1]);
    const col = parseNumber(atMatch[2]);
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

  const rowMatch = clean.match(/^row\s+(-?\d+)\s*:\s*(.+);\s*$/i);
  if (rowMatch) {
    const row = parseNumber(rowMatch[1]);
    const payload = rowMatch[2].trim();
    const segments = splitTopLevel(payload, '|').map((s) => s.trim());
    return {
      kind: 'row',
      row,
      instructions: segments.map((segment) => parseInstruction(segment, line, Math.max(1, rawLine.indexOf(segment) + 1))),
      span: spanAt(line, 1, clean.length)
    };
  }

  const colMatch = clean.match(/^col\s+(-?\d+)\s*:\s*(.+);\s*$/i);
  if (colMatch) {
    const col = parseNumber(colMatch[1]);
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
  let inKernel = false;
  let inCycle = false;
  let currentCycle: CycleAst | null = null;
  let cycleIndex = 0;
  const pendingDirectives: DirectiveAst[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i];
    const clean = rawLine.replace(/\/\/.*$/, '').trim();

    if (!clean) continue;

    if (!inKernel) {
      const targetMatch = clean.match(/^target\s+"([^"]+)"\s*;?\s*$/i);
      if (targetMatch) {
        ast.targetProfileId = targetMatch[1];
        continue;
      }

      const kernelMatch = clean.match(/^kernel\s+"([^"]+)"\s*\{\s*$/i);
      if (kernelMatch) {
        kernel = {
          name: kernelMatch[1],
          config: undefined,
          cycles: [],
          directives: [...pendingDirectives],
          pragmas: [],
          span: spanAt(lineNo, 1, clean.length)
        };
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
        kernel.pragmas.push(clean);
        continue;
      }

      const directive = parseDirective(clean, lineNo);
      if (directive && kernel) {
        kernel.directives.push(directive);
        continue;
      }

      if (/^cycle\s*\{\s*$/i.test(clean)) {
        inCycle = true;
        currentCycle = {
          index: cycleIndex++,
          statements: [],
          span: spanAt(lineNo, 1, clean.length)
        };
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

      const statement = parseCycleStatement(clean, lineNo, rawLine);
      if (!statement) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(lineNo, 1, clean.length),
          `Invalid cycle statement: '${clean}'`,
          'Expected @row,col:, row N:, col N:, or all: instruction syntax.'
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
