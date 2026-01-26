import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileSync } from 'fs';
import { useTheme, symbols } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { compileDslToCsv } from '../../../compiler.js';
import { getRelativePath } from '../../utils/files.js';

interface CheckScreenProps {
  file: string;
  onNavigate: (screen: any) => void;
}

export function CheckScreen({ file, onNavigate }: CheckScreenProps) {
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

  if (!result) return <Text>Checking...</Text>;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Syntax Check</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={theme.dim}>File: </Text>
        <Text color="white">{getRelativePath(file)}</Text>
      </Box>

      {result.success ? (
        <Panel title="Valid Syntax" borderColor={theme.success}>
          <Box flexDirection="column">
            <Text color={theme.success}>{symbols.success} No errors found.</Text>
            <Text color={theme.dim}>Ready for compilation.</Text>
          </Box>
        </Panel>
      ) : (
        <Panel title="Syntax Error" borderColor={theme.error}>
           <Box flexDirection="column">
             <Text color={theme.error}>{symbols.error} {result.error}</Text>
             {result.line && (
               <Box marginTop={1}>
                 <Text color={theme.dim}>Location: </Text>
                 <Text color={theme.warning}>Line {result.line}</Text>
               </Box>
             )}
             {/* In a real implementation we would show code context here */}
           </Box>
        </Panel>
      )}

      <Box marginTop={1}>
        <Text color={theme.dim}>Press ESC or Enter to back</Text>
      </Box>
    </Box>
  );
}
