import { describe, it, expect } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionProvider } from '../cli/lsp/completion';

describe('LSP completion - memory sugar snippets', () => {
  it('offers memory sugar snippets inside cycle blocks', () => {
    const provider = new CompletionProvider();
    const source = `kernel "K" {
  config(0xF, 0);
  cycle {
    
  }
}`;

    const doc = TextDocument.create('file:///test.edsl', 'openedge-dsl', 1, source);
    const completions = provider.provideCompletions(doc, { line: 3, character: 4 });
    const labels = new Set(completions.map(c => c.label));

    expect(labels.has('load sugar')).toBe(true);
    expect(labels.has('store sugar')).toBe(true);
    expect(labels.has('raw load sugar')).toBe(true);
    expect(labels.has('raw store sugar')).toBe(true);
  });
});
