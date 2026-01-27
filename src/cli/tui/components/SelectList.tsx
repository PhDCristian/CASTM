/**
 * SelectList Component - Navigable list with keyboard controls
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useTheme, symbols } from '../theme.js';

export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
  disabled?: boolean;
}

interface SelectListProps<T = string> {
  options: SelectOption<T>[];
  onSelect: (value: T) => void;
  onHighlight?: (value: T, index: number) => void;
  onEscape?: () => void;
  initialIndex?: number;
}

export function SelectList<T = string>({ 
  options, 
  onSelect, 
  onHighlight,
  onEscape,
  initialIndex = 0 
}: SelectListProps<T>) {
  const theme = useTheme();
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  
  // Filter out disabled options for navigation
  const enabledIndices = options
    .map((opt, i) => opt.disabled ? -1 : i)
    .filter(i => i >= 0);
  
  useEffect(() => {
    if (onHighlight && enabledIndices.length > 0) {
      const actualIndex = enabledIndices[selectedIndex] ?? enabledIndices[0];
      onHighlight(options[actualIndex].value, actualIndex);
    }
  }, [selectedIndex]);
  
  useInput((input, key) => {
    if (key.escape) {
      if (onEscape) {
        onEscape();
      } else {
        exit();
      }
      return;
    }
    
    if (key.upArrow) {
      setSelectedIndex(prev => {
        const newIndex = prev > 0 ? prev - 1 : enabledIndices.length - 1;
        return newIndex;
      });
    }
    
    if (key.downArrow) {
      setSelectedIndex(prev => {
        const newIndex = prev < enabledIndices.length - 1 ? prev + 1 : 0;
        return newIndex;
      });
    }
    
    if (key.return) {
      const actualIndex = enabledIndices[selectedIndex];
      if (actualIndex !== undefined) {
        onSelect(options[actualIndex].value);
      }
    }
    
    // Ctrl+C to exit
    if (input === 'c' && key.ctrl) {
      exit();
    }
  });
  
  return (
    <Box flexDirection="column" gap={0}>
      {options.map((option, index) => {
        const isSelected = enabledIndices[selectedIndex] === index;
        const isDisabled = option.disabled;
        
        if (isDisabled) {
          // Separator - subtle line
          return (
            <Box key={index} paddingX={1} marginY={0}>
              <Text color={theme.dim}>{option.label}</Text>
            </Box>
          );
        }
        
        // Premium single-line design:
        // Selected:     ▶ Label · description (bright + accent)
        // Not selected:   Label · description (white + dim)
        return (
          <Box key={index} paddingX={1}>
            {isSelected ? (
              <>
                <Text color={theme.primary} bold>{symbols.pointer} </Text>
                <Text color="white" bold>{option.label}</Text>
                {option.description && (
                  <>
                    <Text color={theme.dim}> · </Text>
                    <Text color={theme.accent}>{option.description}</Text>
                  </>
                )}
              </>
            ) : (
              <>
                <Text>  </Text>
                <Text color="#aaaaaa">{option.label}</Text>
                {option.description && (
                  <>
                    <Text color={theme.dim}> · </Text>
                    <Text color={theme.dim}>{option.description}</Text>
                  </>
                )}
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
