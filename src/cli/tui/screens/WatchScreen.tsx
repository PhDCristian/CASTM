import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileSync, watch, existsSync } from 'fs';
import { dirname, basename } from 'path';
import { useTheme, symbols } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { compileDslToCsv } from '../../../compiler.js';
import { getRelativePath, getOutputPath, writeFile } from '../../utils/files.js';

interface WatchScreenProps {
  file: string;
  onNavigate: (screen: any) => void;
}

interface WatchStats {
  compiles: number;
  errors: number;
  lastStatus: 'ok' | 'error';
  startTime: number;
}

export function WatchScreen({ file, onNavigate }: WatchScreenProps) {
  const theme = useTheme();
  const [outputPath] = useState(getOutputPath(file));
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState<WatchStats>({
    compiles: 0,
    errors: 0,
    lastStatus: 'ok',
    startTime: Date.now()
  });
  const [lastCompileResult, setLastCompileResult] = useState<any>(null);

  // Helper to add log
  const addLog = (msg: string) => {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 5));
  };

  // Compile function
  const compile = () => {
    try {
      const content = readFileSync(file, 'utf-8');
      const result = compileDslToCsv(content);
      
      if (result.success) {
        const writeResult = writeFile(outputPath, result.csv!);
        if (writeResult.success) {
          setStats(prev => ({ ...prev, compiles: prev.compiles + 1, lastStatus: 'ok' }));
          setLastCompileResult({
            success: true,
            cycles: result.maxCycles,
            grid: result.suggestedGridSize,
            memory: result.memoryRegions?.length || 0
          });
          addLog(`Compiled successfully`);
        } else {
          setStats(prev => ({ ...prev, errors: prev.errors + 1, lastStatus: 'error' }));
          setLastCompileResult({ success: false, error: writeResult.error });
          addLog(`Write error: ${writeResult.error}`);
        }
      } else {
        setStats(prev => ({ ...prev, compiles: prev.compiles + 1, errors: prev.errors + 1, lastStatus: 'error' }));
        setLastCompileResult({ success: false, error: result.error, line: result.line });
        addLog(`Compilation failed: ${result.error}`);
      }
    } catch (e) {
      setStats(prev => ({ ...prev, errors: prev.errors + 1, lastStatus: 'error' }));
      addLog(`Error: ${e}`);
    }
  };

  // Setup watcher
  useEffect(() => {
    compile(); // Initial compile

    const watcher = watch(file, { persistent: true }, (eventType) => {
      if (eventType === 'change') {
        compile();
      }
    });

    const dirWatcher = watch(dirname(file), { persistent: true }, (eventType, filename) => {
      if (filename === basename(file) && (eventType === 'change' || eventType === 'rename')) {
         // Debounce could be added here
         if (existsSync(file)) compile();
      }
    });

    return () => {
      watcher.close();
      dirWatcher.close();
    };
  }, [file]);

  useInput((input, key) => {
    if (key.escape) {
      onNavigate({ type: 'main' });
    }
  });

  const elapsedTime = Math.floor((Date.now() - stats.startTime) / 1000);
  const timeStr = elapsedTime < 60 ? `${elapsedTime}s` : `${Math.floor(elapsedTime/60)}m ${elapsedTime%60}s`;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Watch Mode</Text>
        <Text color={theme.dim}> • Live</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color={theme.dim}>Watching: </Text>
        <Text color="white">{getRelativePath(file)}</Text>
      </Box>

      {/* Status Bar */}
      <Box 
        borderStyle="round" 
        borderColor={stats.lastStatus === 'ok' ? theme.success : theme.error}
        paddingX={1}
        marginBottom={1}
      >
        <Text color={stats.lastStatus === 'ok' ? theme.success : theme.error}>
          {stats.lastStatus === 'ok' ? symbols.success : symbols.error} {stats.lastStatus.toUpperCase()}
        </Text>
        <Text color={theme.dim}> │ </Text>
        <Text>Compiles: {stats.compiles}</Text>
        <Text color={theme.dim}> │ </Text>
        <Text>Errors: {stats.errors}</Text>
        <Text color={theme.dim}> │ </Text>
        <Text>{timeStr}</Text>
      </Box>

      {/* Last Result Panel */}
      {lastCompileResult && (
        <Box flexDirection="column" marginBottom={1}>
          {lastCompileResult.success ? (
            <Panel title="Last Compilation" borderColor={theme.dim}>
              <Box flexDirection="column">
                <Box><Text color={theme.dim}>Cycles: </Text><Text>{lastCompileResult.cycles ?? 'N/A'}</Text></Box>
                {lastCompileResult.grid && (
                  <Box><Text color={theme.dim}>Grid:   </Text><Text>{lastCompileResult.grid.width}x{lastCompileResult.grid.height}</Text></Box>
                )}
                <Box><Text color={theme.dim}>Memory: </Text><Text>{lastCompileResult.memory ?? 0} regions</Text></Box>
              </Box>
            </Panel>
          ) : (
            <Panel title="Error Detail" borderColor={theme.error}>
               <Text color={theme.error}>{lastCompileResult.error}</Text>
               {lastCompileResult.line && <Text color={theme.dim}>at line {lastCompileResult.line}</Text>}
            </Panel>
          )}
        </Box>
      )}

      {/* Recent Log */}
      <Box flexDirection="column">
        <Text color={theme.dim}>Activity Log:</Text>
        {log.map((l, i) => (
          <Text key={i} color={theme.dim}>{l}</Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.dim}>Press ESC to stop watching</Text>
      </Box>
    </Box>
  );
}
