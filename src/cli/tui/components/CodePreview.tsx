/**
 * CodePreview Component - Premium syntax-highlighted DSL code display
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme, symbols, premiumColors } from '../theme.js';

interface CodePreviewProps {
  code: string;
  title?: string;
  maxLines?: number;
  highlightLine?: number;
  activeLines?: number[];
  errorLines?: number[];
}

// Token types for syntax highlighting
type TokenType = 'keyword' | 'directive' | 'operation' | 'register' | 'string' | 'number' | 'comment' | 'address' | 'punctuation' | 'label' | 'pragma' | 'default';

interface Token {
  text: string;
  type: TokenType;
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  
  // Full-line comment
  const commentMatch = line.match(/^(\s*)(\/\/.*)$/);
  if (commentMatch) {
    if (commentMatch[1]) tokens.push({ text: commentMatch[1], type: 'default' });
    tokens.push({ text: commentMatch[2], type: 'comment' });
    return tokens;
  }
  
  // Pragma
  if (line.trim().startsWith('#')) {
    tokens.push({ text: line, type: 'pragma' });
    return tokens;
  }
  
  const patterns: [RegExp, TokenType][] = [
    [/\/\/.*$/, 'comment'],
    [/"[^"]*"/, 'string'],
    [/@\d+,\d+:/, 'address'],
    [/#\w+/, 'pragma'],
    [/\.(data|kernel|config|assert)\b/, 'directive'],
    [/\b(kernel|config|cycle|function|for|while|if|else|row|end)\b/, 'keyword'],
    [/\b(LWI|SWI|SADD|SSUB|SMUL|SDIV|NOP|EXIT|ASSERT|MUL|ADD|SUB|DIV|AND|OR|XOR|SHL|SHR|MOV|CMP|JMP|BEQ|BNE)\b/, 'operation'],
    [/\b(ROUT|RCL|RCR|RCU|RCD|ZERO|R[0-7]|IMM)\b/, 'register'],
    [/\b(0x[0-9A-Fa-f]+|\d+)\b/, 'number'],
    [/[{}()\[\];,:]/, 'punctuation'],
    [/\w+(?=:)/, 'label'],
  ];
  
  let remaining = line;
  
  while (remaining.length > 0) {
    let matched = false;
    
    for (const [pattern, type] of patterns) {
      const match = remaining.match(pattern);
      if (match && match.index === 0) {
        tokens.push({ text: match[0], type });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      let nextMatch = remaining.length;
      for (const [pattern] of patterns) {
        const match = remaining.match(pattern);
        if (match && match.index !== undefined && match.index > 0 && match.index < nextMatch) {
          nextMatch = match.index;
        }
      }
      
      if (nextMatch > 0) {
        tokens.push({ text: remaining.slice(0, nextMatch), type: 'default' });
        remaining = remaining.slice(nextMatch);
      } else {
        tokens.push({ text: remaining, type: 'default' });
        break;
      }
    }
  }
  
  return tokens;
}

function TokenText({ token, theme }: { token: Token; theme: any }) {
  // Premium color scheme with better contrast
  const colors: Record<TokenType, string> = {
    keyword: theme.primary,           // Cyan - keywords stand out
    directive: theme.accent,          // Pink - directives
    operation: premiumColors.accentGreen,  // Bright green - operations
    register: premiumColors.accentOrange,  // Orange - registers
    string: theme.secondary,          // Purple - strings
    number: premiumColors.accentYellow,    // Yellow - numbers
    comment: premiumColors.textMuted,      // Muted gray - comments
    address: theme.accent,            // Pink - addresses
    punctuation: premiumColors.textDim,    // Dim - punctuation
    label: theme.primary,             // Cyan - labels
    pragma: theme.accent,             // Pink - pragmas
    default: premiumColors.textNormal,     // Normal text
  };
  
  return <Text color={colors[token.type]}>{token.text}</Text>;
}

// Line gutter component
function Gutter({ 
  lineNum, 
  isHighlighted, 
  isActive, 
  isError, 
  width,
  theme 
}: { 
  lineNum: number;
  isHighlighted: boolean;
  isActive: boolean;
  isError: boolean;
  width: number;
  theme: any;
}) {
  // Indicator character
  let indicator = ' ';
  let indicatorColor = premiumColors.textDim;
  
  if (isError) {
    indicator = '!';
    indicatorColor = theme.error;
  } else if (isHighlighted) {
    indicator = '>';
    indicatorColor = theme.warning;
  } else if (isActive) {
    indicator = '*';
    indicatorColor = theme.primary;
  }
  
  // Line number color
  const numColor = isHighlighted ? theme.primary : premiumColors.textDim;
  
  return (
    <Box>
      <Text color={indicatorColor} bold>{indicator}</Text>
      <Text color={numColor}>{String(lineNum).padStart(width)} </Text>
      <Text color={isHighlighted ? theme.primary : premiumColors.borderDim}>| </Text>
    </Box>
  );
}

export function CodePreview({ 
  code, 
  title, 
  maxLines = 8, 
  highlightLine,
  activeLines = [],
  errorLines = [],
}: CodePreviewProps) {
  const theme = useTheme();
  const allLines = code.split('\n');
  
  // Calculate viewport based on highlightLine
  let startLineIndex = 0;
  if (highlightLine && highlightLine > 0) {
    const halfWindow = Math.floor(maxLines / 2);
    startLineIndex = Math.max(0, highlightLine - 1 - halfWindow);
    
    if (startLineIndex + maxLines > allLines.length) {
      startLineIndex = Math.max(0, allLines.length - maxLines);
    }
  }

  const lines = allLines.slice(startLineIndex, startLineIndex + maxLines);
  const lineNumWidth = String(allLines.length).length;
  
  // Create sets for O(1) lookup
  const activeSet = new Set(activeLines);
  const errorSet = new Set(errorLines);
  
  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text color={theme.primary}># </Text>
          <Text color={premiumColors.textBright} bold>{title}</Text>
        </Box>
      )}
      
      {/* Scroll indicator - top */}
      {startLineIndex > 0 && (
         <Box paddingLeft={lineNumWidth + 4}>
           <Text color={premiumColors.textDim}>^ {startLineIndex} lines above</Text>
         </Box>
      )}

      {lines.map((line, i) => {
        const lineNum = startLineIndex + i + 1;
        const isHighlighted = lineNum === highlightLine;
        const isActive = activeSet.has(lineNum);
        const isError = errorSet.has(lineNum);
        const tokens = tokenizeLine(line);
        
        return (
          <Box 
            key={i} 
            backgroundColor={isHighlighted ? premiumColors.bgHighlight : undefined}
          >
            <Gutter
              lineNum={lineNum}
              isHighlighted={isHighlighted}
              isActive={isActive}
              isError={isError}
              width={lineNumWidth}
              theme={theme}
            />
            
            {/* Code content */}
            <Box flexGrow={1}>
              {tokens.length > 0 ? (
                tokens.map((token, j) => (
                  <TokenText key={j} token={token} theme={theme} />
                ))
              ) : (
                <Text> </Text>
              )}
            </Box>
            
            {/* Active indicator on the right */}
            {isActive && !isHighlighted && (
              <Box marginLeft={1}>
                <Text color={theme.primary}>*</Text>
              </Box>
            )}
          </Box>
        );
      })}
      
      {/* Scroll indicator - bottom */}
      {startLineIndex + maxLines < allLines.length && (
        <Box paddingLeft={lineNumWidth + 4}>
          <Text color={premiumColors.textDim}>
            v {allLines.length - (startLineIndex + maxLines)} more lines
          </Text>
        </Box>
      )}
    </Box>
  );
}
