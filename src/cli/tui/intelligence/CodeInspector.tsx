/**
 * CodeInspector - Compact instruction info panel
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme, premiumColors } from '../theme.js';
import { getInstructionInfo, INSTRUCTION_DB } from './instruction-db.js';

interface CodeInspectorProps {
  code: string;
  lineNumber: number;
}

// Category colors
const CAT_COLORS: Record<string, string> = {
  'ALU': premiumColors.accentCyan,
  'Memory': premiumColors.accentPurple,
  'Control': premiumColors.accentOrange,
  'System': premiumColors.accentPink,
};

// Compact latency display
function Latency({ cycles, theme }: { cycles: number; theme: any }) {
  const color = cycles === 1 ? theme.success : cycles === 2 ? theme.warning : theme.error;
  return (
    <Text color={color}>
      {'●'.repeat(cycles)}{'○'.repeat(Math.max(0, 4 - cycles))} {cycles}c
    </Text>
  );
}

// Idle state - very compact
function IdleState({ lineContent }: { lineContent: string }) {
  const trimmed = lineContent.trim();
  
  let label = '─';
  let detail = 'Navigate to instruction';
  
  if (trimmed.startsWith('//')) {
    label = '//';
    detail = 'Comment';
  } else if (trimmed.toLowerCase().includes('kernel')) {
    label = 'K';
    detail = 'Kernel block';
  } else if (trimmed.toLowerCase().includes('config')) {
    label = 'C';
    detail = 'Configuration';
  } else if (trimmed.startsWith('.')) {
    label = '.';
    detail = 'Directive';
  } else if (!trimmed) {
    label = ' ';
    detail = '';
  }
  
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color={premiumColors.textDim} bold>[{label}] </Text>
        <Text color={premiumColors.textMuted}>{detail}</Text>
      </Box>
    </Box>
  );
}

export function CodeInspector({ code, lineNumber }: CodeInspectorProps) {
  const theme = useTheme();
  
  const lines = code.split('\n');
  const activeLine = lines[lineNumber - 1] || '';
  const info = getInstructionInfo(activeLine);

  if (!info) {
    return <IdleState lineContent={activeLine} />;
  }

  const catColor = CAT_COLORS[info.category] || premiumColors.accentCyan;

  // Related ops (max 2)
  const related = Object.keys(INSTRUCTION_DB)
    .filter(k => INSTRUCTION_DB[k].category === info.category && k !== info.opcode)
    .slice(0, 2);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Line 1: Badge + Name + Category */}
      <Box>
        <Text backgroundColor={catColor} color="#000" bold> {info.opcode} </Text>
        <Text color={premiumColors.textBright}> {info.name}</Text>
        <Text color={premiumColors.textDim}> │ </Text>
        <Text color={catColor}>{info.category}</Text>
      </Box>
      
      {/* Line 2: Description (truncated) */}
      <Box marginY={0}>
        <Text color={premiumColors.textMuted}>
          {info.description.length > 50 ? info.description.slice(0, 47) + '...' : info.description}
        </Text>
      </Box>
      
      {/* Line 3: Stats inline */}
      <Box gap={2}>
        <Box>
          <Text color={premiumColors.textDim}>Latency </Text>
          <Latency cycles={info.cycles} theme={theme} />
        </Box>
        <Box>
          <Text color={premiumColors.textDim}>Args </Text>
          <Text color={theme.secondary}>{info.operands.join(', ') || '─'}</Text>
        </Box>
      </Box>
      
      {/* Line 4: Example */}
      <Box marginTop={0}>
        <Text color={premiumColors.textDim}>Ex: </Text>
        <Text color={premiumColors.accentGreen}>{info.example}</Text>
      </Box>
      
      {/* Line 5: Related (optional) */}
      {related.length > 0 && (
        <Box>
          <Text color={premiumColors.textDim}>→ </Text>
          <Text color={catColor}>{related.join(', ')}</Text>
        </Box>
      )}
    </Box>
  );
}
