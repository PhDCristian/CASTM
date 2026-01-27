/**
 * OpenEdge DSL Diagnostics Provider
 * 
 * Parses DSL code and reports syntax/semantic errors to the LSP client.
 */

import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Position,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { compileDslToCsv } from '../../compiler.js';
import { INSTRUCTION_DB } from '../tui/intelligence/instruction-db.js';

// Known opcodes from the instruction database
const KNOWN_OPCODES = new Set(Object.keys(INSTRUCTION_DB));

// Valid registers
const VALID_REGISTERS = new Set([
  'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
  'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15',
]);

// Known directives
const KNOWN_DIRECTIVES = new Set([
  '.const', '.alias', '.data', '.io_load', '.io_store', '.limit', '.assert',
]);

// Known keywords
const KNOWN_KEYWORDS = new Set([
  'kernel', 'config', 'cycle', 'for', 'while', 'if', 'else', 'function', 'row', 'end',
]);

// Known pragmas
const KNOWN_PRAGMAS = new Set([
  'unroll', 'no_unroll', 'parallel', 'reduce', 'stencil', 'route', 'scan', 'broadcast', 'inline',
]);

export class DiagnosticsProvider {
  /**
   * Validates a DSL document and returns diagnostics
   */
  validate(document: TextDocument, maxProblems: number): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    // Phase 1: Run the compiler to get syntax/semantic errors
    const compileResult = compileDslToCsv(text);
    
    if (!compileResult.success && compileResult.error) {
      const lineNum = compileResult.line !== undefined ? compileResult.line - 1 : 0;
      const line = lines[lineNum] || '';
      
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: Math.max(0, lineNum), character: 0 },
          end: { line: Math.max(0, lineNum), character: line.length },
        },
        message: compileResult.error,
        source: 'openedge',
      });
    }

    // Phase 2: Line-by-line linting for additional warnings
    for (let i = 0; i < lines.length && diagnostics.length < maxProblems; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Check for unknown pragmas
      if (trimmed.startsWith('#pragma')) {
        const pragmaMatch = trimmed.match(/#pragma\s+(\w+)/);
        if (pragmaMatch) {
          const pragmaName = pragmaMatch[1].toLowerCase();
          if (!KNOWN_PRAGMAS.has(pragmaName)) {
            const startChar = line.indexOf(pragmaMatch[1]);
            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range: {
                start: { line: i, character: startChar },
                end: { line: i, character: startChar + pragmaMatch[1].length },
              },
              message: `Unknown pragma '${pragmaMatch[1]}'. Known pragmas: ${Array.from(KNOWN_PRAGMAS).join(', ')}`,
              source: 'openedge',
            });
          }
        }
      }

      // Check for unknown directives
      if (trimmed.startsWith('.')) {
        const directiveMatch = trimmed.match(/^(\.\w+)/);
        if (directiveMatch) {
          const directiveName = directiveMatch[1].toLowerCase();
          if (!KNOWN_DIRECTIVES.has(directiveName)) {
            const startChar = line.indexOf(directiveMatch[1]);
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: startChar },
                end: { line: i, character: startChar + directiveMatch[1].length },
              },
              message: `Unknown directive '${directiveMatch[1]}'. Known directives: ${Array.from(KNOWN_DIRECTIVES).join(', ')}`,
              source: 'openedge',
            });
          }
        }
      }

      // Check instruction lines (lines with @ prefix or containing opcodes)
      if (trimmed.includes('@') || /^[A-Z]{2,}/.test(trimmed)) {
        this.lintInstructionLine(line, i, diagnostics);
      }
    }

    return diagnostics.slice(0, maxProblems);
  }

  /**
   * Lint an instruction line for common issues
   */
  private lintInstructionLine(line: string, lineNum: number, diagnostics: Diagnostic[]): void {
    const trimmed = line.trim();
    
    // Skip non-instruction lines
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('.')) {
      return;
    }

    // Extract instruction after location prefix (e.g., "@0,0: ADD R0, R1, R2")
    let instructionPart = trimmed;
    if (instructionPart.includes(':')) {
      instructionPart = instructionPart.split(':').slice(1).join(':').trim();
    }

    // Skip if empty after location extraction
    if (!instructionPart) return;

    // Skip control flow keywords
    const lowerInstr = instructionPart.toLowerCase();
    if (lowerInstr.startsWith('kernel') || 
        lowerInstr.startsWith('cycle') || 
        lowerInstr.startsWith('config') ||
        lowerInstr.startsWith('row') ||
        lowerInstr.startsWith('end') ||
        lowerInstr.startsWith('for') ||
        lowerInstr.startsWith('while') ||
        lowerInstr.startsWith('if') ||
        lowerInstr.startsWith('else') ||
        lowerInstr.startsWith('function') ||
        instructionPart === '{' || 
        instructionPart === '}') {
      return;
    }

    // Extract opcode (first word)
    const parts = instructionPart.split(/[\s,;(]+/);
    if (parts.length === 0 || !parts[0]) return;

    const opcode = parts[0].toUpperCase();
    
    // Skip if it looks like a label (ends with :) or is a keyword
    if (opcode.endsWith(':') || KNOWN_KEYWORDS.has(opcode.toLowerCase())) return;

    // Check for unknown opcode
    if (!KNOWN_OPCODES.has(opcode) && opcode !== 'NOP' && opcode !== 'EXIT') {
      // This might be a valid opcode we don't know about - make it a hint
      const startChar = line.indexOf(parts[0]);
      if (startChar >= 0) {
        diagnostics.push({
          severity: DiagnosticSeverity.Hint,
          range: {
            start: { line: lineNum, character: startChar },
            end: { line: lineNum, character: startChar + parts[0].length },
          },
          message: `Unknown opcode '${parts[0]}'. Verify this is a valid instruction.`,
          source: 'openedge',
        });
      }
    }

    // Check for register validity in operands
    for (let i = 1; i < parts.length; i++) {
      const operand = parts[i].toUpperCase();
      // Check if it looks like a register but is invalid
      if (/^R\d+$/.test(operand) && !VALID_REGISTERS.has(operand)) {
        const startChar = line.toUpperCase().indexOf(operand);
        if (startChar >= 0) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: lineNum, character: startChar },
              end: { line: lineNum, character: startChar + operand.length },
            },
            message: `Invalid register '${operand}'. Valid registers are R0-R15.`,
            source: 'openedge',
          });
        }
      }
    }
  }
}
