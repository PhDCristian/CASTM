import React from 'react';
import { Box, Text } from 'ink';
import { useTheme, symbols } from '../theme.js';

interface StatusBarProps {
  status?: string;
  file?: string;
  mode?: string;
}

export function StatusBar({ status = 'IDLE', file, mode = 'NORMAL' }: StatusBarProps) {
  const theme = useTheme();
  
  // Colors
  const modeBg = theme.primary;
  const modeFg = '#000000';
  const statusBg = theme.dim; // More subtle
  const statusFg = '#ffffff';

  return (
    <Box width="100%" height={1} justifyContent="space-between">
      {/* Left: Mode & File */}
      <Box>
        <Box backgroundColor={modeBg} paddingX={2} marginRight={1}>
          <Text color={modeFg} bold>{mode}</Text>
        </Box>
        
        {file && (
          <Box paddingX={1}>
            <Text color={theme.dim}>{symbols.file} {file}</Text>
          </Box>
        )}
      </Box>

      {/* Right: Status & Info */}
      <Box>
        <Box paddingX={1}>
          <Text color={theme.dim}>{status}</Text>
        </Box>
        <Box paddingX={1}>
          <Text color={theme.secondary} bold>v0.1.0</Text>
        </Box>
      </Box>
    </Box>
  );
}
