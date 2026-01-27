/**
 * OpenEdge DSL Definition Provider
 * 
 * Provides go-to-definition for labels, data arrays, aliases, constants, and functions.
 */

import {
  Location,
  Position,
  Range,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Symbol types we track
interface SymbolLocation {
  name: string;
  line: number;
  startChar: number;
  endChar: number;
  type: 'label' | 'data' | 'alias' | 'const' | 'function';
}

export class DefinitionProvider {
  /**
   * Finds the definition of a symbol at the given position
   */
  provideDefinition(document: TextDocument, position: Position): Location | null {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[position.line];
    
    if (!line) return null;

    // Get word at position
    const word = this.getWordAtPosition(line, position.character);
    if (!word) return null;

    // Find all symbol definitions in the document
    const symbols = this.findSymbols(text);

    // Look for a matching symbol
    const symbol = symbols.find(s => s.name === word);
    if (!symbol) return null;

    return {
      uri: document.uri,
      range: {
        start: { line: symbol.line, character: symbol.startChar },
        end: { line: symbol.line, character: symbol.endChar },
      },
    };
  }

  /**
   * Extracts the word at the given position in a line
   */
  private getWordAtPosition(line: string, character: number): string | null {
    let start = character;
    let end = character;

    // Expand backward
    while (start > 0 && /[\w]/.test(line[start - 1])) {
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
   * Finds all symbol definitions in the document
   */
  private findSymbols(text: string): SymbolLocation[] {
    const symbols: SymbolLocation[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Labels: "label_name: cycle {"
      const labelMatch = trimmed.match(/^(\w+):\s*cycle\s*\{/);
      if (labelMatch) {
        const startChar = line.indexOf(labelMatch[1]);
        symbols.push({
          name: labelMatch[1],
          line: i,
          startChar,
          endChar: startChar + labelMatch[1].length,
          type: 'label',
        });
      }

      // Constants: ".const NAME = value"
      const constMatch = trimmed.match(/^\.const\s+(\w+)\s*=/);
      if (constMatch) {
        const startChar = line.indexOf(constMatch[1]);
        symbols.push({
          name: constMatch[1],
          line: i,
          startChar,
          endChar: startChar + constMatch[1].length,
          type: 'const',
        });
      }

      // Aliases: ".alias name = R0"
      const aliasMatch = trimmed.match(/^\.alias\s+(\w+)\s*=/);
      if (aliasMatch) {
        const startChar = line.indexOf(aliasMatch[1]);
        symbols.push({
          name: aliasMatch[1],
          line: i,
          startChar,
          endChar: startChar + aliasMatch[1].length,
          type: 'alias',
        });
      }

      // Data arrays: ".data name @ address = [...]"
      const dataMatch = trimmed.match(/^\.data\s+(\w+)\s*@/);
      if (dataMatch) {
        const startChar = line.indexOf(dataMatch[1]);
        symbols.push({
          name: dataMatch[1],
          line: i,
          startChar,
          endChar: startChar + dataMatch[1].length,
          type: 'data',
        });
      }

      // Functions: "function name(params) {"
      const funcMatch = trimmed.match(/^function\s+(\w+)\s*\(/);
      if (funcMatch) {
        const startChar = line.indexOf(funcMatch[1]);
        symbols.push({
          name: funcMatch[1],
          line: i,
          startChar,
          endChar: startChar + funcMatch[1].length,
          type: 'function',
        });
      }
    }

    return symbols;
  }
}
