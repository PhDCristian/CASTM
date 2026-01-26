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
      <Box marginBottom={1} flexDirection="column">
        <Text color={theme.primary} bold size={20}>PROGRAM ANALYSIS</Text>
        <Text color={theme.dim}>{file}</Text>
      </Box>

      {result.success ? (
        <Box flexDirection="column">
          <Panel title="Statistics" borderColor={theme.primary}>
            <Box flexDirection="column">
              <Box>
                <Text color={theme.dim}>Status      </Text>
                <Text color={theme.success} bold>{symbols.success} VALID</Text>
              </Box>
              <Box>
                <Text color={theme.dim}>Cycles      </Text>
                <Text>{result.maxCycles ?? 'N/A'}</Text>
              </Box>
              <Box>
                <Text color={theme.dim}>Grid        </Text>
                <Text>{result.suggestedGridSize ? `${result.suggestedGridSize.width}x${result.suggestedGridSize.height}` : 'N/A'}</Text>
              </Box>
              <Box>
                <Text color={theme.dim}>Assertions  </Text>
                <Text>{result.assertions?.length || 0}</Text>
              </Box>
            </Box>
          </Panel>
          
          {result.memoryRegions && result.memoryRegions.length > 0 && (
            <Panel title="Memory" borderColor={theme.accent} marginTop={1}>
              <Box flexDirection="column">
                 {result.memoryRegions.map((r: any, i: number) => (
                   <Box key={i} justifyContent="space-between">
                     <Box>
                       <Text color={theme.accent}>{symbols.bullet} </Text>
                       <Text bold>{r.name || 'anon'} </Text>
                     </Box>
                     <Text color={theme.dim}>0x{r.start.toString(16).padStart(4, '0')} [{r.values.length}]</Text>
                   </Box>
                 ))}
              </Box>
            </Panel>
          )}
        </Box>
      ) : (
        <Panel title="Compilation Failed" borderColor={theme.error}>
           <Text color={theme.error} bold>ERROR</Text>
           <Text color="white">{result.error}</Text>
           {result.line && (
             <Box marginTop={1}>
               <Text color={theme.dim}>at line {result.line}</Text>
             </Box>
           )}
        </Panel>
      )}

      <Box marginTop={1}>
        <Box backgroundColor="#333333" paddingX={1} marginRight={1}>
          <Text color="white"> ESC </Text>
        </Box>
        <Text color={theme.dim}>Back to menu</Text>
      </Box>
    </Box>
  );
}
