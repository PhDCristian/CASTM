/**
 * Panel Component - Premium Vercel-style container with Unicode borders
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme, premiumColors, boxStyles, symbols } from '../theme.js';

type PanelVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'muted' | 'accent';
type BorderStyle = 'rounded' | 'sharp' | 'double' | 'heavy' | 'none';

interface PanelProps {
  title?: string;
  icon?: string;
  children: React.ReactNode;
  borderColor?: string;
  width?: number | string;
  height?: number | string;
  paddingX?: number;
  paddingY?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  variant?: PanelVariant;
  borderStyle?: BorderStyle;
  footer?: React.ReactNode;
  flexGrow?: number;
  noBorder?: boolean;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
}

export function Panel({ 
  title, 
  icon,
  children, 
  borderColor, 
  width, 
  height,
  paddingX = 1, 
  paddingY = 0,
  marginTop = 0,
  marginBottom = 0,
  marginLeft = 0,
  marginRight = 0,
  variant = 'default',
  borderStyle = 'rounded',
  footer,
  flexGrow,
  noBorder = false,
  subtitle,
  badge,
  badgeColor,
}: PanelProps) {
  const theme = useTheme();
  
  // Determine color based on variant or explicit borderColor
  let color = borderColor;
  if (!color) {
    switch (variant) {
      case 'success': color = premiumColors.statusSuccess; break;
      case 'error': color = premiumColors.statusError; break;
      case 'warning': color = premiumColors.statusWarning; break;
      case 'info': color = premiumColors.accentBlue; break;
      case 'accent': color = premiumColors.accentPink; break;
      case 'muted': color = premiumColors.borderDim; break;
      default: color = premiumColors.accentCyan;
    }
  }
  
  // Get border characters based on style
  const borders = borderStyle !== 'none' ? boxStyles[borderStyle] || boxStyles.rounded : null;
  
  // Render without border
  if (noBorder || borderStyle === 'none') {
    return (
      <Box 
        flexDirection="column" 
        width={width}
        height={height}
        paddingX={paddingX}
        paddingY={paddingY}
        marginTop={marginTop}
        marginBottom={marginBottom}
        marginLeft={marginLeft}
        marginRight={marginRight}
        flexGrow={flexGrow}
      >
        {title && (
          <Box marginBottom={1}>
            {icon && <Text color={color}>{icon} </Text>}
            <Text color={premiumColors.textBright} bold>{title}</Text>
            {subtitle && <Text color={premiumColors.textMuted}> {symbols.separator} {subtitle}</Text>}
            {badge && (
              <Text color={badgeColor || color}> [{badge}]</Text>
            )}
          </Box>
        )}
        <Box flexDirection="column" flexGrow={1}>
          {children}
        </Box>
        {footer && <Box marginTop={1}>{footer}</Box>}
      </Box>
    );
  }
  
  // Use Ink's built-in border with "round" style for rounded corners
  const inkBorderStyle = borderStyle === 'rounded' ? 'round' : 
                         borderStyle === 'double' ? 'double' : 
                         borderStyle === 'heavy' ? 'bold' : 'single';
  
  return (
    <Box 
      flexDirection="column" 
      width={width}
      height={height}
      borderStyle={inkBorderStyle}
      borderColor={color}
      paddingX={paddingX}
      paddingY={paddingY}
      marginTop={marginTop}
      marginBottom={marginBottom}
      marginLeft={marginLeft}
      marginRight={marginRight}
      flexGrow={flexGrow}
    >
      {/* Header with title, icon, and optional badge */}
      {title && (
        <Box marginTop={-1} marginBottom={1} gap={1}>
          <Box>
            {icon && <Text color={color}>{icon} </Text>}
            <Text color={premiumColors.textBright} bold>{title}</Text>
            {subtitle && <Text color={premiumColors.textMuted}> › {subtitle}</Text>}
          </Box>
          {badge && (
            <Box>
              <Text backgroundColor={badgeColor || color} color="#000"> {badge} </Text>
            </Box>
          )}
        </Box>
      )}
      
      {/* Content */}
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
      
      {/* Footer */}
      {footer && (
        <Box marginTop={1} borderStyle="single" borderColor={premiumColors.borderDim} borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
          {footer}
        </Box>
      )}
    </Box>
  );
}

// Status Badge component for inline status indicators
export function StatusBadge({ 
  status, 
  label 
}: { 
  status: 'success' | 'error' | 'warning' | 'info' | 'pending'; 
  label?: string;
}) {
  const colors: Record<string, string> = {
    success: premiumColors.statusSuccess,
    error: premiumColors.statusError,
    warning: premiumColors.statusWarning,
    info: premiumColors.accentBlue,
    pending: premiumColors.textMuted,
  };
  
  const icons: Record<string, string> = {
    success: symbols.success,
    error: symbols.error,
    warning: symbols.warning,
    info: symbols.info,
    pending: symbols.pending,
  };
  
  return (
    <Box>
      <Text color={colors[status]}>{icons[status]}</Text>
      {label && <Text color={colors[status]}> {label}</Text>}
    </Box>
  );
}

// Keyboard shortcut hint component
export function KeyHint({ keys, label }: { keys: string; label: string }) {
  return (
    <Box>
      <Text backgroundColor={premiumColors.bgLight} color={premiumColors.textBright}> {keys} </Text>
      <Text color={premiumColors.textMuted}> {label}</Text>
    </Box>
  );
}

// Separator line component
export function Separator({ color, style = 'normal' }: { color?: string; style?: 'normal' | 'dotted' | 'double' }) {
  const char = style === 'dotted' ? symbols.separatorDot : style === 'double' ? symbols.separatorDouble : symbols.separator;
  return (
    <Box marginY={1}>
      <Text color={color || premiumColors.borderDim}>{char.repeat(40)}</Text>
    </Box>
  );
}

// Convenience exports with pre-configured variants
export function SuccessPanel(props: Omit<PanelProps, 'variant'>) {
  return <Panel {...props} variant="success" icon={symbols.success} />;
}

export function ErrorPanel(props: Omit<PanelProps, 'variant'>) {
  return <Panel {...props} variant="error" icon={symbols.error} />;
}

export function WarningPanel(props: Omit<PanelProps, 'variant'>) {
  return <Panel {...props} variant="warning" icon={symbols.warning} />;
}

export function InfoPanel(props: Omit<PanelProps, 'variant'>) {
  return <Panel {...props} variant="info" icon={symbols.info} />;
}

export function AccentPanel(props: Omit<PanelProps, 'variant'>) {
  return <Panel {...props} variant="accent" />;
}
