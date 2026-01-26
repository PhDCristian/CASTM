import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileSync } from 'fs';
import { useTheme, symbols } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { compileDslToCsv } from '../../../compiler.js';
import { getRelativePath } from '../../utils/files.js';

interface InfoScreenProps {
  file: string;
  onNavigate: (screen: any) => void;
}

export function InfoScreen({ file, onNavigate }: InfoScreenProps) {
  const theme = useTheme();
  const [result, setResult] = useState<any>(null);
  
  useEffect(() => {
    try {
      const content = readFileSync(file, 'utf-8');
      const res = compileDslToCsv(content);
      setResult(res);
    } catch (e) {
      setResult({ success: false, error: String(e) });
    }
  }, [file]);

  useInput((input, key) => {
    if (key.escape || key.return) {
      onNavigate({ type: 'main' });
    }
  });

  if (!result) return <Text>Loading...</Text>;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Program Info</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={theme.dim}>File: </Text>
        <Text color="white">{getRelativePath(file)}</Text>
      </Box>

      {result.success ? (
        <Box flexDirection="column">
          <Panel title="Statistics" borderColor={theme.primary}>
            <Box flexDirection="column">
              <Box>
                <Text color={theme.dim} bold>Status:       </Text>
                <Text color={theme.success}>{symbols.success} Valid</Text>
              </Box>
              <Box>
                <Text color={theme.dim} bold>Max Cycles:   </Text>
                <Text>{result.maxCycles}</Text>
              </Box>
              <Box>
                <Text color={theme.dim} bold>Grid Size:    </Text>
                <Text>{result.suggestedGridSize?.width} x {result.suggestedGridSize?.height}</Text>
              </Box>
              <Box>
                <Text color={theme.dim} bold>Assertions:   </Text>
                <Text>{result.assertions?.length || 0}</Text>
              </Box>
            </Box>
          </Panel>
          
          <Box marginTop={1}>
            <Panel title="Memory Regions" borderColor={theme.accent}>
              {result.memoryRegions && result.memoryRegions.length > 0 ? (
                <Box flexDirection="column">
                   {result.memoryRegions.map((r: any, i: number) => (
                     <Box key={i}>
                       <Text color={theme.accent}>{symbols.bullet} </Text>
                       <Text>{r.name || 'anon'} </Text>
                       <Text color={theme.dim}>@ 0x{r.start.toString(16)} (size: {r.values.length})</Text>
                     </Box>
                   ))}
                </Box>
              ) : (
                <Text color={theme.dim}>No memory regions defined</Text>
              )}
            </Panel>
          </Box>
        </Box>
      ) : (
        <Panel title="Invalid Program" borderColor={theme.error}>
           <Text color={theme.error}>{result.error}</Text>
           {result.line && <Text color={theme.dim}>Line: {result.line}</Text>}
        </Panel>
      )}

      <Box marginTop={1}>
        <Text color={theme.dim}>Press ESC or Enter to back</Text>
      </Box>
    </Box>
  );
}
