import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { readFileSync } from 'fs';
import { useTheme, symbols } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { compileDslToCsv } from '../../../compiler.js';
import { getRelativePath, getOutputPath, writeFile } from '../../utils/files.js';
import { addRecentFile } from '../../config/store.js';

interface CompileScreenProps {
  file: string;
  onNavigate: (screen: any) => void;
}

export function CompileScreen({ file, onNavigate }: CompileScreenProps) {
  const theme = useTheme();
  const [step, setStep] = useState<'input' | 'compiling' | 'success' | 'error'>('input');
  const [outputPath, setOutputPath] = useState(getOutputPath(file));
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  
  // Handle compilation
  const runCompilation = async () => {
    setStep('compiling');
    const startTime = performance.now();
    
    // Small delay to allow UI render
    await new Promise(r => setTimeout(r, 100));

    try {
      const content = readFileSync(file, 'utf-8');
      const result = compileDslToCsv(content);
      
      if (result.success) {
        const writeResult = writeFile(outputPath, result.csv!);
        
        if (writeResult.success) {
          const endTime = performance.now();
          setStats({
            output: getRelativePath(outputPath),
            time: endTime - startTime,
            cycles: result.maxCycles,
            grid: result.suggestedGridSize,
            memory: result.memoryRegions?.length || 0
          });
          addRecentFile(file);
          setStep('success');
        } else {
          setError(writeResult.error || 'Write failed');
          setStep('error');
        }
      } else {
        setError(result.error || 'Compilation failed');
        setStep('error');
      }
    } catch (e) {
      setError(String(e));
      setStep('error');
    }
  };

  useInput((input, key) => {
    if (step === 'input') {
      if (key.return) {
        runCompilation();
      }
      if (key.escape) {
        onNavigate({ type: 'main' });
      }
    } else if (step === 'success' || step === 'error') {
      if (key.return || key.escape) {
        onNavigate({ type: 'main' });
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Compile Configuration</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color={theme.dim}>Source: </Text>
        <Text color="white">{getRelativePath(file)}</Text>
      </Box>

      {step === 'input' && (
        <Box flexDirection="column">
          <Text>Output path:</Text>
          <Box borderStyle="round" borderColor={theme.primary} paddingX={1}>
            <TextInput 
              value={outputPath} 
              onChange={setOutputPath}
              onSubmit={runCompilation}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={theme.dim}>Press Enter to compile</Text>
          </Box>
        </Box>
      )}

      {step === 'compiling' && (
        <Box>
          <Text color={theme.warning}>{symbols.info} Compiling...</Text>
        </Box>
      )}

      {step === 'success' && stats && (
        <Box flexDirection="column">
          <Panel title="Compilation Successful" borderColor={theme.success}>
            <Box flexDirection="column">
              <Box>
                <Text color={theme.dim} bold>Output:   </Text>
                <Text>{stats.output}</Text>
              </Box>
              <Box>
                <Text color={theme.dim} bold>Time:     </Text>
                <Text>{stats.time.toFixed(0)}ms</Text>
              </Box>
              <Box>
                <Text color={theme.dim} bold>Cycles:   </Text>
                <Text>{stats.cycles ?? 'N/A'}</Text>
              </Box>
              {stats.grid && (
                <Box>
                  <Text color={theme.dim} bold>Grid:     </Text>
                  <Text>{stats.grid.width}x{stats.grid.height}</Text>
                </Box>
              )}
              <Box>
                <Text color={theme.dim} bold>Memory:   </Text>
                <Text>{stats.memory ?? 0} regions</Text>
              </Box>
            </Box>
          </Panel>
          <Text color={theme.dim} marginTop={1}>Press Enter to continue</Text>
        </Box>
      )}

      {step === 'error' && (
        <Box flexDirection="column">
          <Panel title="Error" borderColor={theme.error}>
            <Text color={theme.error}>{error}</Text>
          </Panel>
          <Text color={theme.dim} marginTop={1}>Press Enter to continue</Text>
        </Box>
      )}
    </Box>
  );
}
