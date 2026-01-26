import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';

interface GridVisualizerProps {
  rows?: number;
  cols?: number;
  activeCells: { row: number; col: number; op: string }[];
  compact?: boolean;
}

export function GridVisualizer({ rows = 4, cols = 4, activeCells }: GridVisualizerProps) {
  const theme = useTheme();

  const grid = Array.from({ length: rows }, (_, r) => 
    Array.from({ length: cols }, (_, c) => {
      return activeCells.find(cell => cell.row === r && cell.col === c);
    })
  );

  return (
    <Box flexDirection="column" alignItems="center" width="100%">
      <Box marginBottom={1} width="100%" justifyContent="center" borderStyle="double" borderColor={theme.primary} paddingX={2}>
        <Text color={theme.primary} bold> CGRA HARDWARE MAPPING </Text>
      </Box>
      
      <Box flexDirection="column">
        {grid.map((row, r) => (
          <Box key={r} flexDirection="row">
            {row.map((cell, c) => {
              const isActive = !!cell;
              const isMemory = cell?.op === 'LWI' || cell?.op === 'SWI';
              
              let color = '#2a2a2a';
              let borderColor = '#333333';
              if (isActive) {
                color = isMemory ? theme.secondary : theme.primary;
                borderColor = color;
              }
              
              return (
                <Box 
                  key={c} 
                  width={9} 
                  height={3} 
                  borderStyle="round" 
                  borderColor={borderColor}
                  alignItems="center" 
                  justifyContent="center"
                  marginRight={c < cols - 1 ? 0 : 0}
                >
                  {isActive ? (
                    <Box flexDirection="column" alignItems="center">
                      <Text color={color} bold>{cell.op}</Text>
                      <Text color={color} dimColor size={1}>PE{r}{c}</Text>
                    </Box>
                  ) : (
                    <Text color="#222222">IDLE</Text>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
      
      {/* Dynamic Status Legend */}
      <Box marginTop={1} width="100%" justifyContent="space-between" paddingX={1}>
        <Box>
          <Text backgroundColor={theme.primary} color="black"> ACT </Text>
          <Text color={theme.dim}> PE Active </Text>
        </Box>
        <Box>
          <Text backgroundColor={theme.secondary} color="black"> MEM </Text>
          <Text color={theme.dim}> IO Access </Text>
        </Box>
      </Box>
    </Box>
  );
}
