/**
 * Panel Component - A modern container with consistent padding and borders
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  borderColor?: string;
  width?: number | string;
  paddingX?: number;
  paddingY?: number;
  marginTop?: number;
  marginBottom?: number;
}

export function Panel({ 
  title, 
  children, 
  borderColor, 
  width, 
  paddingX = 2, 
  paddingY = 0,
  marginTop = 0,
  marginBottom = 0
}: PanelProps) {
  const theme = useTheme();
  const color = borderColor || theme.primary;
  
  return (
    <Box 
      flexDirection="column" 
      width={width}
      borderStyle="round"
      borderColor={color}
      paddingX={paddingX}
      paddingY={paddingY}
      marginTop={marginTop}
      marginBottom={marginBottom}
    >
      {title && (
        <Box marginTop={-1} marginBottom={1}>
          <Text backgroundColor={theme.primary} color="black" bold> {title.toUpperCase()} </Text>
        </Box>
      )}
      <Box flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}
