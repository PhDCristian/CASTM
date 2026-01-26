import React, { ReactNode } from 'react';
import { Box } from 'ink';
import { StatusBar } from './StatusBar.js';
import { useTheme } from '../theme.js';

interface LayoutProps {
  children: ReactNode;
  status?: string;
  file?: string;
  fullScreen?: boolean;
}

export function Layout({ children, status, file, fullScreen = false }: LayoutProps) {
  const theme = useTheme();

  if (fullScreen) {
    return <>{children}</>;
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Main Content Area */}
      <Box flexGrow={1} flexDirection="column" paddingX={2} paddingY={1}>
        {children}
      </Box>

      {/* Footer / Status Bar */}
      <StatusBar status={status} file={file} />
    </Box>
  );
}
