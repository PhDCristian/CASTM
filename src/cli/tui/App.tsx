/**
 * OpenEdge TUI - Main Application
 * React-like terminal UI with Ink
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, render, useApp, useStdout } from 'ink';
import gradient from 'gradient-string';
import { basename, dirname } from 'path';

import { useTheme, premiumColors, symbols, gradients } from './theme.js';
import { SelectList, SelectOption, CodePreview, FileViewer } from './components/index.js';
import { FileBrowser } from './components/FileBrowser.js';
import { CompileScreen, WatchScreen, InfoScreen, CheckScreen } from './screens/index.js';
import { SplashScreen } from './ui/SplashScreen.js';
import { Layout } from './ui/Layout.js';

import { 
  getRecentFiles, 
  getLastDirectory,
  setLastDirectory,
  setTheme,
  getThemeNames,
  BUILTIN_THEMES,
  loadConfig,
  saveConfig,
  addRecentFile
} from '../config/store.js';
import { readFileSync } from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS - Vercel Style
// ═══════════════════════════════════════════════════════════════════════════

// Sleek, minimal logo with gradient
const LOGO_LINES = [
  '╭───────────────────────────────────────────╮',
  '│                                           │',
  '│   ▲  O P E N E D G E                      │',
  '│                                           │',
  '│   CGRA Compiler Toolchain                 │',
  '│                                           │',
  '╰───────────────────────────────────────────╯',
];

const STARTUP_TIPS = [
  'Use "openedge watch" for auto-recompile on save',
  'Press ESC at any time to go back',
  'Try "openedge theme dracula" for a dark purple theme',
  'Recent files are saved for quick access',
  'Navigate menus with arrow keys, select with Enter',
  'Press ? for keyboard shortcuts',
];

function Logo() {
  const theme = useTheme();
  const brand = gradient([premiumColors.accentCyan, premiumColors.accentPink]);
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      {LOGO_LINES.map((line, i) => (
        <Text key={i}>{brand(line)}</Text>
      ))}
      <Box marginTop={1} justifyContent="center">
        <Text backgroundColor={premiumColors.accentBlue} color="#000" bold> v0.1.0 </Text>
        <Text color={premiumColors.textDim}>  CGRA DSL Compiler</Text>
      </Box>
    </Box>
  );
}

function RandomTip() {
  const theme = useTheme();
  const [tip] = useState(() => STARTUP_TIPS[Math.floor(Math.random() * STARTUP_TIPS.length)]);
  
  return (
    <Box marginBottom={1}>
      <Text color={premiumColors.accentOrange}>{symbols.lightning}</Text>
      <Text color={premiumColors.textDim}> tip: </Text>
      <Text color={premiumColors.textMuted}>{tip}</Text>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Screen = 
  | { type: 'main' }
  | { type: 'browse' }
  | { type: 'viewer'; file: string }
  | { type: 'recent' }
  | { type: 'settings' }
  | { type: 'theme' }
  | { type: 'compile'; file: string }
  | { type: 'watch'; file: string }
  | { type: 'info'; file: string }
  | { type: 'check'; file: string };

// ═══════════════════════════════════════════════════════════════════════════
// SUB-SCREENS
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
      { label: 'Watch', value: 'watch', description: 'auto-rebuild' },
      { label: '─'.repeat(25), value: '__SEP__', disabled: true },
      { label: 'Change file', value: 'browse' },
    );
  } else {
    options.push({ label: 'Open file', value: 'browse' });
    
    if (recentFiles.length > 0) {
      options.push({ label: 'Recent', value: 'recent', description: `(${recentFiles.length})` });
    }
  }
  
  options.push(
    { label: '─'.repeat(25), value: '__SEP2__', disabled: true },
    { label: 'Settings', value: 'settings' },
    { label: 'Exit', value: 'exit' },
  );
  
  const handleSelect = (value: string) => {
    switch (value) {
      case 'browse': onNavigate({ type: 'browse' }); break;
      case 'recent': onNavigate({ type: 'recent' }); break;
      case 'settings': onNavigate({ type: 'settings' }); break;
      case 'compile': if (selectedFile) onNavigate({ type: 'compile', file: selectedFile }); break;
      case 'check': if (selectedFile) onNavigate({ type: 'check', file: selectedFile }); break;
      case 'info': if (selectedFile) onNavigate({ type: 'info', file: selectedFile }); break;
      case 'watch': if (selectedFile) onNavigate({ type: 'watch', file: selectedFile }); break;
      case 'exit': exit(); break;
    }
  };
  
  return (
    <Box flexDirection="column">
      <Logo />
      <RandomTip />
      
      {selectedFile && (
        <Box marginBottom={1}>
          <Text color={premiumColors.accentGreen}>{symbols.file} </Text>
          <Text color={premiumColors.textBright} bold>{basename(selectedFile)}</Text>
          <Text color={premiumColors.textDim}> {symbols.arrow} {dirname(selectedFile)}</Text>
        </Box>
      )}
      
      <SelectList 
        options={options} 
        onSelect={handleSelect}
        onEscape={() => exit()}
      />
    </Box>
  );
}

function Settings({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const theme = useTheme();
  const config = loadConfig();
  
  const options: SelectOption<string>[] = [
    { label: 'Theme', value: 'theme', description: `› ${BUILTIN_THEMES[config.theme]?.name || config.theme}` },
    { label: 'Spinners', value: 'spinners', description: config.showSpinners ? '› on' : '› off' },
    { label: '─'.repeat(25), value: '__SEP__', disabled: true },
    { label: 'Back', value: 'back' },
  ];
  
  const handleSelect = (value: string) => {
    if (value === 'theme') onNavigate({ type: 'theme' });
    else if (value === 'spinners') { config.showSpinners = !config.showSpinners; saveConfig(config); onNavigate({ type: 'settings' }); }
    else if (value === 'back') onNavigate({ type: 'main' });
  };
  
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}><Text color={theme.primary} bold>Settings</Text></Box>
      <SelectList options={options} onSelect={handleSelect} onEscape={() => onNavigate({ type: 'main' })} />
    </Box>
  );
}

function ThemeSelector({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const theme = useTheme();
  const config = loadConfig();
  const [previewTheme, setPreviewTheme] = useState(config.theme);
  
  const themeNames = getThemeNames();
  const options: SelectOption<string>[] = [
    ...themeNames.map(name => ({ label: `${name === config.theme ? '● ' : '  '}${BUILTIN_THEMES[name].name}`, value: name })),
    { label: '─'.repeat(25), value: '__SEP__', disabled: true },
    { label: 'Back', value: 'back' },
  ];
  
  const handleSelect = (value: string) => {
    if (value === 'back') onNavigate({ type: 'settings' });
    else { setTheme(value); onNavigate({ type: 'settings' }); }
  };
  
  const previewT = BUILTIN_THEMES[previewTheme] || theme;
  
  return (
    <Box flexDirection="row">
      <Box flexDirection="column" width={30} marginRight={2}>
        <Box marginBottom={1}><Text color={theme.primary} bold>Theme</Text></Box>
        <SelectList options={options} onSelect={handleSelect} onHighlight={setPreviewTheme} onEscape={() => onNavigate({ type: 'settings' })} />
      </Box>
      <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={previewT.primary} paddingX={1}>
          <Box marginBottom={1}><Text color={previewT.primary} bold>{previewT.name}</Text></Box>
          <Text color={previewT.dim}>{'// Sample code'}</Text>
          <Box><Text color={previewT.accent}>.data</Text><Text> input {'{'} </Text><Text color={previewT.secondary}>10</Text><Text> {'}'}</Text></Box>
          <Box><Text color={previewT.primary}>kernel</Text><Text> </Text><Text color={previewT.secondary}>"Test"</Text><Text> {'{'}</Text></Box>
          <Box><Text>  </Text><Text color={previewT.success}>LWI</Text><Text> </Text><Text color={previewT.warning}>R0</Text><Text>, input[0];</Text></Box>
          <Text>{'}'}</Text>
      </Box>
    </Box>
  );
}

function RecentFiles({ onSelect, onNavigate }: { onSelect: (file: string) => void, onNavigate: (screen: Screen) => void }) {
  const theme = useTheme();
  const recentFiles = getRecentFiles();
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  
  const options: SelectOption<string>[] = [
    ...recentFiles.map((f, i) => ({ label: `${i + 1}. ${basename(f.path)}`, value: f.path, description: dirname(f.path) })),
    { label: '─'.repeat(25), value: '__SEP__', disabled: true },
    { label: 'Back', value: '__BACK__' },
  ];
  
  const handleHighlight = (value: string) => {
    if (value === '__BACK__' || value === '__SEP__') { setPreviewContent(null); return; }
    try { const content = readFileSync(value, 'utf-8'); setPreviewContent(content); setPreviewFile(basename(value)); } catch { setPreviewContent(null); }
  };
  
  const handleSelect = (value: string) => {
    if (value === '__BACK__') onNavigate({ type: 'main' });
    else { addRecentFile(value); onSelect(value); onNavigate({ type: 'viewer', file: value }); }
  };
  
  return (
    <Box flexDirection="row">
      <Box flexDirection="column" width={40} marginRight={2}>
        <Box marginBottom={1}><Text color={theme.primary} bold>Recent Files</Text></Box>
        <SelectList options={options} onSelect={handleSelect} onHighlight={handleHighlight} onEscape={() => onNavigate({ type: 'main' })} />
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {previewContent ? <CodePreview code={previewContent} title={previewFile || undefined} maxLines={12} /> : <Box borderStyle="round" borderColor={theme.dim} paddingX={1} paddingY={1}><Text color={theme.dim}>Select a file to preview</Text></Box>}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function App() {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>({ type: 'main' });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { stdout } = useStdout();
  const [, setTerminalSize] = useState({ columns: stdout.columns, rows: stdout.rows });

  useEffect(() => {
    function onResize() { setTerminalSize({ columns: stdout.columns, rows: stdout.rows }); }
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
  }, [stdout]);
  
  const handleNavigate = (newScreen: Screen) => setScreen(newScreen);
  const handleFileSelect = (file: string) => { setSelectedFile(file); setLastDirectory(dirname(file)); addRecentFile(file); setScreen({ type: 'viewer', file }); };
  
  if (loading) {
    return <Layout fullScreen><SplashScreen onComplete={() => setLoading(false)} /></Layout>;
  }

  let content;
  let statusBarFile = selectedFile ? basename(selectedFile) : undefined;
  let status = 'IDLE';

  switch (screen.type) {
    case 'main': content = <MainMenu selectedFile={selectedFile} onNavigate={handleNavigate} />; break;
    case 'browse': content = <FileBrowser initialPath={getLastDirectory()} onSelect={handleFileSelect} onEscape={() => handleNavigate({ type: 'main' })} />; status = 'BROWSING'; break;
    case 'viewer': content = <FileViewer filePath={screen.file} onBack={() => handleNavigate({ type: 'main' })} />; status = 'INSPECTING'; statusBarFile = basename(screen.file); break;
    case 'recent': content = <RecentFiles onSelect={setSelectedFile} onNavigate={handleNavigate} />; break;
    case 'settings': content = <Settings onNavigate={handleNavigate} />; break;
    case 'theme': content = <ThemeSelector onNavigate={handleNavigate} />; break;
    case 'compile': content = <CompileScreen file={screen.file} onNavigate={handleNavigate} />; status = 'COMPILING'; break;
    case 'watch': content = <WatchScreen file={screen.file} onNavigate={handleNavigate} />; status = 'WATCHING'; break;
    case 'info': content = <InfoScreen file={screen.file} onNavigate={handleNavigate} />; break;
    case 'check': content = <CheckScreen file={screen.file} onNavigate={handleNavigate} />; break;
    default: content = <MainMenu selectedFile={selectedFile} onNavigate={handleNavigate} />;
  }

  return (
    <Box width="100%" height="100%" overflow="hidden">
      <Layout status={status} file={statusBarFile}>
        {content}
      </Layout>
    </Box>
  );
}

export function runTuiMode(): void {
  render(<App />);
}
