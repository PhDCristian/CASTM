/**
 * CodePreview Component - Syntax-highlighted DSL code display
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme, symbols } from '../theme.js';

interface CodePreviewProps {
  code: string;
  title?: string;
  maxLines?: number;
  highlightLine?: number;
}

// Token types for syntax highlighting
type TokenType = 'keyword' | 'directive' | 'operation' | 'register' | 'string' | 'number' | 'comment' | 'address' | 'punctuation' | 'default';

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
  
  const patterns: [RegExp, TokenType][] = [
    [/\/\/.*$/, 'comment'],
    [/"[^"]*"/, 'string'],
    [/@\d+,\d+:/, 'address'],
    [/\.(data|kernel|config|assert)\b/, 'directive'],
    [/\b(kernel|config|cycle|function|for|while|if|else|row)\b/, 'keyword'],
    [/\b(LWI|SWI|SADD|SSUB|SMUL|SDIV|NOP|EXIT|ASSERT|MUL|ADD|SUB|DIV|AND|OR|XOR|SHL|SHR)\b/, 'operation'],
    [/\b(ROUT|RCL|RCR|RCU|RCD|ZERO|R[0-7])\b/, 'register'],
    [/\b(0x[0-9A-Fa-f]+|\d+)\b/, 'number'],
    [/[{}()\[\];,]/, 'punctuation'],
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

function TokenText({ token, theme }: { token: Token; theme: ReturnType<typeof useTheme> }) {
  const colors: Record<TokenType, string> = {
    keyword: theme.primary,
    directive: theme.accent,
    operation: theme.success,
    register: theme.warning,
    string: theme.secondary,
    number: theme.secondary,
    comment: theme.dim,
    address: theme.accent,
    punctuation: theme.dim,
    default: 'white',
  };
  
  return <Text color={colors[token.type]}>{token.text}</Text>;
}

export function CodePreview({ code, title, maxLines = 8, highlightLine }: CodePreviewProps) {
  const theme = useTheme();
  const lines = code.split('\n').slice(0, maxLines);
  const lineNumWidth = String(lines.length).length + 1;
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.dim} paddingX={1}>
      {title && (
        <Box marginBottom={1}>
          <Text color={theme.primary}>{symbols.file} </Text>
          <Text color="white" bold>{title}</Text>
        </Box>
      )}
      
      {lines.map((line, i) => {
        const lineNum = i + 1;
        const isHighlighted = lineNum === highlightLine;
        const tokens = tokenizeLine(line);
        
        return (
          <Box key={i}>
            <Text color={isHighlighted ? theme.warning : theme.dim}>
              {String(lineNum).padStart(lineNumWidth)} {symbols.line}{' '}
            </Text>
            {tokens.map((token, j) => (
              <TokenText key={j} token={token} theme={theme} />
            ))}
          </Box>
        );
      })}
      
      {code.split('\n').length > maxLines && (
        <Box marginTop={1}>
          <Text color={theme.dim}>
            ... {code.split('\n').length - maxLines} more lines
          </Text>
        </Box>
      )}
    </Box>
  );
}
