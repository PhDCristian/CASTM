/**
 * OpenEdge DSL Language Server
 * 
 * Provides IDE features for .dsl files:
 * - Diagnostics (syntax and semantic errors)
 * - Autocompletion (opcodes, registers, data labels)
 * - Hover information (instruction details)
 * - Go to definition (data labels, kernels)
 * - Document symbols (outline)
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  Hover,
  MarkupKind,
  Diagnostic,
  DiagnosticSeverity,
  TextDocumentPositionParams,
  DefinitionParams,
  Location,
  DocumentSymbol,
  SymbolKind,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticsProvider } from './diagnostics.js';
import { CompletionProvider } from './completion.js';
import { HoverProvider } from './hover.js';
import { DefinitionProvider } from './definition.js';
import { SymbolProvider } from './symbols.js';

// Server configuration interface
export interface LSPSettings {
  diagnostics: boolean;
  completion: boolean;
  hover: boolean;
  maxNumberOfProblems: number;
}

const defaultSettings: LSPSettings = {
  diagnostics: true,
  completion: true,
  hover: true,
  maxNumberOfProblems: 100,
};

// Create connection for the server using stdio
// Force stdio mode by injecting --stdio if not present
if (!process.argv.includes('--stdio') && !process.argv.includes('--node-ipc') && !process.argv.includes('--socket')) {
  process.argv.push('--stdio');
}
const connection = createConnection(ProposedFeatures.all);

// Create document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Global settings
let globalSettings: LSPSettings = defaultSettings;
const documentSettings: Map<string, Thenable<LSPSettings>> = new Map();

// Providers
let diagnosticsProvider: DiagnosticsProvider;
let completionProvider: CompletionProvider;
let hoverProvider: HoverProvider;
let definitionProvider: DefinitionProvider;
let symbolProvider: SymbolProvider;

// Track whether client supports configuration
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  // Initialize providers
  diagnosticsProvider = new DiagnosticsProvider();
  completionProvider = new CompletionProvider();
  hoverProvider = new HoverProvider();
  definitionProvider = new DefinitionProvider();
  symbolProvider = new SymbolProvider();

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', '@', ',', ' '],
      },
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      // Code actions for quick fixes (future)
      // codeActionProvider: true,
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  connection.console.log('OpenEdge LSP Server initialized');
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  connection.console.log('OpenEdge LSP Server ready');
});

// Configuration handling
connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    documentSettings.clear();
  } else {
    globalSettings = <LSPSettings>(
      (change.settings.openedge || defaultSettings)
    );
  }
  // Re-validate all open documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<LSPSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'openedge',
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Document lifecycle
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
  // Clear diagnostics for closed document
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

// Validate document and publish diagnostics
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  
  if (!settings.diagnostics) {
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
    return;
  }

  const diagnostics = diagnosticsProvider.validate(
    textDocument,
    settings.maxNumberOfProblems
  );

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Completion handler
connection.onCompletion(
  async (params: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const settings = await getDocumentSettings(params.textDocument.uri);
    if (!settings.completion) {
      return [];
    }

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return completionProvider.provideCompletions(document, params.position);
  }
);

// Completion resolve handler (for documentation)
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return completionProvider.resolveCompletion(item);
});

// Hover handler
connection.onHover(
  async (params: TextDocumentPositionParams): Promise<Hover | null> => {
    const settings = await getDocumentSettings(params.textDocument.uri);
    if (!settings.hover) {
      return null;
    }

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    return hoverProvider.provideHover(document, params.position);
  }
);

// Definition handler
connection.onDefinition(
  (params: DefinitionParams): Location | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    return definitionProvider.provideDefinition(document, params.position);
  }
);

// Document symbols handler
connection.onDocumentSymbol(
  (params): DocumentSymbol[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return symbolProvider.provideSymbols(document);
  }
);

// Start listening
documents.listen(connection);
connection.listen();

// Export for testing
export {
  connection,
  documents,
  validateTextDocument,
  getDocumentSettings,
  LSPSettings,
  defaultSettings,
};
