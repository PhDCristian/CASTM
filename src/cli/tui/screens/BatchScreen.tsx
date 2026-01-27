/**
 * BatchScreen - TUI screen for batch compilation
 * Visual progress bar, parallel compilation, and results summary
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { useTheme, symbols } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { compileDslToCsv } from '../../../compiler.js';
import { readFile, writeFile, getRelativePath } from '../../utils/files.js';

interface BatchScreenProps {
  onNavigate: (screen: any) => void;
  initialPattern?: string;
}

interface FileResult {
  file: string;
  success: boolean;
  error?: string;
  cycles?: number;
  time: number;
}

export function BatchScreen({ onNavigate, initialPattern }: BatchScreenProps) {
  const theme = useTheme();
  const [step, setStep] = useState<'input' | 'scanning' | 'compiling' | 'done'>('input');
  const [pattern, setPattern] = useState(initialPattern || '**/*.dsl');
  const [outputDir, setOutputDir] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [results, setResults] = useState<FileResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingOutput, setEditingOutput] = useState(false);

  // Scan for files
  const scanFiles = async () => {
    setStep('scanning');
    try {
      const matches = await glob(pattern, { nodir: true });
      const dslFiles = matches.filter(f => f.endsWith('.dsl')).sort();
      setFiles(dslFiles);
      
      if (dslFiles.length === 0) {
        setStep('done');
      } else {
        setStep('compiling');
        compileFiles(dslFiles);
      }
    } catch (e) {
      setFiles([]);
      setStep('done');
    }
  };

  // Compile all files
  const compileFiles = async (filesToCompile: string[]) => {
    const newResults: FileResult[] = [];
    
    for (let i = 0; i < filesToCompile.length; i++) {
      setCurrentIndex(i);
      const file = filesToCompile[i];
      const startTime = performance.now();
      
      // Determine output path
      let outPath: string;
      if (outputDir) {
        const relativePath = path.relative(process.cwd(), file);
        outPath = path.join(outputDir, relativePath.replace(/\.dsl$/i, '.csv'));
      } else {
        outPath = file.replace(/\.dsl$/i, '.csv');
      }
      
      // Read and compile
      const readResult = readFile(file);
      if (!readResult.success) {
        newResults.push({
          file,
          success: false,
          error: readResult.error || 'Read failed',
          time: performance.now() - startTime,
        });
        continue;
      }
      
      const result = compileDslToCsv(readResult.content!);
      
      if (!result.success) {
        newResults.push({
          file,
          success: false,
          error: result.error || 'Compilation failed',
          time: performance.now() - startTime,
        });
        continue;
      }
      
      // Write output
      const outDir = path.dirname(outPath);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      
      const writeResult = writeFile(outPath, result.csv!);
      if (!writeResult.success) {
        newResults.push({
          file,
          success: false,
          error: writeResult.error || 'Write failed',
          time: performance.now() - startTime,
        });
        continue;
      }
      
      newResults.push({
        file,
        success: true,
        cycles: result.maxCycles,
        time: performance.now() - startTime,
      });
      
      setResults([...newResults]);
      
      // Small delay for visual feedback
      await new Promise(r => setTimeout(r, 50));
    }
    
    setResults(newResults);
    setStep('done');
  };

  useInput((input, key) => {
    if (step === 'input') {
      if (key.escape) {
        onNavigate({ type: 'main' });
      }
      if (key.return && !editingOutput) {
        if (pattern.trim()) {
          scanFiles();
        }
      }
      if (key.tab) {
        setEditingOutput(!editingOutput);
      }
    } else if (step === 'done') {
      if (key.return || key.escape) {
        onNavigate({ type: 'main' });
      }
    }
  });

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const totalCycles = results.reduce((sum, r) => sum + (r.cycles || 0), 0);
  const progress = files.length > 0 ? Math.round((currentIndex / files.length) * 100) : 0;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>{symbols.folder} Batch Compilation</Text>
      </Box>

      {step === 'input' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.dim}>Enter glob pattern to match DSL files:</Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color={theme.accent}>Pattern: </Text>
            <Box borderStyle="round" borderColor={!editingOutput ? theme.primary : theme.dim} paddingX={1}>
              <TextInput
                value={pattern}
                onChange={setPattern}
                focus={!editingOutput}
              />
            </Box>
          </Box>
          
          <Box marginBottom={1}>
            <Text color={theme.accent}>Output dir: </Text>
            <Box borderStyle="round" borderColor={editingOutput ? theme.primary : theme.dim} paddingX={1}>
              <TextInput
                value={outputDir}
                onChange={setOutputDir}
                placeholder="(same as source)"
                focus={editingOutput}
              />
            </Box>
          </Box>
          
          <Box marginTop={1} flexDirection="column">
            <Text color={theme.dim}>Tab to switch fields • Enter to start • Esc to cancel</Text>
            <Box marginTop={1}>
              <Text color={theme.warning}>Examples: </Text>
              <Text color={theme.dim}>*.dsl  src/**/*.dsl  kernels/*.dsl</Text>
            </Box>
          </Box>
        </Box>
      )}

      {step === 'scanning' && (
        <Box>
          <Text color={theme.warning}>{symbols.info} Scanning for files...</Text>
        </Box>
      )}

      {step === 'compiling' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.warning}>{symbols.info} Compiling {files.length} files...</Text>
          </Box>
          
          {/* Progress bar */}
          <Box marginBottom={1}>
            <Text color={theme.primary}>
              {'█'.repeat(Math.floor(progress / 5))}
              {'░'.repeat(20 - Math.floor(progress / 5))}
            </Text>
            <Text color={theme.dim}> {currentIndex + 1}/{files.length} ({progress}%)</Text>
          </Box>
          
          {/* Current file */}
          <Box>
            <Text color={theme.dim}>Current: </Text>
            <Text>{files[currentIndex] ? getRelativePath(files[currentIndex]) : ''}</Text>
          </Box>
          
          {/* Live results */}
          <Box marginTop={1} flexDirection="column">
            {results.slice(-5).map((r, i) => (
              <Box key={i}>
                <Text color={r.success ? theme.success : theme.error}>
                  {r.success ? '+' : 'x'}
                </Text>
                <Text color={theme.dim}> {getRelativePath(r.file)}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {step === 'done' && (
        <Box flexDirection="column">
          {files.length === 0 ? (
            <Panel title="No Files Found" borderColor={theme.warning}>
              <Text color={theme.warning}>No .dsl files match pattern: {pattern}</Text>
            </Panel>
          ) : (
            <>
              <Panel 
                title={failureCount === 0 ? "Batch Complete" : "Batch Complete (with errors)"} 
                borderColor={failureCount === 0 ? theme.success : theme.warning}
              >
                <Box flexDirection="column">
                  <Box>
                    <Text color={theme.dim} bold>{'Files:     '.padEnd(12)}</Text>
                    <Text>{files.length}</Text>
                  </Box>
                  <Box>
                    <Text color={theme.dim} bold>{'Succeeded: '.padEnd(12)}</Text>
                    <Text color={theme.success}>{successCount}</Text>
                  </Box>
                  <Box>
                    <Text color={theme.dim} bold>{'Failed:    '.padEnd(12)}</Text>
                    <Text color={failureCount > 0 ? theme.error : theme.success}>{failureCount}</Text>
                  </Box>
                  <Box>
                    <Text color={theme.dim} bold>{'Cycles:    '.padEnd(12)}</Text>
                    <Text>{totalCycles}</Text>
                  </Box>
                </Box>
              </Panel>
              
              {/* Show failed files */}
              {failureCount > 0 && (
                <Box marginTop={1} flexDirection="column">
                  <Text color={theme.error} bold>Failed files:</Text>
                  {results.filter(r => !r.success).slice(0, 5).map((r, i) => (
                    <Box key={i} marginLeft={2}>
                      <Text color={theme.error}>x </Text>
                      <Text color={theme.dim}>{getRelativePath(r.file)}</Text>
                      <Text color={theme.error}> - {r.error}</Text>
                    </Box>
                  ))}
                  {failureCount > 5 && (
                    <Text color={theme.dim} marginLeft={2}>...and {failureCount - 5} more</Text>
                  )}
                </Box>
              )}
              
              {/* Show successful files */}
              {successCount > 0 && successCount <= 10 && (
                <Box marginTop={1} flexDirection="column">
                  <Text color={theme.success} bold>Compiled files:</Text>
                  {results.filter(r => r.success).map((r, i) => (
                    <Box key={i} marginLeft={2}>
                      <Text color={theme.success}>+ </Text>
                      <Text color={theme.dim}>{getRelativePath(r.file)}</Text>
                      {r.cycles !== undefined && (
                        <Text color={theme.accent}> ({r.cycles} cycles)</Text>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
          
          <Box marginTop={1}>
            <Text color={theme.dim}>Press Enter to continue</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
