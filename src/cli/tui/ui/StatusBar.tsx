import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useTheme, symbols } from '../theme.js';

interface StatusBarProps {
  status?: string;
  file?: string;
  mode?: string;
  shortcuts?: Array<{ key: string; action: string }>;
}

// Status configurations
const STATUS_CONFIG: Record<string, { colorKey: 'success' | 'warning' | 'error' | 'primary' | 'secondary' }> = {
  'IDLE': { colorKey: 'secondary' },
  'READY': { colorKey: 'success' },
  'BROWSING': { colorKey: 'primary' },
  'INSPECTING': { colorKey: 'primary' },
  'COMPILING': { colorKey: 'warning' },
  'WATCHING': { colorKey: 'success' },
  'ERROR': { colorKey: 'error' },
  'SUCCESS': { colorKey: 'success' },
};

function Clock() {
  const theme = useTheme();
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return <Text color={theme.dim}>{time}</Text>;
}

export function StatusBar({ 
  status = 'IDLE', 
  file, 
  mode = 'NORMAL',
  shortcuts = []
}: StatusBarProps) {
  const theme = useTheme();
  
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG['IDLE'];
  const statusColor = theme[statusConfig.colorKey];
  
  // Default shortcuts if none provided
  const defaultShortcuts = [
    { key: 'ESC', action: 'Back' },
    { key: '?', action: 'Help' },
  ];
  const displayShortcuts = shortcuts.length > 0 ? shortcuts : defaultShortcuts;

  return (
    <Box 
      width="100%" 
      height={1} 
      justifyContent="space-between"
      paddingX={1}
    >
      {/* Left Section: Mode + Status + File */}
      <Box>
        {/* Mode Badge */}
        <Box backgroundColor={theme.primary} paddingX={1} marginRight={1}>
          <Text color="#000000" bold>{mode}</Text>
        </Box>
        
        {/* Status */}
        <Box marginRight={2}>
          <Text color={statusColor} bold>{status}</Text>
        </Box>
        
        {/* Current File */}
        {file && (
          <Box>
            <Text color={theme.dim}>{symbols.file} </Text>
            <Text color="white">{file}</Text>
          </Box>
        )}
      </Box>

      {/* Center: Shortcuts */}
      <Box>
        {displayShortcuts.slice(0, 4).map((shortcut, i) => (
          <Box key={i} marginRight={2}>
            <Text color={theme.accent} bold>[{shortcut.key}]</Text>
            <Text color={theme.dim}> {shortcut.action}</Text>
          </Box>
        ))}
      </Box>

      {/* Right Section: Clock + Version */}
      <Box>
        <Clock />
        <Text color={theme.dim}> | </Text>
        <Text color={theme.secondary} bold>OpenEdge</Text>
        <Text color={theme.dim}> v0.1.0</Text>
      </Box>
    </Box>
  );
}
