import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { useTheme, symbols } from '../theme.js';
import { CodePreview } from './CodePreview.js';
import { CodeInspector } from '../intelligence/CodeInspector.js';
import { GridVisualizer } from './GridVisualizer.js';
import { Panel } from './Panel.js';
import { analyzeDsl, compileDslToCsv } from '../../../compiler.js';

interface FileViewerProps {
  filePath: string;
  onBack: () => void;
}

interface Diagnostic {
  valid: boolean;
  message: string;
  line?: number;
}

export function FileViewer({ filePath, onBack }: FileViewerProps) {
  const theme = useTheme();
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState({ columns: stdout.columns, rows: stdout.rows });
  const [content, setContent] = useState('');
  const [cursorLine, setCursorLine] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [diagnostic, setDiagnostic] = useState<Diagnostic>({ valid: true, message: 'Checking...' });
  const [activeCells, setActiveCells] = useState<{ row: number; col: number; op: string }[]>([]);
  const [ast, setAst] = useState<any>(null);

  // Update terminal size on resize
  useEffect(() => {
    function onResize() {
      setTerminalSize({ columns: stdout.columns, rows: stdout.rows });
    }
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  useEffect(() => {
    try {
      const text = readFileSync(filePath, 'utf-8');
      setContent(text);
      setTotalLines(text.split('\n').length);
      
      const analysis = analyzeDsl(text);
      if (analysis.success && analysis.ast) {
        setAst(analysis.ast);
        setDiagnostic({ valid: true, message: 'Source code verified. System stable.' });
      } else {
        setDiagnostic({ 
          valid: false, 
          message: analysis.error || 'Syntax violation detected', 
          line: undefined 
        });
      }
    } catch {
      setContent('FILE_READ_ERROR');
      setDiagnostic({ valid: false, message: 'System cannot access file resource' });
    }
  }, [filePath]);

  useEffect(() => {
    if (!ast) return;
    let currentCycle = null;
    for (const cycle of ast.cycles) {
      for (const instr of cycle.instructions.values()) {
        if (instr.originalLine === cursorLine) {
          currentCycle = cycle;
          break;
        }
      }
      if (currentCycle) break;
    }
    if (currentCycle) {
      const cells = [];
      for (const [key, instr] of currentCycle.instructions) {
        const [row, col] = key.split(',').map(Number);
        cells.push({ row, col, op: instr.opcode });
      }
      setActiveCells(cells);
    } else {
      setActiveCells([]);
    }
  }, [cursorLine, ast]);

  useInput((input, key) => {
    if (key.escape) onBack();
    if (key.upArrow) setCursorLine(prev => Math.max(1, prev - 1));
    if (key.downArrow) setCursorLine(prev => Math.min(totalLines, prev + 1));
    if (key.pageUp) setCursorLine(prev => Math.max(1, prev - 10));
    if (key.pageDown) setCursorLine(prev => Math.min(totalLines, prev + 10));
    if (input === 'e' && !diagnostic.valid && diagnostic.line) setCursorLine(diagnostic.line);
  });

  const codeHeight = Math.max(10, terminalSize.rows - 8);

  return (
    <Box flexDirection="row" height="100%" width="100%">
      {/* LEFT: PRIMARY WORKSPACE */}
      <Box flexDirection="column" flexGrow={1} marginRight={2}>
        <Box marginBottom={1} justifyContent="space-between" alignItems="center">
          <Box alignItems="center">
             <Text backgroundColor={theme.primary} color="black" bold> WORKSPACE </Text>
             <Text color={theme.dim}>  </Text>
             <Text color="white" bold>{basename(filePath).toUpperCase()}</Text>
          </Box>
          {!diagnostic.valid && (
            <Box backgroundColor={theme.error} paddingX={1}>
              <Text color="black" bold> CRITICAL_ERROR </Text>
            </Box>
          )}
        </Box>
        
        <Box flexGrow={1} borderStyle="single" borderColor={theme.dim} paddingX={0} overflow="hidden" backgroundColor="#0a0a0a">
          <CodePreview 
            code={content} 
            maxLines={codeHeight} 
            highlightLine={cursorLine}
          />
        </Box>
        
        <Box marginTop={1} justifyContent="space-between">
           <Box>
             <Text color={theme.dim}>CURSOR_POS </Text>
             <Text color={theme.primary} bold>LN {cursorLine}</Text>
             <Text color={theme.dim}> / {totalLines}</Text>
           </Box>
           <Box>
             <Text color={theme.dim}>[↑↓] SELECT  [ESC] EXIT</Text>
           </Box>
        </Box>
      </Box>

      {/* RIGHT: SYSTEM INTELLIGENCE */}
      <Box flexDirection="column" width={45} flexShrink={0}>
        {/* Hardware Visualizer */}
        <Box borderStyle="round" borderColor={theme.dim} paddingX={1} marginBottom={1} flexDirection="column">
          <GridVisualizer activeCells={activeCells} />
        </Box>

        {/* Dynamic Instruction Inspector */}
        <Box flexGrow={1} overflow="hidden">
          <Panel title="System Inspector" borderColor={theme.primary}>
             <CodeInspector code={content} lineNumber={cursorLine} />
          </Panel>
        </Box>
        
        {/* Diagnostics & Health */}
        <Box marginTop={1}>
           <Panel title="System Status" borderColor={diagnostic.valid ? theme.success : theme.error}>
             <Box flexDirection="column" paddingX={1}>
               <Text color={diagnostic.valid ? theme.success : theme.error} bold>
                 {diagnostic.valid ? 'RUNNING_OPTIMAL' : 'HARDWARE_FAULT'}
               </Text>
               <Text color="white" dimColor={diagnostic.valid}>
                 {diagnostic.message}
               </Text>
             </Box>
           </Panel>
        </Box>
      </Box>
    </Box>
  );
}
