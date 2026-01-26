/**
 * Panel Component - A box with optional title and colored border
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme, symbols } from '../theme.js';

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  borderColor?: string;
  width?: number | string;
  padding?: number;
}

export function Panel({ title, children, borderColor, width, padding = 1 }: PanelProps) {
  const theme = useTheme();
  const color = borderColor || theme.primary;
  
  return (
    <Box flexDirection="column" width={width}>
      {/* Top border */}
      <Box>
        <Text color={color}>{symbols.boxTopLeft}</Text>
        {title && (
          <>
            <Text color={color}>{symbols.boxHorizontal} </Text>
            <Text color={color} bold>{title}</Text>
            <Text color={color}> {symbols.boxHorizontal.repeat(10)}</Text>
          </>
        )}
        {!title && <Text color={color}>{symbols.boxHorizontal.repeat(20)}</Text>}
        <Text color={color}>{symbols.boxTopRight}</Text>
      </Box>
      
      {/* Content */}
      <Box paddingLeft={padding} paddingRight={padding}>
        <Text color={color}>{symbols.boxVertical}</Text>
        <Box flexDirection="column" paddingLeft={1}>
          {children}
        </Box>
      </Box>
      
      {/* Bottom border */}
      <Box>
        <Text color={color}>{symbols.boxBottomLeft}</Text>
        <Text color={color}>{symbols.boxHorizontal.repeat(20)}</Text>
        <Text color={color}>{symbols.boxBottomRight}</Text>
      </Box>
    </Box>
  );
}
