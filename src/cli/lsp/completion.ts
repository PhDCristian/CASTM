/**
 * OpenEdge DSL Completion Provider
 * 
 * Provides autocomplete suggestions for opcodes, registers, directives, and pragmas.
 */

import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  Position,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { INSTRUCTION_DB, InstructionDef } from '../tui/intelligence/instruction-db.js';

// Category icons for completion items
const CATEGORY_ICONS: Record<string, string> = {
  ALU: '🔢',
  Memory: '💾',
  Control: '🔀',
  System: '⚙️',
};

// Register completions (R0-R15)
const REGISTER_COMPLETIONS: CompletionItem[] = Array.from({ length: 16 }, (_, i) => ({
  label: `R${i}`,
  kind: CompletionItemKind.Variable,
  detail: `Register ${i}`,
  documentation: {
    kind: MarkupKind.Markdown,
    value: `General-purpose register **R${i}**\n\nCGRA registers are 32-bit and local to each Processing Element (PE).`,
  },
  sortText: `0${i.toString().padStart(2, '0')}`, // Sort R0-R15 in order
}));

// Directive completions
const DIRECTIVE_COMPLETIONS: CompletionItem[] = [
  {
    label: '.const',
    kind: CompletionItemKind.Keyword,
    detail: 'Define a constant',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n.const NAME = value\n```\n\nDefines a compile-time constant.',
    },
    insertText: '.const ${1:NAME} = ${2:value}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '.alias',
    kind: CompletionItemKind.Keyword,
    detail: 'Define a register alias',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n.alias name = R0\n```\n\nCreates a named alias for a register.',
    },
    insertText: '.alias ${1:name} = ${2:R0}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '.data',
    kind: CompletionItemKind.Keyword,
    detail: 'Define data array',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n.data name @ 0x100 = [1, 2, 3, 4]\n```\n\nDefines a named data array in memory.',
    },
    insertText: '.data ${1:name} @ ${2:0x100} = [${3:values}]',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '.io_load',
    kind: CompletionItemKind.Keyword,
    detail: 'Define I/O load addresses',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n.io_load = [0x000, 0x100]\n```\n\nSpecifies memory addresses for input data loading.',
    },
    insertText: '.io_load = [${1:addresses}]',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '.io_store',
    kind: CompletionItemKind.Keyword,
    detail: 'Define I/O store addresses',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n.io_store = [0x200, 0x300]\n```\n\nSpecifies memory addresses for output data storage.',
    },
    insertText: '.io_store = [${1:addresses}]',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '.limit',
    kind: CompletionItemKind.Keyword,
    detail: 'Set cycle limit',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n.limit = 1000\n```\n\nSets the maximum number of execution cycles.',
    },
    insertText: '.limit = ${1:1000}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '.assert',
    kind: CompletionItemKind.Keyword,
    detail: 'Define an assertion',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n.assert mem[0x200] == 42\n```\n\nDefines a runtime assertion for testing.',
    },
    insertText: '.assert ${1:condition}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
];

// Pragma completions
const PRAGMA_COMPLETIONS: CompletionItem[] = [
  {
    label: '#pragma unroll',
    kind: CompletionItemKind.Keyword,
    detail: 'Unroll loop',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n#pragma unroll(4)\nfor i in range(0, 16) { ... }\n```\n\nUnrolls the following loop by the specified factor.',
    },
    insertText: '#pragma unroll(${1:factor})',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '#pragma no_unroll',
    kind: CompletionItemKind.Keyword,
    detail: 'Disable loop unrolling',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n#pragma no_unroll\nfor i in range(0, n) { ... }\n```\n\nPrevents automatic loop unrolling.',
    },
  },
  {
    label: '#pragma parallel',
    kind: CompletionItemKind.Keyword,
    detail: 'Parallelize loop',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n#pragma parallel\nfor i in range(0, 4) { ... }\n```\n\nDistributes loop iterations across PEs.',
    },
  },
  {
    label: '#pragma reduce',
    kind: CompletionItemKind.Keyword,
    detail: 'Reduction pattern',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n#pragma reduce(ADD, R0, R1)\n```\n\nGenerates a reduction tree across PEs.',
    },
    insertText: '#pragma reduce(${1|ADD,MUL,AND,OR,XOR|}, ${2:srcReg}, ${3:dstReg})',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '#pragma stencil',
    kind: CompletionItemKind.Keyword,
    detail: 'Stencil pattern',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n#pragma stencil(cross, ADD, R0, R1)\n```\n\nGenerates a stencil computation pattern.',
    },
    insertText: '#pragma stencil(${1|cross,box|}, ${2:operation}, ${3:srcReg}, ${4:dstReg})',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '#pragma route',
    kind: CompletionItemKind.Keyword,
    detail: 'Data routing pattern',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n#pragma route(@0,0) -> (@1,1) payload(R0) accum(R1)\n```\n\nGenerates explicit data routing between PEs.',
    },
    insertText: '#pragma route(@${1:0},${2:0}) -> (@${3:1},${4:1}) payload(${5:R0}) accum(${6:R1})',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '#pragma scan',
    kind: CompletionItemKind.Keyword,
    detail: 'Prefix scan pattern',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n#pragma scan(ADD, R0, R1, right)\n```\n\nGenerates a prefix scan (inclusive/exclusive) pattern.',
    },
    insertText: '#pragma scan(${1|ADD,MUL|}, ${2:srcReg}, ${3:dstReg}, ${4|right,left,down,up|})',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: '#pragma broadcast',
    kind: CompletionItemKind.Keyword,
    detail: 'Broadcast value',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\n#pragma broadcast(value=R0, from=@0,0, to=row)\n```\n\nBroadcasts a value from one PE to others.',
    },
    insertText: '#pragma broadcast(value=${1:R0}, from=@${2:0},${3:0}, to=${4|row,col,all|})',
    insertTextFormat: InsertTextFormat.Snippet,
  },
];

