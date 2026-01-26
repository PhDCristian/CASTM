/**
 * FileBrowser Component - File browser with side-by-side preview
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
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
  const [allEntries, setAllEntries] = useState<FileEntry[]>([]);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
      setAllEntries(newEntries);
      setSelectedIndex(0);
      setSearchQuery(''); // Reset search on dir change
      setIsSearching(false);
    } catch {
      setAllEntries([]);
    }
  }, [currentDir]);

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery) return allEntries;
    return allEntries.filter(entry => 
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      entry.name === '..' // Always keep parent dir
    );
  }, [allEntries, searchQuery]);
  
  // Update preview when selection changes
  useEffect(() => {
    const entry = filteredEntries[selectedIndex];
    if (!entry) {
      setPreviewContent(null);
      setPreviewFile(null);
      return;
    }
    
    if (entry.isDirectory) {
      // Preview first DSL file in directory
      try {
        const targetPath = entry.name === '..' ? dirname(currentDir) : entry.path;
        const items = readdirSync(targetPath);
        const firstDsl = items.find(f => f.endsWith('.dsl'));
        if (firstDsl) {
          const dslPath = join(targetPath, firstDsl);
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
  }, [selectedIndex, filteredEntries, currentDir]);
  
  useInput((input, key) => {
    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        setSearchQuery('');
        return;
      }
      if (key.return) {
        setIsSearching(false);
        // If only one result (plus parent), select it automatically? 
        // For now just exit search mode and keep selection logic below
        return;
      }
      // Let TextInput handle the rest
      return;
    }

    if (key.escape) {
      if (searchQuery) {
        setSearchQuery('');
        return;
      }
      onEscape();
      return;
    }
    
    // Navigation
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredEntries.length - 1));
    }
    
    if (key.downArrow) {
      setSelectedIndex(prev => (prev < filteredEntries.length - 1 ? prev + 1 : 0));
    }

    if (key.pageUp) {
      setSelectedIndex(prev => Math.max(0, prev - 10));
    }

    if (key.pageDown) {
      setSelectedIndex(prev => Math.min(filteredEntries.length - 1, prev + 10));
    }

    if (key.home) {
      setSelectedIndex(0);
    }

    if (key.end) {
      setSelectedIndex(filteredEntries.length - 1);
    }

    // Actions
    if (key.return) {
      const entry = filteredEntries[selectedIndex];
      if (!entry) return;
      
      if (entry.isDirectory) {
        setCurrentDir(entry.path);
      } else {
        onSelect(entry.path);
      }
    }

    if (key.backspace || key.delete) {
      if (currentDir !== '/') {
        setCurrentDir(dirname(currentDir));
      }
    }
    
    if (input === 'c' && key.ctrl) {
      exit();
    }

    if (input === '/' && !isSearching) {
      setIsSearching(true);
    }
  });
  
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color={theme.primary} bold>Browse</Text>
          <Text color={theme.dim}> {symbols.arrow} </Text>
          <Text color={theme.dim}>{currentDir}</Text>
        </Box>
        {isSearching && (
          <Box>
            <Text color={theme.accent}>Search: </Text>
            <TextInput value={searchQuery} onChange={setSearchQuery} />
          </Box>
        )}
      </Box>
      
      {/* Two-column layout */}
      <Box>
        {/* Left: File list */}
        <Box flexDirection="column" width={40} marginRight={2}>
          {filteredEntries.length === 0 ? (
            <Text color={theme.dim}>No files found</Text>
          ) : (
            filteredEntries.map((entry, index) => {
              // Sliding window for long lists could be implemented here
              // For now, let's limit rendering if list is huge, or just rely on Ink
              // Showing a window of files around selected index would be better for perf
              const WINDOW_SIZE = 20;
              const start = Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2));
              const end = start + WINDOW_SIZE;
              
              if (index < start || index >= end) return null;

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
          {filteredEntries.length > 20 && (
             <Box marginTop={1}>
               <Text color={theme.dim}>... {filteredEntries.length} items</Text>
             </Box>
          )}
        </Box>
        
        {/* Right: Preview */}
        <Box flexDirection="column" flexGrow={1}>
          {previewContent ? (
            <CodePreview 
              code={previewContent} 
              title={previewFile || undefined}
              maxLines={18} // Increased height
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
        <Text backgroundColor="#333333" color="white"> / </Text>
        <Text color={theme.dim}> search  </Text>
        <Text backgroundColor="#333333" color="white"> Bksp </Text>
        <Text color={theme.dim}> up  </Text>
        <Text backgroundColor="#333333" color="white"> ESC </Text>
        <Text color={theme.dim}> back</Text>
      </Box>
    </Box>
  );
}
