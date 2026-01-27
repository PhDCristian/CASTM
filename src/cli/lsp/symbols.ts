/**
 * OpenEdge DSL Symbol Provider
 * 
 * Provides document outline (symbols) for navigation.
 */

import {
  DocumentSymbol,
  SymbolKind,
  Range,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';

export class SymbolProvider {
  /**
   * Provides document symbols for outline view
   */
  provideSymbols(document: TextDocument): DocumentSymbol[] {
    const text = document.getText();
    const lines = text.split('\n');
    const symbols: DocumentSymbol[] = [];

    // Track kernel for nesting
    let kernelSymbol: DocumentSymbol | null = null;
    let braceDepth = 0;
    let inKernel = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Track brace depth
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      // Kernel definition
      const kernelMatch = trimmed.match(/^kernel\s*(?:"([^"]+)")?/);
      if (kernelMatch) {
        const kernelName = kernelMatch[1] || 'Untitled';
        const kernelStart = line.indexOf('kernel');
        
        kernelSymbol = {
          name: kernelName,
          kind: SymbolKind.Module,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length }, // Will be updated
          },
          selectionRange: {
            start: { line: i, character: kernelStart },
            end: { line: i, character: kernelStart + 'kernel'.length + (kernelMatch[1] ? kernelMatch[1].length + 3 : 0) },
          },
          children: [],
        };
        symbols.push(kernelSymbol);
        inKernel = true;
      }

      // Function definition (outside kernel)
      const funcMatch = trimmed.match(/^function\s+(\w+)\s*\(([^)]*)\)/);
      if (funcMatch) {
        const funcStart = line.indexOf('function');
        const symbol: DocumentSymbol = {
          name: `${funcMatch[1]}(${funcMatch[2]})`,
          kind: SymbolKind.Function,
          detail: 'function',
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: funcStart },
            end: { line: i, character: funcStart + 'function'.length + 1 + funcMatch[1].length },
          },
        };
        symbols.push(symbol);
      }

      // Constants
      const constMatch = trimmed.match(/^\.const\s+(\w+)\s*=\s*(.+)/);
      if (constMatch) {
        const constStart = line.indexOf('.const');
        const symbol: DocumentSymbol = {
          name: constMatch[1],
          kind: SymbolKind.Constant,
          detail: constMatch[2].replace(/;$/, '').trim(),
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: constStart },
            end: { line: i, character: constStart + '.const'.length + 1 + constMatch[1].length },
          },
        };
        symbols.push(symbol);
      }

      // Aliases
      const aliasMatch = trimmed.match(/^\.alias\s+(\w+)\s*=\s*(\w+)/);
      if (aliasMatch) {
        const aliasStart = line.indexOf('.alias');
        const symbol: DocumentSymbol = {
          name: aliasMatch[1],
          kind: SymbolKind.Variable,
          detail: `→ ${aliasMatch[2]}`,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: aliasStart },
            end: { line: i, character: aliasStart + '.alias'.length + 1 + aliasMatch[1].length },
          },
        };
        symbols.push(symbol);
      }

      // Data arrays
      const dataMatch = trimmed.match(/^\.data\s+(\w+)\s*@\s*(0x[\da-fA-F]+|\d+)/);
      if (dataMatch) {
        const dataStart = line.indexOf('.data');
        const symbol: DocumentSymbol = {
          name: dataMatch[1],
          kind: SymbolKind.Array,
          detail: `@ ${dataMatch[2]}`,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: dataStart },
            end: { line: i, character: dataStart + '.data'.length + 1 + dataMatch[1].length },
          },
        };
        symbols.push(symbol);
      }

      // Labels with cycles
      const labelMatch = trimmed.match(/^(\w+):\s*cycle/);
      if (labelMatch && kernelSymbol) {
        const labelStart = line.indexOf(labelMatch[1]);
        const symbol: DocumentSymbol = {
          name: labelMatch[1],
          kind: SymbolKind.Key,
          detail: 'label',
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: labelStart },
            end: { line: i, character: labelStart + labelMatch[1].length },
          },
        };
        kernelSymbol.children?.push(symbol);
      }

      // Cycles (inside kernel)
      const cycleMatch = trimmed.match(/^cycle\s*\{/);
      if (cycleMatch && kernelSymbol && inKernel) {
        const cycleStart = line.indexOf('cycle');
        const cycleNum = kernelSymbol.children?.filter(c => c.kind === SymbolKind.Event).length || 0;
        const symbol: DocumentSymbol = {
          name: `cycle ${cycleNum}`,
          kind: SymbolKind.Event,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: cycleStart },
            end: { line: i, character: cycleStart + 'cycle'.length },
          },
        };
        kernelSymbol.children?.push(symbol);
      }

      // For loops
      const forMatch = trimmed.match(/^for\s+(\w+)\s+in\s+range\(([^)]+)\)/);
      if (forMatch && kernelSymbol && inKernel) {
        const forStart = line.indexOf('for');
        const symbol: DocumentSymbol = {
          name: `for ${forMatch[1]}`,
          kind: SymbolKind.Namespace,
          detail: `range(${forMatch[2]})`,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: forStart },
            end: { line: i, character: forStart + 'for'.length + 1 + forMatch[1].length },
          },
        };
        kernelSymbol.children?.push(symbol);
      }

      // While loops
      const whileMatch = trimmed.match(/^while\s+(.+)\s+at\s+@/);
      if (whileMatch && kernelSymbol && inKernel) {
        const whileStart = line.indexOf('while');
        const symbol: DocumentSymbol = {
          name: 'while',
          kind: SymbolKind.Namespace,
          detail: whileMatch[1],
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: whileStart },
            end: { line: i, character: whileStart + 'while'.length },
          },
        };
        kernelSymbol.children?.push(symbol);
      }

      // Pragmas
      const pragmaMatch = trimmed.match(/^#pragma\s+(\w+)/);
      if (pragmaMatch) {
        const pragmaStart = line.indexOf('#pragma');
        const symbol: DocumentSymbol = {
          name: `#pragma ${pragmaMatch[1]}`,
          kind: SymbolKind.Property,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          selectionRange: {
            start: { line: i, character: pragmaStart },
            end: { line: i, character: pragmaStart + '#pragma'.length + 1 + pragmaMatch[1].length },
          },
        };
        
        // Add to kernel if we're inside, otherwise to root
        if (kernelSymbol && inKernel) {
          kernelSymbol.children?.push(symbol);
        } else {
          symbols.push(symbol);
        }
      }

      braceDepth += openBraces - closeBraces;
    }

    // Update kernel end range if we found one
    if (kernelSymbol) {
      kernelSymbol.range.end = { line: lines.length - 1, character: lines[lines.length - 1]?.length || 0 };
    }

    return symbols;
  }
}
