/**
 * OpenEdge DSL Language Server
 * 
 * Main entry point for the LSP server.
 * Can be used standalone or imported as a module.
 */

// Re-export providers for testing
export { DiagnosticsProvider } from './diagnostics.js';
export { CompletionProvider } from './completion.js';
export { HoverProvider } from './hover.js';
export { DefinitionProvider } from './definition.js';
export { SymbolProvider } from './symbols.js';

// Re-export server types
export type { LSPSettings } from './server.js';

/**
 * Starts the LSP server
 * 
 * This function is called when the 'openedge lsp' command is run.
 * The server communicates via stdio with the LSP client (e.g., VS Code).
 */
export function startServer(): void {
  // The server.ts module auto-starts when imported because it calls
  // connection.listen() at the module level.
  // This is the standard pattern for LSP servers.
  
  // Dynamic import to start the server
  import('./server.js').catch((err) => {
    console.error('Failed to start LSP server:', err);
    process.exit(1);
  });
}

// If this module is run directly, start the server
// This allows: node dist/cli/lsp/index.js
const isMain = process.argv[1]?.includes('lsp');
if (isMain) {
  startServer();
}
