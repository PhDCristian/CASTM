import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { useTheme, symbols } from '../theme.js';

interface SplashScreenProps {
  onComplete: () => void;
  skipAnimation?: boolean;
}

// Loading messages
const LOADING_MESSAGES = [
  'Initializing CGRA fabric...',
  'Loading instruction set...',
  'Calibrating processing elements...',
  'Establishing data paths...',
  'Configuring memory interfaces...',
  'System ready',
];

// Simple spinner using ASCII
function LoadingSpinner({ color }: { color: string }) {
  const [frame, setFrame] = useState(0);
  const frames = symbols.spinner;
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 100);
    return () => clearInterval(timer);
  }, [frames.length]);
  
  return <Text color={color}>{frames[frame]}</Text>;
}

export function SplashScreen({ onComplete, skipAnimation = false }: SplashScreenProps) {
  const theme = useTheme();
  const [frame, setFrame] = useState(0);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [logoText, setLogoText] = useState('');

  // Skip animation if requested
  useEffect(() => {
    if (skipAnimation) {
      onComplete();
    }
  }, [skipAnimation, onComplete]);

  // Generate figlet logo
  useEffect(() => {
    figlet('OpenEdge', { font: 'Slant' }, (err, data) => {
      if (!err && data) setLogoText(data);
    });
  }, []);

  // Animation timers
  useEffect(() => {
    if (skipAnimation) return;

    const frameTimer = setInterval(() => {
      setFrame(f => f + 1);
    }, 40);

    const subtitleTimer = setTimeout(() => setShowSubtitle(true), 600);
    const statsTimer = setTimeout(() => setShowStats(true), 1000);
    
    // Message progression
    const messageTimers = LOADING_MESSAGES.map((_, i) => 
      setTimeout(() => setMessageIndex(i), 400 + i * 300)
    );

    const completeTimer = setTimeout(onComplete, 2800);

    return () => {
      clearInterval(frameTimer);
      clearTimeout(subtitleTimer);
      clearTimeout(statsTimer);
      messageTimers.forEach(t => clearTimeout(t));
      clearTimeout(completeTimer);
    };
  }, [onComplete, skipAnimation]);

  // Progress bar
  const width = 40;
  const progress = Math.min(100, frame * 1.5);
  const filled = Math.floor((progress / 100) * width);
  
  const barFilled = symbols.progressFilled.repeat(filled);
  const barEmpty = symbols.progressEmpty.repeat(width - filled);
  
  // Gradient
  const brandGradient = gradient([theme.primary, theme.secondary, theme.accent]);

  // Current loading message
  const currentMessage = LOADING_MESSAGES[Math.min(messageIndex, LOADING_MESSAGES.length - 1)];
  const isComplete = messageIndex >= LOADING_MESSAGES.length - 1;

  return (
    <Box 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center" 
      width="100%"
      paddingY={2}
    >
      {/* Logo */}
      <Box marginBottom={1} flexDirection="column" alignItems="center">
        {logoText ? (
          <Text>{brandGradient(logoText)}</Text>
        ) : (
          <Text color={theme.primary} bold>OpenEdge DSL</Text>
        )}
      </Box>

      {/* Subtitle */}
      <Box marginBottom={2} height={2} flexDirection="column" alignItems="center">
        {showSubtitle && (
          <>
            <Text color={theme.dim}>CGRA COMPILER TOOLCHAIN</Text>
            <Text color={theme.accent}>v0.1.0</Text>
          </>
        )}
      </Box>

      {/* Hardware Stats */}
      {showStats && (
        <Box marginBottom={2} flexDirection="row" justifyContent="center">
          <Box marginRight={3}>
            <Text color={theme.dim}>Grid: </Text>
            <Text color={theme.primary} bold>4x4</Text>
          </Box>
          <Box marginRight={3}>
            <Text color={theme.dim}>PEs: </Text>
            <Text color={theme.primary} bold>16</Text>
          </Box>
          <Box>
            <Text color={theme.dim}>ISA: </Text>
            <Text color={theme.primary} bold>OpenEdge-v1</Text>
          </Box>
        </Box>
      )}

      {/* Progress Bar */}
      <Box flexDirection="column" alignItems="center" width={width + 10}>
        <Box>
          <Text color={theme.dim}>[</Text>
          <Text color={theme.primary}>{barFilled}</Text>
          <Text color={theme.dim}>{barEmpty}</Text>
          <Text color={theme.dim}>]</Text>
          <Text color={theme.primary} bold> {Math.floor(progress)}%</Text>
        </Box>
        
        {/* Status Message */}
        <Box marginTop={1}>
          {isComplete ? (
            <Text color={theme.success} bold>
              {symbols.success} {currentMessage.toUpperCase()}
            </Text>
          ) : (
            <Box>
              <LoadingSpinner color={theme.primary} />
              <Text color={theme.dim}> {currentMessage}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Skip hint */}
      <Box marginTop={2}>
        <Text color={theme.dim}>Press any key to skip</Text>
      </Box>
    </Box>
  );
}
