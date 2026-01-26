/**
 * GridVisualizer - Premium CGRA hardware visualization
 * Vercel/Next.js style with Unicode borders
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme, premiumColors } from '../theme.js';

interface GridVisualizerProps {
  rows?: number;
  cols?: number;
  activeCells: { row: number; col: number; op: string }[];
  title?: string;
}

// Valid CGRA operations
const VALID_OPS = new Set([
  'LWI', 'SWI', 'LW', 'SW',
  'ADD', 'SUB', 'MUL', 'DIV',
  'SADD', 'SSUB', 'SMUL', 'SDIV',
  'AND', 'OR', 'XOR', 'NOT',
  'SHL', 'SHR', 'SHRA',
  'NOP', 'EXIT', 'MOV', 'CMP',
  'JMP', 'BEQ', 'BNE', 'BLT', 'BGT',
  'PASS', 'ROUTE', 'ROUT',
]);

// Operation categories
const OP_CATEGORIES: Record<string, 'compute' | 'memory' | 'control' | 'logic'> = {
  'LWI': 'memory', 'SWI': 'memory', 'LW': 'memory', 'SW': 'memory',
  'ADD': 'compute', 'SUB': 'compute', 'MUL': 'compute', 'DIV': 'compute',
  'SADD': 'compute', 'SSUB': 'compute', 'SMUL': 'compute', 'SDIV': 'compute',
  'AND': 'logic', 'OR': 'logic', 'XOR': 'logic', 'NOT': 'logic',
  'SHL': 'logic', 'SHR': 'logic', 'SHRA': 'logic',
  'NOP': 'control', 'EXIT': 'control', 'MOV': 'control', 'CMP': 'control',
  'JMP': 'control', 'BEQ': 'control', 'BNE': 'control', 'BLT': 'control', 'BGT': 'control',
  'PASS': 'control', 'ROUTE': 'control', 'ROUT': 'control',
};

// Category colors (Vercel palette)
const CAT_COLORS: Record<string, string> = {
  compute: premiumColors.accentCyan,
  memory: premiumColors.accentPurple,
  logic: premiumColors.accentPink,
  control: premiumColors.accentOrange,
};

function extractOp(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim().toUpperCase();
  if (!clean) return null;
  
  if (clean.startsWith('//') || clean.startsWith('.') || 
      clean.startsWith('{') || clean.startsWith('}') ||
      clean.startsWith('KERNEL') || clean.startsWith('CYCLE') ||
      clean.startsWith('CONFIG') || clean.startsWith('ROW')) {
    return null;
  }
  
  const match = clean.match(/^([A-Z]+)/);
  if (!match) return null;
  
  const op = match[1];
  return VALID_OPS.has(op) ? op : null;
}

function getOpCategory(op: string): 'compute' | 'memory' | 'control' | 'logic' {
  return OP_CATEGORIES[op] || 'compute';
}

function formatOp(op: string): string {
  if (op.length >= 4) return op.slice(0, 4);
  return op.padEnd(4);
}

// Premium PE cell with Unicode borders
function PECell({ op }: { op: string | null }) {
  if (!op) {
    return (
      <Box flexDirection="column">
        <Text color={premiumColors.borderDim}>╭────╮</Text>
        <Text color={premiumColors.borderDim}>│    │</Text>
        <Text color={premiumColors.borderDim}>╰────╯</Text>
      </Box>
    );
  }
  
  const cat = getOpCategory(op);
  const color = CAT_COLORS[cat];
  const display = formatOp(op);
  
  return (
    <Box flexDirection="column">
      <Text color={color}>╭────╮</Text>
      <Text color={color}>│<Text color={premiumColors.textBright} bold>{display}</Text>│</Text>
      <Text color={color}>╰────╯</Text>
    </Box>
  );
}

export function GridVisualizer({ 
  rows = 4, 
  cols = 4, 
  activeCells,
  title = "CGRA Grid"
}: GridVisualizerProps) {
  // Process cells
  const grid: (string | null)[][] = Array.from({ length: rows }, () => 
    Array.from({ length: cols }, () => null)
  );
  
  const validCells: { row: number; col: number; op: string }[] = [];
  
  for (const cell of activeCells) {
    if (cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols) {
      const op = extractOp(cell.op);
      if (op) {
        grid[cell.row][cell.col] = op;
        validCells.push({ row: cell.row, col: cell.col, op });
      }
    }
  }
  
  // Count by category
  const counts: Record<string, number> = { compute: 0, memory: 0, logic: 0, control: 0 };
  validCells.forEach(cell => {
    counts[getOpCategory(cell.op)]++;
  });
  
  const totalCells = rows * cols;
  const activeCount = validCells.length;
  const percent = totalCells > 0 ? Math.round((activeCount / totalCells) * 100) : 0;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={premiumColors.accentCyan} bold>▣ {title}</Text>
        <Text color={premiumColors.textDim}> ─ </Text>
        <Text color={premiumColors.textMuted}>{rows}×{cols}</Text>
        <Text color={premiumColors.textDim}> ─ </Text>
        {activeCount > 0 ? (
          <>
            <Text backgroundColor={premiumColors.statusSuccess} color="#000" bold> {activeCount} </Text>
            <Text color={premiumColors.textMuted}> active</Text>
          </>
        ) : (
          <Text color={premiumColors.textDim}>idle</Text>
        )}
      </Box>
      
      {/* Column headers */}
      <Box marginLeft={2}>
        {Array.from({ length: cols }, (_, c) => (
          <Box key={c} width={6} justifyContent="center">
            <Text color={premiumColors.textDim}>{c}</Text>
          </Box>
        ))}
      </Box>
      
      {/* Grid */}
      <Box flexDirection="column">
        {grid.map((row, r) => (
          <Box key={r} alignItems="center">
            <Box width={2} justifyContent="flex-end">
              <Text color={premiumColors.textDim}>{r}</Text>
            </Box>
            {row.map((op, c) => (
              <PECell key={c} op={op} />
            ))}
          </Box>
        ))}
      </Box>
      
      {/* Utilization bar */}
      <Box marginTop={1}>
        <Text color={premiumColors.textMuted}>UTIL </Text>
        <Text color={premiumColors.textDim}>[</Text>
        <Text color={percent >= 50 ? premiumColors.statusSuccess : percent > 0 ? premiumColors.accentCyan : premiumColors.textDim}>
          {'█'.repeat(Math.round(percent / 5))}
        </Text>
        <Text color={premiumColors.borderDim}>
          {'░'.repeat(20 - Math.round(percent / 5))}
        </Text>
        <Text color={premiumColors.textDim}>] </Text>
        <Text color={premiumColors.textBright} bold>{percent}%</Text>
      </Box>
      
      {/* Legend */}
      {activeCount > 0 && (
        <Box marginTop={1} gap={2}>
          {Object.entries(counts).filter(([_, v]) => v > 0).map(([cat, count]) => (
            <Box key={cat}>
              <Text backgroundColor={CAT_COLORS[cat]} color="#000"> {count} </Text>
              <Text color={premiumColors.textMuted}> {cat.slice(0, 3).toUpperCase()}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
