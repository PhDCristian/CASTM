import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { readFileSync } from 'fs';
import { basename, dirname, sep } from 'path';
import { useTheme, symbols, premiumColors } from '../theme.js';
import { CodePreview } from './CodePreview.js';
import { CodeInspector } from '../intelligence/CodeInspector.js';
import { GridVisualizer } from './GridVisualizer.js';
import { Panel } from './Panel.js';
import { analyzeDsl } from '../../../compiler.js';

interface FileViewerProps {
  filePath: string;
  onBack: () => void;
}

interface Diagnostic {
  valid: boolean;
  message: string;
  line?: number;
}

// Premium breadcrumb component
function Breadcrumb({ path, theme }: { path: string; theme: any }) {
  const parts = path.split(sep);
  const fileName = parts.pop() || '';
  const dirParts = parts.slice(-2);
  
  return (
    <Box>
      <Text color={premiumColors.textDim}># </Text>
      {dirParts.length > 0 && (
        <>
          {parts.length > 2 && <Text color={premiumColors.textDim}>...</Text>}
          {dirParts.map((part, i) => (
            <React.Fragment key={i}>
              <Text color={premiumColors.textDim}>{part}</Text>
              <Text color={premiumColors.textDim}>/</Text>
            </React.Fragment>
          ))}
        </>
      )}
      <Text color={theme.primary} bold>{fileName}</Text>
    </Box>
  );
}

// Minimap component
function Minimap({ 
  totalLines, 
  currentLine, 
  viewportHeight, 
  activeLines,
  theme 
}: { 
  totalLines: number; 
  currentLine: number; 
  viewportHeight: number;
  activeLines: number[];
  theme: any;
}) {
  if (totalLines <= 15) return null;
  
  const minimapHeight = Math.min(12, Math.ceil(totalLines / 4));
  const linesPerRow = Math.ceil(totalLines / minimapHeight);
  const activeSet = new Set(activeLines);
  
  const viewportStart = Math.floor((currentLine - 1) / linesPerRow);
  const viewportSize = Math.max(1, Math.ceil(viewportHeight / linesPerRow));
  
  const rows = Array.from({ length: minimapHeight }, (_, i) => {
    const lineStart = i * linesPerRow + 1;
    const lineEnd = Math.min((i + 1) * linesPerRow, totalLines);
    
    let hasActive = false;
    for (let l = lineStart; l <= lineEnd; l++) {
      if (activeSet.has(l)) {
        hasActive = true;
        break;
      }
    }
    
    const isViewport = i >= viewportStart && i < viewportStart + viewportSize;
    const isCurrent = currentLine >= lineStart && currentLine <= lineEnd;
    
    let char = '.';
    let color = premiumColors.textDim;
    
    if (isCurrent) {
      char = '>';
      color = theme.warning;
    } else if (hasActive) {
      char = '#';
      color = theme.primary;
    } else if (isViewport) {
      char = '|';
      color = premiumColors.textMuted;
    }
    
    return { char, color };
  });
  
  return (
    <Box flexDirection="column" marginLeft={1} width={1}>
      {rows.map((row, i) => (
        <Text key={i} color={row.color}>{row.char}</Text>
      ))}
    </Box>
  );
}

