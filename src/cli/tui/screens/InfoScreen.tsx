import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { useTheme, symbols } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { compileDslToCsv } from '../../../compiler.js';

interface InfoScreenProps {
  file: string;
  onNavigate: (screen: any) => void;
}

// Stat row component
function StatRow({ label, value, valueColor, theme }: { 
  label: string; 
  value: string | number; 
  valueColor?: string;
  theme: any;
}) {
  return (
    <Box>
      <Text color={theme.dim}>{label.padEnd(14)}</Text>
      <Text color={valueColor || 'white'} bold>{value}</Text>
    </Box>
  );
}

// Progress bar for utilization
function UtilizationBar({ label, value, max, theme }: {
  label: string;
  value: number;
  max: number;
  theme: any;
}) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const barWidth = 20;
  const filled = Math.round((value / max) * barWidth) || 0;
  
  return (
    <Box>
      <Text color={theme.dim}>{label.padEnd(14)}</Text>
      <Text color={theme.primary}>{symbols.progressFilled.repeat(filled)}</Text>
      <Text color={theme.dim}>{symbols.progressEmpty.repeat(barWidth - filled)}</Text>
      <Text color={theme.primary} bold> {percentage}%</Text>
    </Box>
  );
}

export function InfoScreen({ file, onNavigate }: InfoScreenProps) {
  const theme = useTheme();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    try {
      const content = readFileSync(file, 'utf-8');
      const res = compileDslToCsv(content);
      setResult(res);
    } catch (e) {
      setResult({ success: false, error: String(e) });
    }
    setLoading(false);
  }, [file]);

  useInput((input, key) => {
    if (key.escape || key.return) {
      onNavigate({ type: 'main' });
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color={theme.primary}>Analyzing {basename(file)}...</Text>
      </Box>
    );
  }

  if (!result) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color={theme.error}>Failed to load file</Text>
      </Box>
    );
  }

  // Calculate stats
  const cycles = result.maxCycles || 0;
  const gridWidth = result.suggestedGridSize?.width || 4;
  const gridHeight = result.suggestedGridSize?.height || 4;
  const totalPEs = gridWidth * gridHeight;
  const assertions = result.assertions?.length || 0;
  const memoryRegions = result.memoryRegions || [];
  const hasMemory = memoryRegions.length > 0;
  
  // Calculate total memory words
  const totalMemoryWords = memoryRegions.reduce((sum: number, r: any) => sum + (r.values?.length || 0), 0);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Text color={theme.primary} bold>PROGRAM ANALYSIS</Text>
        <Text color={theme.dim}>{file}</Text>
      </Box>

      {result.success ? (
        <Box flexDirection="column">
          {/* Main Stats Panel */}
          <Panel title="Statistics" borderColor={theme.primary}>
            <Box flexDirection="column" paddingX={1}>
              <StatRow 
                label="Status" 
                value={`${symbols.success} VALID`} 
                valueColor={theme.success}
                theme={theme}
              />
              <StatRow 
                label="Kernel" 
                value={basename(file, '.dsl')} 
                theme={theme}
              />
              <StatRow 
                label="Cycles" 
                value={cycles > 0 ? cycles : 'Dynamic'} 
                valueColor={theme.primary}
                theme={theme}
              />
              <StatRow 
                label="Grid Size" 
                value={`${gridWidth} x ${gridHeight} (${totalPEs} PEs)`} 
                valueColor={theme.secondary}
                theme={theme}
              />
              <StatRow 
                label="Assertions" 
                value={assertions} 
                valueColor={assertions > 0 ? theme.warning : theme.dim}
                theme={theme}
              />
            </Box>
          </Panel>
          
          {/* Memory Panel */}
          {hasMemory && (
            <Panel title="Memory Regions" borderColor={theme.accent} marginTop={1}>
              <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                  <Text color={theme.dim}>Total: </Text>
                  <Text color={theme.primary} bold>{totalMemoryWords} words</Text>
                  <Text color={theme.dim}> in </Text>
                  <Text color={theme.primary} bold>{memoryRegions.length}</Text>
                  <Text color={theme.dim}> region(s)</Text>
                </Box>
                
                {memoryRegions.slice(0, 6).map((r: any, i: number) => (
                  <Box key={i}>
                    <Text color={theme.dim}>{symbols.bullet} </Text>
                    <Text color={theme.accent} bold>{(r.name || 'data_' + i).padEnd(12)}</Text>
                    <Text color={theme.dim}>@0x{r.start.toString(16).padStart(4, '0')} </Text>
                    <Text color="white">[{r.values?.length || 0} words]</Text>
                  </Box>
                ))}
                
                {memoryRegions.length > 6 && (
                  <Text color={theme.dim}>... and {memoryRegions.length - 6} more</Text>
                )}
              </Box>
            </Panel>
          )}

          {/* Hardware Estimate Panel */}
          <Panel title="Hardware Estimate" borderColor={theme.secondary} marginTop={1}>
            <Box flexDirection="column" paddingX={1}>
              <UtilizationBar 
                label="PE Util" 
                value={Math.min(cycles * 2, totalPEs)} 
                max={totalPEs} 
                theme={theme}
              />
              <StatRow 
                label="Est. Latency" 
                value={`${cycles} cycles`} 
                valueColor={theme.primary}
                theme={theme}
              />
              <StatRow 
                label="Memory I/O" 
                value={hasMemory ? `${totalMemoryWords} words` : 'None'} 
                theme={theme}
              />
            </Box>
          </Panel>
        </Box>
      ) : (
        <Panel title="Compilation Failed" borderColor={theme.error}>
          <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
              <Text color={theme.error} bold>{symbols.error} ERROR</Text>
            </Box>
            <Text color="white" wrap="wrap">{result.error}</Text>
            {result.line && (
              <Box marginTop={1}>
                <Text color={theme.dim}>at line </Text>
                <Text color={theme.warning} bold>{result.line}</Text>
              </Box>
            )}
          </Box>
        </Panel>
      )}

      {/* Footer */}
      <Box marginTop={2}>
        <Box backgroundColor={theme.dim} paddingX={1} marginRight={1}>
          <Text color="black" bold>ESC</Text>
        </Box>
        <Text color={theme.dim}>Back to menu</Text>
        
        <Box marginLeft={3} backgroundColor={theme.dim} paddingX={1} marginRight={1}>
          <Text color="black" bold>ENTER</Text>
        </Box>
        <Text color={theme.dim}>Continue</Text>
      </Box>
    </Box>
  );
}
