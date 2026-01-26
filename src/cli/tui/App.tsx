/**
 * OpenEdge TUI - Main Application
 * React-like terminal UI with Ink
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, render, useApp, useInput } from 'ink';
import gradient from 'gradient-string';
import { readFileSync } from 'fs';
import { basename, dirname } from 'path';

import { useTheme, symbols } from './theme.js';
import { SelectList, SelectOption, FileBrowser, CodePreview } from './components/index.js';
import { 
  getRecentFiles, 
  addRecentFile, 
  getLastDirectory,
  setLastDirectory,
  getCurrentTheme,
  setTheme,
  getThemeNames,
  BUILTIN_THEMES,
  loadConfig,
  saveConfig,
} from '../config/store.js';
import { compileDslToCsv } from '../../compiler.js';
import { getRelativePath, getOutputPath, writeFile } from '../utils/files.js';

// ═══════════════════════════════════════════════════════════════════════════
// LOGO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const LOGO_LINES = [
  ' ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██████╗  ██████╗ ███████╗',
  '██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██╔════╝ ██╔════╝',
  '██║   ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ██║  ██║██║  ███╗█████╗  ',
  '██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══╝  ██║  ██║██║   ██║██╔══╝  ',
  '╚██████╔╝██║     ███████╗██║ ╚████║███████╗██████╔╝╚██████╔╝███████╗',
  ' ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚═════╝  ╚═════╝ ╚══════╝',
];

const STARTUP_TIPS = [
  'Use "openedge watch" for auto-recompile on save',
  'Press ESC at any time to go back',
  'Try "openedge theme dracula" for a dark purple theme',
  'Recent files are saved for quick access',
  'Navigate menus with arrow keys, select with Enter',
];

function Logo() {
  const theme = useTheme();
  const brand = gradient([theme.primary, theme.secondary]);
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      {LOGO_LINES.map((line, i) => (
        <Text key={i}>{brand(line)}</Text>
      ))}
      <Box marginTop={1}>
        <Text color={theme.dim}>CGRA Compiler Toolchain</Text>
        <Text color={theme.dim}> · </Text>
        <Text color={theme.primary}>v0.1.0</Text>
      </Box>
    </Box>
  );
}

function RandomTip() {
  const theme = useTheme();
  const [tip] = useState(() => STARTUP_TIPS[Math.floor(Math.random() * STARTUP_TIPS.length)]);
  
  return (
    <Box marginBottom={1}>
      <Text color={theme.dim}>tip: </Text>
      <Text color={theme.accent}>{tip}</Text>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Screen = 
  | { type: 'main' }
  | { type: 'browse' }
  | { type: 'recent' }
  | { type: 'settings' }
  | { type: 'theme' }
  | { type: 'compile'; file: string }
  | { type: 'result'; success: boolean; message: string; details?: string[] };

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MENU SCREEN
// ═══════════════════════════════════════════════════════════════════════════

interface MainMenuProps {
  selectedFile: string | null;
  onNavigate: (screen: Screen) => void;
}

function MainMenu({ selectedFile, onNavigate }: MainMenuProps) {
  const theme = useTheme();
  const { exit } = useApp();
  const recentFiles = getRecentFiles();
  
  const options: SelectOption<string>[] = [];
  
  if (selectedFile) {
    options.push(
      { label: 'Compile', value: 'compile', description: '→ CSV' },
      { label: 'Check', value: 'check', description: 'validate syntax' },
      { label: 'Info', value: 'info', description: 'show details' },
      { label: 'Preview', value: 'preview', description: 'view source' },
      { label: 'Watch', value: 'watch', description: 'auto-rebuild' },
      { label: '─'.repeat(30), value: '__SEP1__', disabled: true },
      { label: 'Change file', value: 'browse' },
    );
  } else {
    options.push({ label: 'Open file', value: 'browse' });
    
    if (recentFiles.length > 0) {
      options.push({ label: 'Recent', value: 'recent', description: `(${recentFiles.length})` });
    }
  }
  
  options.push(
    { label: '─'.repeat(30), value: '__SEP2__', disabled: true },
    { label: 'Settings', value: 'settings' },
    { label: 'Exit', value: 'exit' },
  );
  
  const handleSelect = (value: string) => {
    switch (value) {
      case 'browse':
        onNavigate({ type: 'browse' });
        break;
      case 'recent':
        onNavigate({ type: 'recent' });
        break;
      case 'settings':
        onNavigate({ type: 'settings' });
        break;
      case 'compile':
        if (selectedFile) onNavigate({ type: 'compile', file: selectedFile });
        break;
      case 'exit':
        exit();
        break;
    }
  };
  
  return (
    <Box flexDirection="column">
      <Logo />
      <RandomTip />
      
      {selectedFile && (
        <Box marginBottom={1}>
          <Text color={theme.dim}>file </Text>
          <Text color={theme.primary}>{basename(selectedFile)}</Text>
          <Text color={theme.dim}> in {dirname(selectedFile)}</Text>
        </Box>
      )}
      
      <SelectList 
        options={options} 
        onSelect={handleSelect}
        onEscape={() => exit()}
      />
      
      <Box marginTop={1}>
        <Text backgroundColor="#333333" color="white"> ↑↓ </Text>
        <Text color={theme.dim}> navigate  </Text>
        <Text backgroundColor="#333333" color="white"> ⏎ </Text>
        <Text color={theme.dim}> select  </Text>
        <Text backgroundColor="#333333" color="white"> ^C </Text>
        <Text color={theme.dim}> exit</Text>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════════════════════

interface SettingsProps {
  onNavigate: (screen: Screen) => void;
}

function Settings({ onNavigate }: SettingsProps) {
  const theme = useTheme();
  const config = loadConfig();
  
  const options: SelectOption<string>[] = [
    { 
      label: 'Theme', 
      value: 'theme', 
      description: `· ${BUILTIN_THEMES[config.theme]?.name || config.theme}` 
    },
    { 
      label: 'Spinners', 
      value: 'spinners', 
      description: config.showSpinners ? '· on' : '· off' 
    },
    { label: '─'.repeat(30), value: '__SEP__', disabled: true },
    { label: 'Back', value: 'back' },
  ];
  
  const handleSelect = (value: string) => {
    switch (value) {
      case 'theme':
        onNavigate({ type: 'theme' });
        break;
      case 'spinners':
        config.showSpinners = !config.showSpinners;
        saveConfig(config);
        // Re-render by navigating to same screen
        onNavigate({ type: 'settings' });
        break;
      case 'back':
        onNavigate({ type: 'main' });
        break;
    }
  };
  
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Settings</Text>
      </Box>
      
      <SelectList 
        options={options} 
        onSelect={handleSelect}
        onEscape={() => onNavigate({ type: 'main' })}
      />
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME SELECTOR SCREEN
// ═══════════════════════════════════════════════════════════════════════════

interface ThemeSelectorProps {
  onNavigate: (screen: Screen) => void;
}

function ThemeSelector({ onNavigate }: ThemeSelectorProps) {
  const theme = useTheme();
  const config = loadConfig();
  const [previewTheme, setPreviewTheme] = useState(config.theme);
  
  const themeNames = getThemeNames();
  const options: SelectOption<string>[] = [
    ...themeNames.map(name => {
      const t = BUILTIN_THEMES[name];
      const isCurrent = name === config.theme;
      return {
        label: `${isCurrent ? '● ' : '  '}${t.name}`,
        value: name,
        description: '',
      };
    }),
    { label: '─'.repeat(30), value: '__SEP__', disabled: true },
    { label: 'Back', value: 'back' },
  ];
  
  const handleSelect = (value: string) => {
    if (value === 'back') {
      onNavigate({ type: 'settings' });
      return;
    }
    
    setTheme(value);
    onNavigate({ type: 'settings' });
  };
  
  const handleHighlight = (value: string) => {
    if (value !== '__SEP__' && value !== 'back') {
      setPreviewTheme(value);
    }
  };
  
  // Generate preview code with selected theme colors
  const previewT = BUILTIN_THEMES[previewTheme] || theme;
  const previewCode = [
    `// ${previewT.name} theme preview`,
    '.data input { 10, 20 }',
    '',
    'kernel "Example" {',
    '    cycle {',
    '        @0,0: LWI R0, input[0];',
    '    }',
    '}',
  ].join('\n');
  
  return (
    <Box flexDirection="row">
      {/* Left: Theme list */}
      <Box flexDirection="column" width={30} marginRight={2}>
        <Box marginBottom={1}>
          <Text color={theme.primary} bold>Theme</Text>
        </Box>
        
        <SelectList 
          options={options} 
          onSelect={handleSelect}
          onHighlight={handleHighlight}
          onEscape={() => onNavigate({ type: 'settings' })}
        />
      </Box>
      
      {/* Right: Code preview */}
      <Box flexDirection="column" flexGrow={1}>
        <Box borderStyle="round" borderColor={previewT.primary} paddingX={1} flexDirection="column">
          <Box marginBottom={1}>
            <Text color={previewT.primary} bold>{previewT.name}</Text>
          </Box>
          
          <Text color={previewT.dim}>{'// Sample code'}</Text>
          <Box>
            <Text color={previewT.accent}>.data</Text>
            <Text> input {'{'} </Text>
            <Text color={previewT.secondary}>10, 20</Text>
            <Text> {'}'}</Text>
          </Box>
          <Text> </Text>
          <Box>
            <Text color={previewT.primary}>kernel</Text>
            <Text> </Text>
            <Text color={previewT.secondary}>"Example"</Text>
            <Text> {'{'}</Text>
          </Box>
          <Box>
            <Text>    </Text>
            <Text color={previewT.primary}>cycle</Text>
            <Text> {'{'}</Text>
          </Box>
          <Box>
            <Text>        </Text>
            <Text color={previewT.accent}>@0,0:</Text>
            <Text> </Text>
            <Text color={previewT.success}>LWI</Text>
            <Text> </Text>
            <Text color={previewT.warning}>R0</Text>
            <Text>, input[0];</Text>
          </Box>
          <Text>{'    }'}</Text>
          <Text>{'}'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RECENT FILES SCREEN
// ═══════════════════════════════════════════════════════════════════════════

interface RecentFilesProps {
  onSelect: (file: string) => void;
  onNavigate: (screen: Screen) => void;
}

function RecentFiles({ onSelect, onNavigate }: RecentFilesProps) {
  const theme = useTheme();
  const recentFiles = getRecentFiles();
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  
  const options: SelectOption<string>[] = [
    ...recentFiles.map((f, i) => ({
      label: `${i + 1}. ${basename(f.path)}`,
      value: f.path,
      description: dirname(f.path),
    })),
    { label: '─'.repeat(30), value: '__SEP__', disabled: true },
    { label: 'Back', value: '__BACK__' },
  ];
  
  const handleHighlight = (value: string) => {
    if (value === '__BACK__' || value === '__SEP__') {
      setPreviewContent(null);
      setPreviewFile(null);
      return;
    }
    
    try {
      const content = readFileSync(value, 'utf-8');
      setPreviewContent(content);
      setPreviewFile(basename(value));
    } catch {
      setPreviewContent(null);
      setPreviewFile(null);
    }
  };
  
  const handleSelect = (value: string) => {
    if (value === '__BACK__') {
      onNavigate({ type: 'main' });
      return;
    }
    
    addRecentFile(value);
    onSelect(value);
    onNavigate({ type: 'main' });
  };
  
  return (
    <Box flexDirection="row">
      {/* Left: File list */}
      <Box flexDirection="column" width={40} marginRight={2}>
        <Box marginBottom={1}>
          <Text color={theme.primary} bold>Recent Files</Text>
        </Box>
        
        <SelectList 
          options={options} 
          onSelect={handleSelect}
          onHighlight={handleHighlight}
          onEscape={() => onNavigate({ type: 'main' })}
        />
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
            <Text color={theme.dim}>Select a file to preview</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILE SCREEN
// ═══════════════════════════════════════════════════════════════════════════

interface CompileScreenProps {
  file: string;
  onNavigate: (screen: Screen) => void;
}

function CompileScreen({ file, onNavigate }: CompileScreenProps) {
  const theme = useTheme();
  const [status, setStatus] = useState<'compiling' | 'success' | 'error'>('compiling');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ output: string; time: number } | null>(null);
  
  useEffect(() => {
    const compile = async () => {
      const startTime = performance.now();
      
      try {
        const content = readFileSync(file, 'utf-8');
        const result = compileDslToCsv(content);
        
        if (result.success) {
          const outputPath = getOutputPath(file);
          const writeResult = writeFile(outputPath, result.csv!);
          
          if (writeResult.success) {
            const endTime = performance.now();
            setStats({ output: getRelativePath(outputPath), time: endTime - startTime });
            setStatus('success');
            addRecentFile(file);
          } else {
            setError(writeResult.error || 'Failed to write output');
            setStatus('error');
          }
        } else {
          setError(result.error || 'Compilation failed');
          setStatus('error');
        }
      } catch (e) {
        setError(String(e));
        setStatus('error');
      }
    };
    
    // Small delay for visual feedback
    setTimeout(compile, 100);
  }, [file]);
  
  useInput((input, key) => {
    if (key.return || key.escape) {
      onNavigate({ type: 'main' });
    }
  });
  
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Compile</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color={theme.dim}>source </Text>
        <Text>{getRelativePath(file)}</Text>
      </Box>
      
      {status === 'compiling' && (
        <Text color={theme.warning}>Compiling...</Text>
      )}
      
      {status === 'success' && stats && (
        <Box flexDirection="column">
          <Box>
            <Text color={theme.success}>{symbols.success} </Text>
            <Text color={theme.success}>Compiled successfully</Text>
          </Box>
          <Box marginTop={1} borderStyle="round" borderColor={theme.success} paddingX={1} flexDirection="column">
            <Box>
              <Text color={theme.dim}>Output  </Text>
              <Text>{stats.output}</Text>
            </Box>
            <Box>
              <Text color={theme.dim}>Time    </Text>
              <Text>{stats.time.toFixed(0)}ms</Text>
            </Box>
          </Box>
        </Box>
      )}
      
      {status === 'error' && (
        <Box flexDirection="column">
          <Box>
            <Text color={theme.error}>{symbols.error} </Text>
            <Text color={theme.error}>Compilation failed</Text>
          </Box>
          <Box marginTop={1} borderStyle="round" borderColor={theme.error} paddingX={1}>
            <Text color="white">{error}</Text>
          </Box>
        </Box>
      )}
      
      {status !== 'compiling' && (
        <Box marginTop={1}>
          <Text color={theme.dim}>Press Enter to continue</Text>
        </Box>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'main' });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  const handleNavigate = (newScreen: Screen) => {
    setScreen(newScreen);
  };
  
  const handleFileSelect = (file: string) => {
    setSelectedFile(file);
    setLastDirectory(dirname(file));
    addRecentFile(file);
    setScreen({ type: 'main' });
  };
  
  switch (screen.type) {
    case 'main':
      return <MainMenu selectedFile={selectedFile} onNavigate={handleNavigate} />;
      
    case 'browse':
      return (
        <FileBrowser 
          initialPath={getLastDirectory()} 
          onSelect={handleFileSelect}
          onEscape={() => handleNavigate({ type: 'main' })}
        />
      );
      
    case 'recent':
      return (
        <RecentFiles 
          onSelect={setSelectedFile}
          onNavigate={handleNavigate}
        />
      );
      
    case 'settings':
      return <Settings onNavigate={handleNavigate} />;
      
    case 'theme':
      return <ThemeSelector onNavigate={handleNavigate} />;
      
    case 'compile':
      return <CompileScreen file={screen.file} onNavigate={handleNavigate} />;
      
    default:
      return <MainMenu selectedFile={selectedFile} onNavigate={handleNavigate} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export function runTuiMode(): void {
  render(<App />);
}