// Shortcut bar
function ShortcutBar({ hasError, theme }: { hasError: boolean; theme: any }) {
  const shortcuts = [
    { key: 'UP/DN', action: 'Nav' },
    { key: 'PgUp/Dn', action: 'Jump' },
    ...(hasError ? [{ key: 'E', action: 'Error' }] : []),
    { key: 'ESC', action: 'Exit' },
  ];
  
  return (
    <Box marginTop={1}>
      {shortcuts.map((s, i) => (
        <Box key={i} marginRight={2}>
          <Box backgroundColor={premiumColors.bgLight} paddingX={1}>
            <Text color={premiumColors.textBright} bold>{s.key}</Text>
          </Box>
          <Text color={premiumColors.textDim}> {s.action}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function FileViewer({ filePath, onBack }: FileViewerProps) {
  const theme = useTheme();
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState({ columns: stdout.columns, rows: stdout.rows });
  const [content, setContent] = useState('');
  const [cursorLine, setCursorLine] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [diagnostic, setDiagnostic] = useState<Diagnostic>({ valid: true, message: 'Analyzing...' });
  const [activeCells, setActiveCells] = useState<{ row: number; col: number; op: string }[]>([]);
  const [ast, setAst] = useState<any>(null);

  useEffect(() => {
    function onResize() {
      setTerminalSize({ columns: stdout.columns, rows: stdout.rows });
    }
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
  }, [stdout]);

  useEffect(() => {
    try {
      const text = readFileSync(filePath, 'utf-8');
      setContent(text);
      setTotalLines(text.split('\n').length);
      
      const analysis = analyzeDsl(text);
      if (analysis.success && analysis.ast) {
        setAst(analysis.ast);
        const cycleCount = analysis.ast.cycles?.length || 0;
        setDiagnostic({ 
          valid: true, 
          message: `${cycleCount} cycles mapped - Ready` 
        });
      } else {
        const lineMatch = analysis.error?.match(/line (\d+)/i);
        const errorLine = lineMatch ? parseInt(lineMatch[1]) : undefined;
        setDiagnostic({ 
          valid: false, 
          message: analysis.error || 'Syntax error', 
          line: errorLine 
        });
      }
    } catch {
      setContent('// Unable to read file');
      setDiagnostic({ valid: false, message: 'File access error' });
    }
  }, [filePath]);

  useEffect(() => {
    if (!ast) return;
    let currentCycle = null;
    for (const cycle of ast.cycles || []) {
      for (const instr of cycle.instructions?.values() || []) {
        if (instr.originalLine === cursorLine) {
          currentCycle = cycle;
          break;
        }
      }
      if (currentCycle) break;
    }
    if (currentCycle) {
      const cells: { row: number; col: number; op: string }[] = [];
      for (const [key, instr] of currentCycle.instructions || new Map()) {
        const [row, col] = key.split(',').map(Number);
        // Only add if we have valid row/col and opcode is a clean string
        const opcode = String(instr.opcode || '').trim();
        if (!isNaN(row) && !isNaN(col) && opcode && /^[A-Za-z]+$/.test(opcode)) {
          cells.push({ row, col, op: opcode.toUpperCase() });
        }
      }
      setActiveCells(cells);
    } else {
      setActiveCells([]);
    }
  }, [cursorLine, ast]);

  const activeLines = useMemo(() => {
    if (!ast) return [];
    const lines: number[] = [];
    for (const cycle of ast.cycles || []) {
      for (const instr of cycle.instructions?.values() || []) {
        if (instr.originalLine) lines.push(instr.originalLine);
      }
    }
    return [...new Set(lines)];
  }, [ast]);

  useInput((input, key) => {
    if (key.escape) onBack();
    if (key.upArrow) setCursorLine(prev => Math.max(1, prev - 1));
    if (key.downArrow) setCursorLine(prev => Math.min(totalLines, prev + 1));
    if (key.pageUp) setCursorLine(prev => Math.max(1, prev - 10));
    if (key.pageDown) setCursorLine(prev => Math.min(totalLines, prev + 10));
    if (input === 'g') setCursorLine(1);
    if (input === 'G') setCursorLine(totalLines);
    if (input === 'e' && !diagnostic.valid && diagnostic.line) setCursorLine(diagnostic.line);
  });

  const codeHeight = Math.max(10, terminalSize.rows - 10);
  const rightPanelWidth = 44;

  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Header Bar */}
      <Box 
        marginBottom={1} 
        paddingX={1} 
        justifyContent="space-between"
        backgroundColor={premiumColors.bgMedium}
        paddingY={0}
      >
        <Breadcrumb path={filePath} theme={theme} />
        <Box>
          <Text color={premiumColors.textDim}>LN </Text>
          <Text color={theme.primary} bold>{cursorLine}</Text>
          <Text color={premiumColors.textDim}> / {totalLines}</Text>
          <Text color={premiumColors.textDim}>  |  </Text>
          <Text color={activeCells.length > 0 ? theme.success : premiumColors.textDim}>
            {activeCells.length} PEs
          </Text>
        </Box>
      </Box>

      {/* Main Content */}
      <Box flexDirection="row" flexGrow={1}>
        {/* LEFT: Code */}
        <Box flexDirection="row" flexGrow={1} marginRight={1}>
          <Panel 
            title="SOURCE CODE" 
            borderColor={diagnostic.valid ? theme.primary : theme.error}
            flexGrow={1}
          >
            <CodePreview 
              code={content} 
              maxLines={codeHeight} 
              highlightLine={cursorLine}
              activeLines={activeLines}
            />
          </Panel>
        </Box>

        {/* RIGHT: Intelligence */}
        <Box flexDirection="column" width={rightPanelWidth} flexShrink={0}>
          <GridVisualizer activeCells={activeCells} compact={true} />

          <Box flexGrow={1} marginTop={1}>
            <Panel 
              title="INSPECTOR" 
              borderColor={activeCells.length > 0 ? theme.primary : premiumColors.borderDim}
              flexGrow={1}
            >
              <CodeInspector code={content} lineNumber={cursorLine} />
            </Panel>
          </Box>
          
          <Box marginTop={1}>
            <Panel 
              title="STATUS" 
              borderColor={diagnostic.valid ? theme.success : theme.error}
            >
              <Box flexDirection="column" paddingX={1}>
                <Text color={diagnostic.valid ? theme.success : theme.error} bold>
                  {diagnostic.valid ? '[OK]' : '[!!]'} {diagnostic.valid ? 'VALID' : 'ERROR'}
                </Text>
                <Text color={premiumColors.textNormal} wrap="truncate-end">
                  {diagnostic.message}
                </Text>
              </Box>
            </Panel>
          </Box>
        </Box>
      </Box>

      <ShortcutBar hasError={!diagnostic.valid && !!diagnostic.line} theme={theme} />
    </Box>
  );
}
