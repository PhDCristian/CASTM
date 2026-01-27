/**
 * OpenEdge DSL Hover Provider
 * 
 * Shows documentation on hover for opcodes, directives, registers, and pragmas.
 */

import {
  Hover,
  MarkupKind,
  Position,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { INSTRUCTION_DB, InstructionDef } from '../tui/intelligence/instruction-db.js';

// Category colors for display
const CATEGORY_BADGES: Record<string, string> = {
  ALU: '`ALU`',
  Memory: '`Memory`',
  Control: '`Control`',
  System: '`System`',
};

// Register descriptions
const REGISTER_DOCS: Record<string, string> = Object.fromEntries(
  Array.from({ length: 16 }, (_, i) => [
    `R${i}`,
    `**R${i}** - General-purpose 32-bit register\n\nLocal to each Processing Element (PE). Can hold data or addresses.`,
  ])
);

// Directive documentation
const DIRECTIVE_DOCS: Record<string, string> = {
  '.const': `**Constant Definition**\n\nDefines a compile-time constant that can be used throughout the code.\n\n\`\`\`dsl\n.const SIZE = 16\n.const MASK = 0xFF\n\`\`\``,
  '.alias': `**Register Alias**\n\nCreates a named alias for a register, improving code readability.\n\n\`\`\`dsl\n.alias sum = R0\n.alias temp = R1\n\`\`\``,
  '.data': `**Data Array Definition**\n\nDefines a named array in memory at a specific address.\n\n\`\`\`dsl\n.data input @ 0x100 = [1, 2, 3, 4]\n.data matrix @ 0x200 = [[1,2],[3,4]]  // 2D array\n\`\`\``,
  '.io_load': `**I/O Load Configuration**\n\nSpecifies memory addresses for loading input data.\n\n\`\`\`dsl\n.io_load = [0x000, 0x100, 0x200]\n\`\`\``,
  '.io_store': `**I/O Store Configuration**\n\nSpecifies memory addresses for storing output data.\n\n\`\`\`dsl\n.io_store = [0x300, 0x400]\n\`\`\``,
  '.limit': `**Cycle Limit**\n\nSets the maximum number of execution cycles.\n\n\`\`\`dsl\n.limit = 1000\n\`\`\``,
  '.assert': `**Runtime Assertion**\n\nDefines a condition that must be true after execution.\n\n\`\`\`dsl\n.assert mem[0x200] == 42\n.assert output[0] == expected[0]\n\`\`\``,
};

// Pragma documentation
const PRAGMA_DOCS: Record<string, string> = {
  'unroll': `**Loop Unrolling**\n\nUnrolls the following loop by the specified factor.\n\n\`\`\`dsl\n#pragma unroll(4)\nfor i in range(0, 16) { ... }\n\`\`\`\n\nReduces loop overhead but increases code size.`,
  'no_unroll': `**Disable Unrolling**\n\nPrevents automatic loop unrolling for the following loop.\n\n\`\`\`dsl\n#pragma no_unroll\nfor i in range(0, n) { ... }\n\`\`\``,
  'parallel': `**Parallel Execution**\n\nDistributes loop iterations across multiple PEs.\n\n\`\`\`dsl\n#pragma parallel\nfor i in range(0, 4) { ... }\n\`\`\`\n\nSupports \`collapse(N)\` modifier for nested loops.`,
  'reduce': `**Reduction Pattern**\n\nGenerates an efficient reduction tree across PEs.\n\n\`\`\`dsl\n#pragma reduce(ADD, R0, R1)\n\`\`\`\n\nSupported operations: ADD, MUL, AND, OR, XOR`,
  'stencil': `**Stencil Pattern**\n\nGenerates a stencil computation pattern for neighboring elements.\n\n\`\`\`dsl\n#pragma stencil(cross, ADD, R0, R1)\n\`\`\`\n\nPatterns: \`cross\` (4 neighbors), \`box\` (8 neighbors)`,
  'route': `**Data Routing**\n\nExplicit data routing between PEs with optional accumulation.\n\n\`\`\`dsl\n#pragma route(@0,0) -> (@1,1) payload(R0) accum(R1)\n\`\`\``,
  'scan': `**Prefix Scan**\n\nGenerates inclusive/exclusive prefix scan pattern.\n\n\`\`\`dsl\n#pragma scan(ADD, R0, R1, right)\n\`\`\`\n\nDirections: right, left, down, up`,
  'broadcast': `**Value Broadcast**\n\nBroadcasts a value from one PE to others.\n\n\`\`\`dsl\n#pragma broadcast(value=R0, from=@0,0, to=row)\n\`\`\`\n\nScopes: row, col, all`,
  'inline': `**Function Inlining**\n\nMarks a function for inline expansion.\n\n\`\`\`dsl\n#pragma inline\nfunction compute(x) { ... }\n\`\`\``,
};

// Keyword documentation
const KEYWORD_DOCS: Record<string, string> = {
  'kernel': `**Kernel Definition**\n\nDefines a CGRA kernel program.\n\n\`\`\`dsl\nkernel "MatrixMultiply" {\n  config(0xF, 0);\n  cycle { ... }\n}\n\`\`\``,
  'config': `**Kernel Configuration**\n\nSets the PE mask and program start address.\n\n\`\`\`dsl\nconfig(0xF, 0);  // All PEs, start at address 0\n\`\`\`\n\nMask bits enable specific PEs in the array.`,
  'cycle': `**Cycle Block**\n\nDefines instructions for a single execution cycle.\n\n\`\`\`dsl\ncycle {\n  @0,0: ADD R0, R1, R2;\n  @0,1: MUL R3, R4, R5;\n}\n\`\`\`\n\nInstructions in a cycle execute in parallel.`,
  'for': `**For Loop**\n\nIterates over a range of values.\n\n\`\`\`dsl\nfor i in range(0, 10) {\n  cycle { ... }\n}\n\`\`\`\n\nCan be unrolled or parallelized with pragmas.`,
  'while': `**While Loop**\n\nLoops while a condition is true.\n\n\`\`\`dsl\nwhile R0 != 0 at @0,0 {\n  cycle { ... }\n}\n\`\`\`\n\nCondition is evaluated at the specified PE.`,
  'if': `**Conditional**\n\nConditional execution based on a condition.\n\n\`\`\`dsl\nif R0 == 0 at @0,0 {\n  cycle { ... }\n} else {\n  cycle { ... }\n}\n\`\`\``,
  'function': `**Function Definition**\n\nDefines a reusable function (inline macro).\n\n\`\`\`dsl\nfunction loadPair(addr, reg1, reg2) {\n  @0,0: LWI reg1, addr[0];\n  @0,1: LWI reg2, addr[1];\n}\n\`\`\``,
  'range': `**Range Generator**\n\nGenerates a sequence of integers for iteration.\n\n\`\`\`dsl\nrange(0, 10)      // 0, 1, 2, ..., 9\nrange(0, 10, 2)   // 0, 2, 4, 6, 8\n\`\`\``,
};

export class HoverProvider {
  /**
   * Provides hover information at the given position
   */
  provideHover(document: TextDocument, position: Position): Hover | null {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[position.line];
    
    if (!line) return null;

    // Get word at position
    const word = this.getWordAtPosition(line, position.character);
    if (!word) return null;

    // Try to find documentation for the word
    const docs = this.findDocumentation(word, line);
    if (!docs) return null;

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: docs,
      },
    };
  }

  /**
   * Extracts the word at the given position in a line
   */
  private getWordAtPosition(line: string, character: number): string | null {
    // Handle pragma names (e.g., "#pragma unroll")
    const pragmaMatch = line.match(/#pragma\s+(\w+)/);
    if (pragmaMatch) {
      const pragmaStart = line.indexOf(pragmaMatch[1]);
      const pragmaEnd = pragmaStart + pragmaMatch[1].length;
      if (character >= pragmaStart && character <= pragmaEnd) {
        return pragmaMatch[1];
      }
      // Also match the #pragma itself
      if (character <= pragmaStart) {
        return '#pragma';
      }
    }

    // Handle directives (e.g., ".const")
    const directiveMatch = line.match(/^\s*(\.\w+)/);
    if (directiveMatch) {
      const directiveStart = line.indexOf(directiveMatch[1]);
      const directiveEnd = directiveStart + directiveMatch[1].length;
      if (character >= directiveStart && character <= directiveEnd) {
        return directiveMatch[1];
      }
    }

    // Match word at position (alphanumeric + underscore)
    let start = character;
    let end = character;

    // Expand backward
    while (start > 0 && /[\w.]/.test(line[start - 1])) {
      start--;
    }

    // Expand forward
    while (end < line.length && /[\w]/.test(line[end])) {
      end++;
    }

    if (start === end) return null;

    return line.slice(start, end);
  }

  /**
   * Finds documentation for a word
   */
  private findDocumentation(word: string, line: string): string | null {
    const upperWord = word.toUpperCase();
    const lowerWord = word.toLowerCase();

    // Check if it's an opcode
    if (INSTRUCTION_DB[upperWord]) {
      return this.formatInstructionHover(INSTRUCTION_DB[upperWord]);
    }

    // Check if it's a register
    if (REGISTER_DOCS[upperWord]) {
      return REGISTER_DOCS[upperWord];
    }

    // Check if it's a directive
    if (DIRECTIVE_DOCS[word]) {
      return DIRECTIVE_DOCS[word];
    }

    // Check if it's a pragma (without #pragma prefix)
    if (PRAGMA_DOCS[lowerWord]) {
      return PRAGMA_DOCS[lowerWord];
    }

    // Check if it's a keyword
    if (KEYWORD_DOCS[lowerWord]) {
      return KEYWORD_DOCS[lowerWord];
    }

    return null;
  }

  /**
   * Formats instruction documentation for hover
   */
  private formatInstructionHover(instr: InstructionDef): string {
    const badge = CATEGORY_BADGES[instr.category] || '';
    
    const lines = [
      `## ${instr.opcode} - ${instr.name}`,
      '',
      badge,
      '',
      instr.description,
      '',
      '---',
      '',
      `| Property | Value |`,
      `|----------|-------|`,
      `| **Cycles** | ${instr.cycles} |`,
      `| **Operands** | ${instr.operands.length > 0 ? instr.operands.join(', ') : 'none'} |`,
      '',
      '**Example:**',
      '```dsl',
      instr.example,
      '```',
    ];

    return lines.join('\n');
  }
}