// Keyword completions
const KEYWORD_COMPLETIONS: CompletionItem[] = [
  {
    label: 'kernel',
    kind: CompletionItemKind.Keyword,
    detail: 'Define kernel',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\nkernel "MyKernel" {\n  ...\n}\n```\n\nDefines a CGRA kernel program.',
    },
    insertText: 'kernel "${1:KernelName}" {\n\t${0}\n}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: 'config',
    kind: CompletionItemKind.Keyword,
    detail: 'Configure kernel',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\nconfig(0xF, 0);\n```\n\nSets PE mask and start address.',
    },
    insertText: 'config(${1:0xF}, ${2:0});',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: 'cycle',
    kind: CompletionItemKind.Keyword,
    detail: 'Define cycle block',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\ncycle {\n  @0,0: ADD R0, R1, R2;\n}\n```\n\nDefines a single execution cycle.',
    },
    insertText: 'cycle {\n\t${0}\n}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: 'for',
    kind: CompletionItemKind.Keyword,
    detail: 'For loop',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\nfor i in range(0, 10) {\n  cycle { ... }\n}\n```\n\nIterates over a range of values.',
    },
    insertText: 'for ${1:i} in range(${2:0}, ${3:10}) {\n\t${0}\n}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: 'while',
    kind: CompletionItemKind.Keyword,
    detail: 'While loop',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\nwhile R0 != 0 at @0,0 {\n  cycle { ... }\n}\n```\n\nLoops while condition is true.',
    },
    insertText: 'while ${1:R0} ${2|!=,==,<,>,<=,>=|} ${3:0} at @${4:0},${5:0} {\n\t${0}\n}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: 'if',
    kind: CompletionItemKind.Keyword,
    detail: 'Conditional',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\nif R0 == 0 at @0,0 {\n  cycle { ... }\n}\n```\n\nConditional execution.',
    },
    insertText: 'if ${1:R0} ${2|==,!=,<,>,<=,>=|} ${3:0} at @${4:0},${5:0} {\n\t${0}\n}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: 'function',
    kind: CompletionItemKind.Keyword,
    detail: 'Define function',
    documentation: {
      kind: MarkupKind.Markdown,
      value: '```dsl\nfunction myFunc(param1, param2) {\n  ...\n}\n```\n\nDefines a reusable function (macro).',
    },
    insertText: 'function ${1:name}(${2:params}) {\n\t${0}\n}',
    insertTextFormat: InsertTextFormat.Snippet,
  },
];

