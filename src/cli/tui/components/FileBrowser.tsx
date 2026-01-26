/**
 * FileBrowser Component - File browser with side-by-side preview
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { useTheme, symbols } from '../theme.js';
import { CodePreview } from './CodePreview.js';

interface FileBrowserProps {
  initialPath: string;
  onSelect: (filePath: string) => void;
  onEscape: () => void;
}

interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export function FileBrowser({ initialPath, onSelect, onEscape }: FileBrowserProps) {
  const theme = useTheme();
  const { exit } = useApp();
  const [currentDir, setCurrentDir] = useState(initialPath);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  
  // Load directory entries
  useEffect(() => {
    try {
      const items = readdirSync(currentDir);
      
      const dirs = items
        .filter(item => {
          try {
            return statSync(join(currentDir, item)).isDirectory() && !item.startsWith('.');
          } catch {
            return false;
          }
        })
        .sort()
        .map(name => ({ name, isDirectory: true, path: join(currentDir, name) }));
      
      const files = items
        .filter(item => item.endsWith('.dsl'))
        .sort()
        .map(name => ({ name, isDirectory: false, path: join(currentDir, name) }));
      
      const newEntries: FileEntry[] = [];
      
      // Add parent directory if not at root
      if (currentDir !== '/') {
        newEntries.push({ name: '..', isDirectory: true, path: dirname(currentDir) });
      }
      
      newEntries.push(...dirs, ...files);
      setEntries(newEntries);
      setSelectedIndex(0);
    } catch {
      setEntries([]);
    }
  }, [currentDir]);
  
  // Update preview when selection changes
  useEffect(() => {
    const entry = entries[selectedIndex];
    if (!entry) {
      setPreviewContent(null);
      setPreviewFile(null);
      return;
    }
    
    if (entry.isDirectory) {
      // Preview first DSL file in directory
      try {
        const items = readdirSync(entry.name === '..' ? dirname(currentDir) : entry.path);
        const firstDsl = items.find(f => f.endsWith('.dsl'));
        if (firstDsl) {
          const dslPath = join(entry.name === '..' ? dirname(currentDir) : entry.path, firstDsl);
          const content = readFileSync(dslPath, 'utf-8');
          setPreviewContent(content);
          setPreviewFile(firstDsl);
        } else {
          setPreviewContent(null);
          setPreviewFile(null);
        }
      } catch {
        setPreviewContent(null);
        setPreviewFile(null);
      }
    } else {
      // Preview selected file
      try {
        const content = readFileSync(entry.path, 'utf-8');
        setPreviewContent(content);
        setPreviewFile(entry.name);
      } catch {
        setPreviewContent(null);
        setPreviewFile(null);
      }
    }
  }, [selectedIndex, entries]);
  
  useInput((input, key) => {
    if (key.escape) {
      onEscape();
      return;
    }
    
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : entries.length - 1));
    }
    
    if (key.downArrow) {
      setSelectedIndex(prev => (prev < entries.length - 1 ? prev + 1 : 0));
    }
    
    if (key.return) {
      const entry = entries[selectedIndex];
      if (!entry) return;
      
      if (entry.isDirectory) {
        setCurrentDir(entry.path);
      } else {
        onSelect(entry.path);
      }
    }
    
    if (input === 'c' && key.ctrl) {
      exit();
    }
  });
  
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Browse</Text>
        <Text color={theme.dim}> {symbols.arrow} </Text>
        <Text color={theme.dim}>{currentDir}</Text>
      </Box>
      
      {/* Two-column layout */}
      <Box>
        {/* Left: File list */}
        <Box flexDirection="column" width={40} marginRight={2}>
          {entries.length === 0 ? (
            <Text color={theme.dim}>No files found</Text>
          ) : (
            entries.map((entry, index) => {
              const isSelected = index === selectedIndex;
              const icon = entry.isDirectory ? symbols.folder : symbols.file;
              const iconColor = entry.isDirectory ? theme.accent : theme.dim;
              
              return (
                <Box key={entry.path}>
                  <Text color={isSelected ? theme.primary : theme.dim}>
                    {isSelected ? symbols.pointer : ' '}{' '}
                  </Text>
                  <Text color={iconColor}>{icon} </Text>
                  <Text color={isSelected ? 'white' : theme.dim} bold={isSelected}>
                    {entry.name}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>
        
        {/* Right: Preview */}
        <Box flexDirection="column" flexGrow={1}>
          {previewContent ? (
            <CodePreview 
              code={previewContent} 
              title={previewFile || undefined}
              maxLines={12}
            />
          ) : (
            <Box borderStyle="round" borderColor={theme.dim} paddingX={1} paddingY={1}>
              <Text color={theme.dim}>No preview available</Text>
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Footer hints */}
      <Box marginTop={1}>
        <Text backgroundColor="#333333" color="white"> ↑↓ </Text>
        <Text color={theme.dim}> navigate  </Text>
        <Text backgroundColor="#333333" color="white"> ⏎ </Text>
        <Text color={theme.dim}> select  </Text>
        <Text backgroundColor="#333333" color="white"> ESC </Text>
        <Text color={theme.dim}> back</Text>
      </Box>
    </Box>
  );
}
