import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { useTheme } from '../theme.js';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const theme = useTheme();
  const [frame, setFrame] = useState(0);
  const [showText, setShowText] = useState(false);
  const [logoText, setLogoText] = useState('');

  useEffect(() => {
    // Generate figlet text once
    figlet('OpenEdge', { font: 'Slant' }, (err, data) => {
      if (!err && data) setLogoText(data);
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => f + 1);
    }, 50);

    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 800);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      clearInterval(timer);
      clearTimeout(textTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // Loading bar animation
  const width = 40;
  const progress = Math.min(100, (frame * 2));
  const filled = Math.floor((progress / 100) * width);
  
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  
  // Gradient logic based on theme
  const brandGradient = gradient([theme.primary, theme.secondary]);

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height={20}>
      <Box height={1} />
      
      {/* Animated Logo */}
      <Box marginBottom={2}>
        {logoText ? (
          <Text>{brandGradient(logoText)}</Text>
        ) : (
          <Box height={6} />
        )}
      </Box>

      {/* Subtitle with fade-in effect */}
      <Box marginBottom={2} height={1}>
        {showText && (
          <Text color={theme.dim}>
            CGRA COMPILER TOOLCHAIN <Text color={theme.accent}>v0.1.0</Text>
          </Text>
        )}
      </Box>

      {/* Loading Bar */}
      <Box flexDirection="column" alignItems="center">
        <Text color={theme.primary}>{bar}</Text>
        <Box marginTop={1}>
           <Text color={theme.dim}>
             {progress < 100 ? 'INITIALIZING SYSTEM...' : 'READY'}
           </Text>
        </Box>
      </Box>
    </Box>
  );
}