export class CompletionProvider {
  private opcodeCompletions: CompletionItem[];

  constructor() {
    // Build opcode completions from instruction database
    this.opcodeCompletions = Object.values(INSTRUCTION_DB).map((instr: InstructionDef) => ({
      label: instr.opcode,
      kind: CompletionItemKind.Function,
      detail: `${CATEGORY_ICONS[instr.category] || ''} ${instr.name}`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: this.formatInstructionDoc(instr),
      },
      insertText: this.formatInstructionSnippet(instr),
      insertTextFormat: InsertTextFormat.Snippet,
      sortText: `1${instr.opcode}`, // Sort after registers
      data: { type: 'opcode', opcode: instr.opcode },
    }));
  }

  /**
   * Formats instruction documentation
   */
  private formatInstructionDoc(instr: InstructionDef): string {
    return [
      `## ${instr.name}`,
      '',
      instr.description,
      '',
      `**Category:** ${instr.category}`,
      `**Cycles:** ${instr.cycles}`,
      '',
      '**Syntax:**',
      '```dsl',
      instr.example,
      '```',
    ].join('\n');
  }

  /**
   * Formats instruction as a snippet
   */
  private formatInstructionSnippet(instr: InstructionDef): string {
    if (instr.operands.length === 0) {
      return instr.opcode;
    }
    
    const operandSnippets = instr.operands.map((op, i) => `\${${i + 1}:${op}}`);
    return `${instr.opcode} ${operandSnippets.join(', ')}`;
  }

  /**
   * Provides completions for the current position
   */
  provideCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const linePrefix = line.slice(0, position.character);
    const trimmedPrefix = linePrefix.trimStart();

    // Determine context and return appropriate completions
    const completions: CompletionItem[] = [];

    // At start of line or after whitespace
    if (trimmedPrefix === '' || trimmedPrefix.endsWith(' ')) {
      // Check if inside a cycle block (rough heuristic)
      const beforeCursor = text.slice(0, document.offsetAt(position));
      const cycleMatches = (beforeCursor.match(/cycle\s*\{/g) || []).length;
      const braceCloses = (beforeCursor.match(/\}/g) || []).length;
      const inCycle = cycleMatches > braceCloses;

      if (inCycle) {
        // Inside cycle: offer instructions and location prefix
        completions.push(...this.opcodeCompletions);
        completions.push({
          label: '@',
          kind: CompletionItemKind.Snippet,
          detail: 'PE location prefix',
          insertText: '@${1:row},${2:col}: ${0}',
          insertTextFormat: InsertTextFormat.Snippet,
        });
      } else {
        // Outside cycle: offer keywords, directives, pragmas
        completions.push(...KEYWORD_COMPLETIONS);
        completions.push(...DIRECTIVE_COMPLETIONS);
        completions.push(...PRAGMA_COMPLETIONS);
      }
    }

    // Directive context
    if (trimmedPrefix.startsWith('.')) {
      completions.push(...DIRECTIVE_COMPLETIONS);
    }

    // Pragma context
    if (trimmedPrefix.startsWith('#')) {
      completions.push(...PRAGMA_COMPLETIONS);
    }

    // After @ (location prefix)
    if (linePrefix.includes('@') && linePrefix.includes(':')) {
      // After location, offer opcodes
      completions.push(...this.opcodeCompletions);
    }

    // Register context (after comma or specific keywords)
    if (/,\s*$/.test(linePrefix) || /^@[\d,]+:\s*\w+\s+/.test(trimmedPrefix)) {
      completions.push(...REGISTER_COMPLETIONS);
    }

    // If typing an opcode directly
    const opcodeMatch = trimmedPrefix.match(/^([A-Z]+)$/i);
    if (opcodeMatch) {
      completions.push(...this.opcodeCompletions);
    }

    return completions;
  }

  /**
   * Resolves additional details for a completion item
   */
  resolveCompletion(item: CompletionItem): CompletionItem {
    // Could fetch additional documentation here if needed
    return item;
  }
}
