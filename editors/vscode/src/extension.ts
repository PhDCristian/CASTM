/**
 * OpenEdge DSL VS Code Extension
 * 
 * Provides IDE integration for OpenEdge DSL files using the Language Server Protocol.
 */

import * as path from 'path';
import * as vscode from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // Find the openedge CLI command
  // First try to use the globally installed CLI, then fall back to npx
  const serverCommand = 'openedge';
  const serverArgs = ['lsp'];

  // Server options - spawn the CLI with 'lsp' argument
  const serverOptions: ServerOptions = {
    run: {
      command: serverCommand,
      args: serverArgs,
      transport: TransportKind.stdio,
    },
    debug: {
      command: serverCommand,
      args: serverArgs,
      transport: TransportKind.stdio,
    },
  };

  // Client options
  const clientOptions: LanguageClientOptions = {
    // Register for OpenEdge DSL documents
    documentSelector: [
      { scheme: 'file', language: 'openedge' },
      { scheme: 'untitled', language: 'openedge' },
    ],
    synchronize: {
      // Notify the server about file changes to .dsl files
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.dsl'),
    },
    outputChannelName: 'OpenEdge DSL',
  };

  // Create the language client
  client = new LanguageClient(
    'openedge',
    'OpenEdge DSL Language Server',
    serverOptions,
    clientOptions
  );

  // Register commands
  const restartCommand = vscode.commands.registerCommand(
    'openedge.restartServer',
    async () => {
      await client.stop();
      await client.start();
      vscode.window.showInformationMessage('OpenEdge Language Server restarted');
    }
  );

  const compileCommand = vscode.commands.registerCommand(
    'openedge.compileFile',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const document = editor.document;
      if (document.languageId !== 'openedge') {
        vscode.window.showErrorMessage('Current file is not an OpenEdge DSL file');
        return;
      }

      // Save the document first
      await document.save();

      // Run the compile command
      const terminal = vscode.window.createTerminal('OpenEdge Compile');
      terminal.sendText(`openedge compile "${document.fileName}"`);
      terminal.show();
    }
  );

  context.subscriptions.push(restartCommand, compileCommand);

  // Start the client (and server)
  client.start();

  // Show activation message
  console.log('OpenEdge DSL extension activated');
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
