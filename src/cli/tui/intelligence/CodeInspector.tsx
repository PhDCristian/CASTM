import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';
import { getInstructionInfo, InstructionDef } from './instruction-db.js';

interface CodeInspectorProps {
  code: string;
  lineNumber: number; // 1-based
}

export function CodeInspector({ code, lineNumber }: CodeInspectorProps) {
  const theme = useTheme();
  
  const lines = code.split('\n');
  const activeLine = lines[lineNumber - 1] || '';
  const info = getInstructionInfo(activeLine);

  if (!info) {
    return (
      <Box paddingX={1} paddingY={1} justifyContent="center">
        <Text color={theme.dim} italic>HOVER OVER AN INSTRUCTION</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} flexDirection="column" width="100%">
      {/* Header Area */}
      <Box marginBottom={1} alignItems="center">
        <Box backgroundColor={theme.primary} paddingX={1} marginRight={1}>
          <Text color="black" bold>{info.opcode}</Text>
        </Box>
        <Text color={theme.accent} bold> ISA_DOC </Text>
        <Box flexGrow={1} />
        <Text color={theme.dim} size={1}>{info.category.toLowerCase()}</Text>
      </Box>

      {/* Description Panel */}
      <Box borderStyle="single" borderColor="#333333" paddingX={1} marginBottom={1} backgroundColor="#1a1a1a">
        <Text color="white">{info.description}</Text>
      </Box>

      {/* Technical Specs Grid */}
      <Box flexDirection="row" marginBottom={1}>
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="#333333" paddingX={1} marginRight={1}>
          <Text color={theme.dim} bold size={1}>LATENCY</Text>
          <Text color={theme.primary} bold>{info.cycles} cycles</Text>
        </Box>
        <Box flexDirection="column" flexGrow={2} borderStyle="round" borderColor="#333333" paddingX={1}>
          <Text color={theme.dim} bold size={1}>SIGNATURE</Text>
          <Text color={theme.secondary}>{info.operands.join(', ') || 'NONE'}</Text>
        </Box>
      </Box>

      {/* Syntax Sample */}
      <Box flexDirection="column">
        <Text color={theme.dim} bold size={1}> USAGE EXAMPLE</Text>
        <Box backgroundColor="#000000" paddingX={1} borderStyle="single" borderColor={theme.dim}>
          <Text color={theme.success}>λ </Text>
          <Text color="white">{info.example}</Text>
        </Box>
      </Box>
    </Box>
  );
}
