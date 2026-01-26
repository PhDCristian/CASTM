/**
 * HelpOverlay Component - Modal showing all keyboard shortcuts
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme, symbols } from '../theme.js';
import { Panel } from '../components/Panel.js';

interface HelpOverlayProps {
  onClose: () => void;
  context?: 'main' | 'viewer' | 'browser' | 'compile';
}

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ key: string; description: string }>;
}

const GLOBAL_SHORTCUTS: ShortcutGroup = {
  title: 'Global',
  shortcuts: [
    { key: 'ESC', description: 'Go back / Close' },
    { key: '?', description: 'Toggle help' },
    { key: 'q', description: 'Quit application' },
  ]
};

const NAVIGATION_SHORTCUTS: ShortcutGroup = {
  title: 'Navigation',
  shortcuts: [
    { key: '↑ / ↓', description: 'Move up/down' },
    { key: 'PgUp/PgDn', description: 'Jump 10 lines' },
    { key: 'Home', description: 'Go to first item' },
    { key: 'End', description: 'Go to last item' },
    { key: 'Enter', description: 'Select / Confirm' },
  ]
};

const VIEWER_SHORTCUTS: ShortcutGroup = {
  title: 'File Viewer',
  shortcuts: [
    { key: 'g', description: 'Go to first line' },
    { key: 'G', description: 'Go to last line' },
    { key: 'e', description: 'Jump to error (if any)' },
    { key: 'm', description: 'Toggle minimap' },
  ]
};

const BROWSER_SHORTCUTS: ShortcutGroup = {
  title: 'File Browser',
  shortcuts: [
    { key: '/', description: 'Search files' },
    { key: 'Backspace', description: 'Go to parent directory' },
    { key: 'Enter', description: 'Open file / Enter directory' },
  ]
};

function ShortcutSection({ group, theme }: { group: ShortcutGroup; theme: any }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={0}>
        <Text color={theme.primary} bold>{group.title}</Text>
      </Box>
      {group.shortcuts.map((shortcut, i) => (
        <Box key={i}>
          <Box width={14}>
            <Text color={theme.accent} bold>{shortcut.key}</Text>
          </Box>
          <Text color={theme.dim}>{shortcut.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HelpOverlay({ onClose, context = 'main' }: HelpOverlayProps) {
  const theme = useTheme();
  
  useInput((input, key) => {
    if (key.escape || input === '?' || input === 'q') {
      onClose();
    }
  });

  // Determine which shortcut groups to show
  const groups: ShortcutGroup[] = [GLOBAL_SHORTCUTS, NAVIGATION_SHORTCUTS];
  
  if (context === 'viewer') {
    groups.push(VIEWER_SHORTCUTS);
  } else if (context === 'browser') {
    groups.push(BROWSER_SHORTCUTS);
  }

  return (
    <Box 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center"
      width="100%"
      height="100%"
    >
      <Panel 
        title="Keyboard Shortcuts" 
        icon={symbols.key}
        borderColor={theme.accent}
        width={50}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">
          {/* Header */}
          <Box marginBottom={1} justifyContent="center">
            <Text color={theme.dim}>
              {symbols.info} Press <Text color={theme.accent} bold>ESC</Text> or <Text color={theme.accent} bold>?</Text> to close
            </Text>
          </Box>
          
          {/* Shortcut Sections */}
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="column" width="48%">
              {groups.slice(0, 2).map((group, i) => (
                <ShortcutSection key={i} group={group} theme={theme} />
              ))}
            </Box>
            <Box flexDirection="column" width="48%">
              {groups.slice(2).map((group, i) => (
                <ShortcutSection key={i} group={group} theme={theme} />
              ))}
            </Box>
          </Box>
          
          {/* Tips */}
          <Box 
            marginTop={1} 
            paddingTop={1}
            borderStyle="single"
            borderColor={theme.dim}
            borderTop={true}
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
          >
            <Text color={theme.dim}>
              {symbols.lightning} <Text color={theme.secondary}>Tip:</Text> Most actions can be triggered with a single key
            </Text>
          </Box>
        </Box>
      </Panel>
    </Box>
  );
}

// Compact inline help hint for status bars
export function HelpHint({ theme }: { theme: any }) {
  return (
    <Box>
      <Text color={theme.dim}>Press </Text>
      <Text color={theme.accent} bold>?</Text>
      <Text color={theme.dim}> for help</Text>
    </Box>
  );
}
